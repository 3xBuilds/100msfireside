import { Elysia } from 'elysia';
import { createClient } from '@farcaster/quick-auth';
import { wsManager } from '../services/websocket/manager';
import { RedisChatService, RedisRoomParticipantsService } from '../services/redis';
import { BankrAgentService, BANKR_BOT_USER, MentionResolverService } from '../services/agent';
import User from '../models/User';
import Room from '../models/Room';
import config from '../config';

/**
 * Authenticate a WebSocket message by verifying the JWT token.
 * Returns the user FID string on success, or null on failure.
 */
async function authenticateToken(token: string): Promise<string | null> {
  try {
    if (config.isDevelopment) {
      return config.localFid?.toString() || null;
    }

    if (!token) return null;

    const client = createClient();
    const verificationDomain = process.env.DEV_JWT_DOMAIN as string;

    const payload = await client.verifyJwt({
      token,
      domain: verificationDomain,
    });

    const fid = Number(payload.sub);
    if (Number.isNaN(fid)) return null;

    return fid.toString();
  } catch (error) {
    console.error('[WS] Token verification failed:', error);
    return null;
  }
}

/**
 * Process a send_message WebSocket event.
 * Handles auth, validation, storage, Bankr AI trigger, and broadcasting.
 */
async function handleSendMessage(
  ws: any,
  data: { roomId: string; message: string; replyToId?: string; token: string }
) {
  const { roomId, message, replyToId, token } = data;

  // Validate message
  if (!message || typeof message !== 'string') {
    wsManager.sendTo(ws, 'error', { error: 'Message is required' });
    return;
  }

  const trimmedMessage = message.trim();
  if (trimmedMessage.length === 0 || trimmedMessage.length > 1000) {
    wsManager.sendTo(ws, 'error', { error: 'Message must be between 1 and 1000 characters' });
    return;
  }

  // Authenticate
  const userFid = await authenticateToken(token);
  if (!userFid) {
    console.log(`[WS] Authentication failed for send_message in room ${roomId}`);
    wsManager.sendTo(ws, 'error', { error: 'Authentication failed' });
    return;
  }

  // Verify user is a room participant
  const participant = await RedisRoomParticipantsService.getParticipant(roomId, userFid);
  if (!participant) {
    console.log(`[WS] User ${userFid} is not a participant in room ${roomId}`);
    wsManager.sendTo(ws, 'error', { error: 'User must be in the room to send messages' });
    return;
  }

  // Fetch user data
  const user = await User.findOne({ privyId: userFid });
  if (!user) {
    wsManager.sendTo(ws, 'error', { error: 'User not found' });
    return;
  }

  // Store message in Redis
  const chatMessage = await RedisChatService.storeMessage(
    roomId,
    user.toObject(),
    trimmedMessage,
    replyToId
  );

  // Broadcast new message to all room subscribers (including sender)
  wsManager.broadcastToRoom(roomId, 'new_message', { message: chatMessage });

  // Check for Bankr AI trigger
  let isBotReply = false;
  let existingThreadId: string | undefined;

  if (replyToId) {
    const replyToMessage = await RedisChatService.getMessage(replyToId);
    if (replyToMessage && replyToMessage.isBot === true) {
      isBotReply = true;
      existingThreadId = replyToMessage.threadId;
    }
  }

  const hasBankrTrigger = BankrAgentService.isConfigured() && BankrAgentService.hasTrigger(trimmedMessage);
  const shouldProcessAsBankr = BankrAgentService.isConfigured() && (hasBankrTrigger || isBotReply);

  if (shouldProcessAsBankr) {
    const prompt = hasBankrTrigger ? BankrAgentService.extractPrompt(trimmedMessage) : trimmedMessage;

    if (prompt) {
      // Store placeholder bot message
      const botMessage = await RedisChatService.storeBotMessage(
        roomId,
        BANKR_BOT_USER,
        '🤔 Thinking...',
        'pending',
        chatMessage.id
      );

      // Broadcast pending bot message to room
      wsManager.broadcastToRoom(roomId, 'new_message', { message: botMessage });

      // Get room for mention resolution
      const room = await Room.findById(roomId);
      const channelName = room?.roomId;

      // Process Bankr AI asynchronously
      (async () => {
        try {
          let enrichedPrompt = prompt;
          if (channelName && MentionResolverService.hasMentions(prompt)) {
            try {
              const mentionResult = await MentionResolverService.resolveMentions(prompt, channelName);
              if (mentionResult.mentions.length > 0) {
                enrichedPrompt = mentionResult.enrichedPrompt;
                console.log(`[Bankr AI] Resolved ${mentionResult.mentions.length} mentions with wallet context`);
              }
            } catch (mentionError) {
              console.warn('[Bankr AI] Failed to resolve mentions:', mentionError);
            }
          }

          console.log(`[Bankr AI] Processing prompt: "${enrichedPrompt}" for room ${roomId}${existingThreadId ? ` (continuing thread ${existingThreadId})` : ''}`);

          const result = await BankrAgentService.executePromptWithPolling(enrichedPrompt, existingThreadId);

          if (result.success && result.response) {
            const updateData: { message: string; status: 'completed'; threadId?: string; transactions?: any[]; prompterFid?: string } = {
              message: result.response,
              status: 'completed',
              threadId: result.threadId
            };

            if (result.transactions && result.transactions.length > 0) {
              updateData.transactions = result.transactions.map((tx: any) => {
                const txData = tx.metadata?.transaction || tx.metadata;
                const originalData = tx.metadata?.__ORIGINAL_TX_DATA__;
                return {
                  type: tx.type,
                  chainId: txData?.chainId || tx.metadata?.chainId || 8453,
                  to: txData?.to || tx.metadata?.to || '',
                  data: txData?.data || tx.metadata?.data,
                  value: txData?.value || tx.metadata?.value || '0',
                  gas: txData?.gas || tx.metadata?.gas,
                  description: originalData?.humanReadableMessage || tx.metadata?.description,
                  status: 'pending'
                };
              });
              updateData.prompterFid = userFid;
              console.log(`[Bankr AI] Response includes ${result.transactions.length} transaction(s)`);
            }

            await RedisChatService.updateMessage(botMessage.id, updateData);

            // Get the updated message and broadcast to room
            const updatedBotMessage = await RedisChatService.getMessage(botMessage.id);
            if (updatedBotMessage) {
              wsManager.broadcastToRoom(roomId, 'message_updated', { message: updatedBotMessage });
            }

            console.log(`[Bankr AI] Response stored for message ${botMessage.id}${result.threadId ? ` (threadId: ${result.threadId})` : ''}`);
          } else {
            await RedisChatService.updateMessage(botMessage.id, {
              message: `❌ ${result.error || 'Sorry, I encountered an error processing your request.'}`,
              status: 'failed'
            });

            const failedBotMessage = await RedisChatService.getMessage(botMessage.id);
            if (failedBotMessage) {
              wsManager.broadcastToRoom(roomId, 'message_updated', { message: failedBotMessage });
            }

            console.error(`[Bankr AI] Error: ${result.error}`);
          }
        } catch (error) {
          console.error('[Bankr AI] Async processing error:', error);
          await RedisChatService.updateMessage(botMessage.id, {
            message: '❌ Sorry, something went wrong. Please try again.',
            status: 'failed'
          });

          const errorBotMessage = await RedisChatService.getMessage(botMessage.id);
          if (errorBotMessage) {
            wsManager.broadcastToRoom(roomId, 'message_updated', { message: errorBotMessage });
          }
        }
      })();
    }
  }
}

