import { Elysia, t } from 'elysia';
import User from '../../models/User';
import Room from '../../models/Room';
import { RedisChatService, RedisRoomParticipantsService } from '../../services/redis';
import { BankrAgentService, BANKR_BOT_USER, MentionResolverService } from '../../services/agent';
import { errorResponse, successResponse } from '../../utils';
import { authMiddleware } from '../../middleware/auth';
import { wsManager } from '../../services/websocket/manager';
import { 
  GetMessagesResponseSchema, 
  SendMessageResponseSchema,
  DeleteMessagesResponseSchema,
  SimpleSuccessResponseSchema,
  ErrorResponse 
} from '../../schemas/documentation';

// Documentation schemas
const ChatMessageSchema = t.Object({
  id: t.String({ description: 'Unique message ID' }),
  roomId: t.String({ description: 'Room ID the message belongs to' }),
  userId: t.String({ description: 'Farcaster ID of the sender' }),
  username: t.String({ description: 'Username of the sender' }),
  displayName: t.String({ description: 'Display name of the sender' }),
  pfp_url: t.String({ description: 'Profile picture URL of the sender' }),
  message: t.String({ description: 'Message content' }),
  timestamp: t.String({ description: 'ISO timestamp of when the message was sent' })
});

export const chatRoutes = new Elysia()
  .group('/public', (app) =>
    app
      // Get chat messages
      .get('/:id/messages', async ({ params, query, set }) => {
        try {
          const limit = query.limit ? parseInt(query.limit as string, 10) : 50;
          const offset = query.offset ? parseInt(query.offset as string, 10) : 0;

          // Validate pagination parameters
          if (isNaN(limit) || limit < 1) {
            set.status = 400;
            return errorResponse('Invalid limit parameter');
          }

          if (isNaN(offset) || offset < 0) {
            set.status = 400;
            return errorResponse('Invalid offset parameter');
          }

          if (limit > 100) {
            set.status = 400;
            return errorResponse('Limit cannot exceed 100 messages');
          }

          const [messages, totalCount] = await Promise.all([
            RedisChatService.getMessages(params.id, limit, offset),
            RedisChatService.getMessageCount(params.id)
          ]);

          return successResponse({
            messages,
            totalCount,
            limit,
            offset,
            hasMore: offset + limit < totalCount
          });
        } catch (error) {
          console.error('Error fetching chat messages:', error);
          set.status = 500;
          return errorResponse('Failed to fetch chat messages');
        }
      }, {
        params: t.Object({
          id: t.String({ description: 'MongoDB ObjectId of the room' })
        }),
        query: t.Object({
          limit: t.Optional(t.String({ 
            description: 'Number of messages to return (default: 50, max: 100)' 
          })),
          offset: t.Optional(t.String({ 
            description: 'Number of messages to skip (default: 0)' 
          }))
        }),
        response: {
          200: GetMessagesResponseSchema,
          400: ErrorResponse,
          500: ErrorResponse
        },
        detail: {
          tags: ['Chat'],
          summary: 'Get Chat Messages',
          description: `
Retrieves chat messages for a room with pagination support.

**Pagination:**
- \`limit\`: Number of messages to return (default: 50, max: 100)
- \`offset\`: Number of messages to skip for pagination

**Response Includes:**
- \`messages\`: Array of chat messages
- \`totalCount\`: Total number of messages in the room
- \`hasMore\`: Boolean indicating if more messages exist

**Data Source:** Redis (real-time chat storage)

**Note:** This is a public endpoint and does not require authentication.
          `
        }
      })
  )

  .guard({
    beforeHandle: authMiddleware
  })
  // PROTECTED ROUTES
  .group('/protected', (app) =>
    app
      // Send chat message
      .post('/:id/messages', async ({ headers, params, body, set }) => {
        try {
          const userFid = headers['x-user-privyid'] as string;
          const { message, replyToId } = body;

          if (!userFid) {
            set.status = 401;
            return errorResponse('Authentication required');
          }

          // Verify user is in room by checking if they're a participant
          const participant = await RedisRoomParticipantsService.getParticipant(params.id, userFid);
          if (!participant) {
            set.status = 403;
            return errorResponse('User must be in the room to send messages');
          }

          // Fetch user data for message storage
          const user = await User.findOne({ privyId: userFid });
          if (!user) {
            set.status = 404;
            return errorResponse('User not found');
          }

          const chatMessage = await RedisChatService.storeMessage(
            params.id, 
            user.toObject(), 
            message,
            replyToId
          );

          // Broadcast new message via WebSocket
          wsManager.broadcastToRoom(params.id, 'new_message', { message: chatMessage });

          // Check if replying to a bot message (for conversation continuation)
          let isBotReply = false;
          let existingThreadId: string | undefined;
          
          if (replyToId) {
            const replyToMessage = await RedisChatService.getMessage(replyToId);
            if (replyToMessage && replyToMessage.isBot === true) {
              isBotReply = true;
              existingThreadId = replyToMessage.threadId;
            }
          }

          // Check if message contains a Bankr AI trigger (/bankr) OR is a reply to a bot message
          const hasBankrTrigger = BankrAgentService.isConfigured() && BankrAgentService.hasTrigger(message);
          const shouldProcessAsBankr = BankrAgentService.isConfigured() && (hasBankrTrigger || isBotReply);
          
          if (shouldProcessAsBankr) {
            // Extract prompt - either from /bankr command or use the entire message for bot replies
            const prompt = hasBankrTrigger ? BankrAgentService.extractPrompt(message) : message.trim();
            
            if (prompt) {
              // Store placeholder bot message immediately
              const botMessage = await RedisChatService.storeBotMessage(
                params.id,
                BANKR_BOT_USER,
                '🤔 Thinking...',
                'pending',
                chatMessage.id  // Reply to the user's message
              );

              // Broadcast pending bot message via WebSocket
              wsManager.broadcastToRoom(params.id, 'new_message', { message: botMessage });

              // Get room to access HMS roomId for mention resolution
              const room = await Room.findById(params.id);
              const channelName = room?.roomId;

              // Process Bankr AI request asynchronously (don't block the response)
              (async () => {
                try {
                  // Resolve @mentions to wallet addresses if Agora channel is active
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
                      // Continue with original prompt if mention resolution fails
                    }
                  }

                  console.log(`[Bankr AI] Processing prompt: "${enrichedPrompt}" for room ${params.id}${existingThreadId ? ` (continuing thread ${existingThreadId})` : ''}`);
                  
                  const result = await BankrAgentService.executePromptWithPolling(enrichedPrompt, existingThreadId);
                  
                  if (result.success && result.response) {
                    // Update bot message with actual response, threadId, and transactions if present
                    const updateData: { message: string; status: 'completed'; threadId?: string; transactions?: any[]; prompterFid?: string } = {
                      message: result.response,
                      status: 'completed',
                      threadId: result.threadId
                    };
                    
                    // Include transactions if Bankr returned any, transformed to our schema
                    if (result.transactions && result.transactions.length > 0) {
                      updateData.transactions = result.transactions.map(tx => {
                        // Extract transaction details from metadata
                        const txData = tx.metadata?.transaction || tx.metadata;
                        const originalData = tx.metadata?.__ORIGINAL_TX_DATA__;
                        return {
                          type: tx.type,
                          chainId: txData?.chainId || tx.metadata?.chainId || 8453, // Default to Base
                          to: txData?.to || tx.metadata?.to || '',
                          data: txData?.data || tx.metadata?.data,
                          value: txData?.value || tx.metadata?.value || '0',
                          gas: txData?.gas || tx.metadata?.gas,
                          description: originalData?.humanReadableMessage || tx.metadata?.description,
                          status: 'pending' // Transaction is pending user execution
                        };
                      });
                      updateData.prompterFid = userFid; // Store who triggered the transaction
                      console.log(`[Bankr AI] Response includes ${result.transactions.length} transaction(s)`);
                    }
                    
                    await RedisChatService.updateMessage(botMessage.id, updateData);

                    // Broadcast updated bot message via WebSocket
                    const updatedMsg = await RedisChatService.getMessage(botMessage.id);
                    if (updatedMsg) {
                      wsManager.broadcastToRoom(params.id, 'message_updated', { message: updatedMsg });
                    }

                    console.log(`[Bankr AI] Response stored for message ${botMessage.id}${result.threadId ? ` (threadId: ${result.threadId})` : ''}`);
                  } else {
                    // Update with error message
                    await RedisChatService.updateMessage(botMessage.id, {
                      message: `❌ ${result.error || 'Sorry, I encountered an error processing your request.'}`,
                      status: 'failed'
                    });

                    const failedMsg = await RedisChatService.getMessage(botMessage.id);
                    if (failedMsg) {
                      wsManager.broadcastToRoom(params.id, 'message_updated', { message: failedMsg });
                    }

                    console.error(`[Bankr AI] Error: ${result.error}`);
                  }
                } catch (error) {
                  console.error('[Bankr AI] Async processing error:', error);
                  await RedisChatService.updateMessage(botMessage.id, {
                    message: '❌ Sorry, something went wrong. Please try again.',
                    status: 'failed'
                  });

                  const errorMsg = await RedisChatService.getMessage(botMessage.id);
                  if (errorMsg) {
                    wsManager.broadcastToRoom(params.id, 'message_updated', { message: errorMsg });
                  }
                }
              })();

              // Return both messages (user message + pending bot message)
              return successResponse({
                userMessage: chatMessage,
                botMessage: botMessage
              }, 'Message sent successfully, AI response pending');
            }
          }
          
          return successResponse(chatMessage, 'Message sent successfully');
        } catch (error) {
          console.error('Error sending message:', error);
          set.status = 500;
          return errorResponse('Failed to send message');
        }
      }, {
        body: t.Object({
          message: t.String({ 
            minLength: 1, 
            maxLength: 1000,
            description: 'Message content (1-1000 characters)'
          }),
          replyToId: t.Optional(t.String({
            description: 'Optional message ID to reply to'
          }))
        }),
        params: t.Object({
          id: t.String({ description: 'MongoDB ObjectId of the room' })
        }),
        response: {
          200: SendMessageResponseSchema,
          401: ErrorResponse,
          403: ErrorResponse,
          404: ErrorResponse,
          500: ErrorResponse
        },
        detail: {
          tags: ['Chat'],
          summary: 'Send Chat Message',
          description: `
Sends a chat message to a room.

**Authorization:** User must be a participant in the room.

**Message Requirements:**
- Minimum length: 1 character
- Maximum length: 1000 characters

**Message Storage:**
- Messages are stored in Redis with sender information
- Each message gets a unique ID and timestamp

**Validation:**
- User must be authenticated
- User must be an active participant in the room
- Message must meet length requirements

**Authentication Required:** Yes (Farcaster JWT)
          `,
          security: [{ bearerAuth: [] }]
        }
      })

      // Delete room messages (cleanup) - HOST only
      .delete('/:id/messages', async ({ headers, params, set }) => {
        try {
          const userFid = headers['x-user-privyid'] as string;

          if (!userFid) {
            set.status = 401;
            return errorResponse('Authentication required');
          }

          // Authorization check - only host can delete room messages
          const requester = await User.findOne({ privyId: userFid });
          if (!requester) {
            set.status = 404;
            return errorResponse('User not found');
          }

          const room = await Room.findById(params.id);
          if (!room) {
            set.status = 404;
            return errorResponse('Room not found');
          }

          // Check if requester is the room host
          if (room.host.toString() !== requester._id.toString()) {
            set.status = 403;
            return errorResponse('Only the room host can delete messages');
          }

          await RedisChatService.deleteMessages(params.id);

          // Broadcast messages deleted via WebSocket
          wsManager.broadcastToRoom(params.id, 'messages_deleted', { roomId: params.id });

          return successResponse(undefined, 'Messages deleted successfully');
        } catch (error) {
          console.error('Error deleting messages:', error);
          set.status = 500;
          return errorResponse('Failed to delete messages');
        }
      }, {
        params: t.Object({
          id: t.String({ description: 'MongoDB ObjectId of the room' })
        }),
        response: {
          200: DeleteMessagesResponseSchema,
          401: ErrorResponse,
          403: ErrorResponse,
          404: ErrorResponse,
          500: ErrorResponse
        },
        detail: {
          tags: ['Chat'],
          summary: 'Delete All Room Messages',
          description: `
Deletes all chat messages for a room.

**Authorization:** Only the room host can delete messages.

**Use Case:** 
- Cleanup after room ends
- Moderation purposes
- Privacy compliance

**Warning:** This action is irreversible. All messages for the room will be permanently deleted.

**Authentication Required:** Yes (Farcaster JWT)
          `,
          security: [{ bearerAuth: [] }]
        }
      })

      // Confirm Bankr transaction execution
      .post('/:id/messages/:messageId/confirm-transaction', async ({ headers, params, body, set }) => {
        try {
          const userFid = headers['x-user-privyid'] as string;
          const { txHash, status } = body;

          if (!userFid) {
            set.status = 401;
            return errorResponse('Authentication required');
          }

          // Get the message to verify it exists and has transactions
          const message = await RedisChatService.getMessage(params.messageId);
          if (!message) {
            set.status = 404;
            return errorResponse('Message not found');
          }

          // Verify this is a bot message with transactions
          if (!message.isBot || !message.transactions || message.transactions.length === 0) {
            set.status = 400;
            return errorResponse('Message does not contain transactions');
          }

          // Verify the user is the prompter
          if (message.prompterFid !== userFid) {
            set.status = 403;
            return errorResponse('Only the transaction prompter can confirm execution');
          }

          // Update the transaction status
          const updatedTransactions = message.transactions.map((tx: any) => ({
            ...tx,
            status: status,
            txHash: txHash || tx.txHash
          }));

          await RedisChatService.updateMessage(params.messageId, {
            transactions: updatedTransactions
          });

          // Broadcast updated transaction message via WebSocket
          const updatedTxMessage = await RedisChatService.getMessage(params.messageId);
          if (updatedTxMessage) {
            wsManager.broadcastToRoom(params.id, 'message_updated', { message: updatedTxMessage });
          }

          // If transaction confirmed, optionally post a follow-up from Bankr
          if (status === 'confirmed' && txHash) {
            const confirmMsg = await RedisChatService.storeBotMessage(
              params.id,
              BANKR_BOT_USER,
              `✅ Transaction confirmed! [View on BaseScan](https://basescan.org/tx/${txHash})`,
              'completed',
              params.messageId
            );
            wsManager.broadcastToRoom(params.id, 'new_message', { message: confirmMsg });
          } else if (status === 'failed') {
            const failMsg = await RedisChatService.storeBotMessage(
              params.id,
              BANKR_BOT_USER,
              '❌ Transaction failed. Please try again or check your wallet balance.',
              'completed',
              params.messageId
            );
            wsManager.broadcastToRoom(params.id, 'new_message', { message: failMsg });
          }

          return successResponse({ 
            messageId: params.messageId,
            status: status,
            txHash: txHash
          }, 'Transaction status updated');
        } catch (error) {
          console.error('Error confirming transaction:', error);
          set.status = 500;
          return errorResponse('Failed to confirm transaction');
        }
      }, {
        body: t.Object({
          txHash: t.Optional(t.String({ description: 'Transaction hash from blockchain' })),
          status: t.Union([
            t.Literal('confirmed'),
            t.Literal('failed')
          ], { description: 'Transaction execution status' })
        }),
        params: t.Object({
          id: t.String({ description: 'MongoDB ObjectId of the room' }),
          messageId: t.String({ description: 'Message ID containing the transaction' })
        }),
        response: {
          200: SimpleSuccessResponseSchema,
          400: ErrorResponse,
          401: ErrorResponse,
          403: ErrorResponse,
          404: ErrorResponse,
          500: ErrorResponse
        },
        detail: {
          tags: ['Chat'],
          summary: 'Confirm Bankr Transaction',
          description: `
Confirms or reports failure of a Bankr AI transaction execution.

**Purpose:**
- Update transaction status after user executes it
- Post follow-up message from Bankr AI with confirmation/failure

**Authorization:** Only the user who triggered the transaction (prompter) can confirm it.

**Workflow:**
1. User clicks "Execute" button on Bankr transaction message
2. User signs transaction in their wallet
3. Frontend calls this endpoint with txHash and status
4. Message transaction status is updated
5. Bankr posts a follow-up confirmation/failure message

**Authentication Required:** Yes (Farcaster JWT)
          `,
          security: [{ bearerAuth: [] }]
        }
      })
  );