/**
 * WebSocket route handler for Elysia
 * 
 * Protocol:
 *   Client → Server:
 *     { type: "join_room", roomId: string }
 *     { type: "leave_room", roomId: string }
 *     { type: "send_message", roomId: string, message: string, replyToId?: string, token: string }
 *   
 *   Server → Client:
 *     { type: "new_message", message: ChatMessage }
 *     { type: "message_updated", message: ChatMessage }
 *     { type: "messages_deleted", roomId: string }
 *     { type: "error", error: string }
 */
export const websocketRoutes = new Elysia()
  .ws('/ws', {
    open(ws) {
      wsManager.registerConnection(ws);
      console.log(`[WS] Connection opened (total: ${wsManager.getTotalConnectionCount()})`);
    },

    close(ws) {
      wsManager.removeConnection(ws);
      console.log(`[WS] Connection closed (total: ${wsManager.getTotalConnectionCount()})`);
    },

    message(ws, rawMessage) {
      try {
        const data = typeof rawMessage === 'string' ? JSON.parse(rawMessage) : rawMessage;

        if (!data || typeof data.type !== 'string') {
          wsManager.sendTo(ws, 'error', { error: 'Invalid message format: type is required' });
          return;
        }

        console.log(`[WS] Received message type: ${data.type}${data.roomId ? ` for room ${data.roomId}` : ''}`);

        switch (data.type) {
          case 'join_room': {
            if (!data.roomId || typeof data.roomId !== 'string') {
              wsManager.sendTo(ws, 'error', { error: 'roomId is required for join_room' });
              return;
            }
            wsManager.joinRoom(ws, data.roomId);
            wsManager.sendTo(ws, 'room_joined', { roomId: data.roomId });
            break;
          }

          case 'leave_room': {
            if (!data.roomId || typeof data.roomId !== 'string') {
              wsManager.sendTo(ws, 'error', { error: 'roomId is required for leave_room' });
              return;
            }
            wsManager.leaveRoom(ws, data.roomId);
            break;
          }

          case 'send_message': {
            if (!data.roomId || !data.message) {
              wsManager.sendTo(ws, 'error', {
                error: 'roomId and message are required for send_message'
              });
              return;
            }
            handleSendMessage(ws, data).catch(err => {
              console.error('[WS] Error handling send_message:', err);
              wsManager.sendTo(ws, 'error', { error: 'Failed to send message' });
            });
            break;
          }

          default:
            wsManager.sendTo(ws, 'error', { error: `Unknown message type: ${data.type}` });
        }
      } catch (error) {
        console.error('[WS] Error processing message:', error);
        wsManager.sendTo(ws, 'error', { error: 'Invalid message format' });
      }
    }
  });
