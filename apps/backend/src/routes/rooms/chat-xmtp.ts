import { Elysia, t } from 'elysia';
import User from '../../models/User';
import Room from '../../models/Room';
import { RedisRoomParticipantsService } from '../../services/redis';
import { XMTPGroupManager, xmtpClientManager } from '../../services/xmtp';
import { errorResponse, successResponse } from '../../utils';
import { authMiddleware } from '../../middleware/auth';
import { ensureXMTPKey } from '../../utils/xmtp-helpers';
import { 
  GetMessagesResponseSchema, 
  SendMessageResponseSchema,
  DeleteMessagesResponseSchema,
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
      // Get chat messages from XMTP
      .get('/:id/messages', async ({ params, query, set, headers }) => {
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

          // Get XMTP group ID for room
          const groupId = await XMTPGroupManager.getGroupId(params.id);
          if (!groupId) {
            // Room doesn't have XMTP group yet
            return successResponse({
              messages: [],
              totalCount: 0,
              limit,
              offset,
              hasMore: false
            });
          }

          // For public endpoint, we need a client to fetch messages
          // This is a limitation - we'll need authenticated requests or a system client
          const userFid = headers['x-user-fid'] as string;
          const walletAddress = headers['x-wallet-address'] as string;
          
          if (!userFid || !walletAddress) {
            set.status = 401;
            return errorResponse('Authentication required to fetch messages');
          }

          // Get user and their XMTP client
          const user = await User.findOne({ fid: parseInt(userFid) });
          if (!user) {
            set.status = 404;
            return errorResponse('User not found');
          }

          const encryptionKey = await ensureXMTPKey(user);
          
          // Try to get cached client
          const xmtpClient = xmtpClientManager.getClient(userFid);
          if (!xmtpClient) {
            set.status = 400;
            return errorResponse('XMTP client not initialized. Please provide wallet signature.');
          }

          // Fetch messages from XMTP
          const xmtpMessages = await XMTPGroupManager.getMessages(
            xmtpClient,
            groupId,
            limit,
            offset
          );

          const totalCount = await XMTPGroupManager.getMessageCount(xmtpClient, groupId);

          // Transform XMTP messages to our format
          const messages = await Promise.all(xmtpMessages.map(async (msg: any) => {
            // Get sender info from inbox ID
            const senderFid = msg.senderInboxId;
            const senderUser = await User.findOne({ /* wallet matching logic */ });

            return {
              id: msg.id,
              roomId: params.id,
              userId: senderFid,
              username: senderUser?.username || 'Unknown',
              displayName: senderUser?.displayName || 'Unknown',
              pfp_url: senderUser?.pfp_url || '',
              message: msg.content,
              timestamp: msg.sentAt.toISOString(),
              replyTo: msg.replyToId ? {
                messageId: msg.replyToId,
                message: '', // Would need to fetch original message
                username: '',
                pfp_url: ''
              } : undefined
            };
          }));

          return successResponse({
            messages,
            totalCount,
            limit,
            offset,
            hasMore: offset + limit < totalCount
          });
        } catch (error) {
          console.error('Error fetching XMTP messages:', error);
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
          401: ErrorResponse,
          404: ErrorResponse,
          500: ErrorResponse
        },
        detail: {
          tags: ['Chat'],
          summary: 'Get Chat Messages (XMTP)',
          description: `
Retrieves chat messages for a room from XMTP with pagination support.

**Pagination:**
- \`limit\`: Number of messages to return (default: 50, max: 100)
- \`offset\`: Number of messages to skip for pagination

**Response Includes:**
- \`messages\`: Array of chat messages
- \`totalCount\`: Total number of messages in the room
- \`hasMore\`: Boolean indicating if more messages exist

**Data Source:** XMTP (decentralized messaging)

**Authentication:** Requires XMTP client initialization via wallet signature.
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
      // Send chat message via XMTP
      .post('/:id/messages', async ({ headers, params, body, set }) => {
        try {
          const userFid = headers['x-user-fid'] as string;
          const walletAddress = headers['x-wallet-address'] as string;
          const { message, replyToId } = body;

          if (!userFid || !walletAddress) {
            set.status = 401;
            return errorResponse('Authentication required');
          }

          // Verify user is in room by checking if they're a participant
          const participant = await RedisRoomParticipantsService.getParticipant(params.id, userFid);
          if (!participant) {
            set.status = 403;
            return errorResponse('User must be in the room to send messages');
          }

          // Get user
          const user = await User.findOne({ fid: parseInt(userFid) });
          if (!user) {
            set.status = 404;
            return errorResponse('User not found');
          }

          // Get XMTP client (should be cached from previous requests)
          const xmtpClient = xmtpClientManager.getClient(userFid);
          if (!xmtpClient) {
            set.status = 400;
            return errorResponse('XMTP client not initialized. Please initialize client first.');
          }

          // Get XMTP group ID
          const groupId = await XMTPGroupManager.getGroupId(params.id);
          if (!groupId) {
            set.status = 404;
            return errorResponse('XMTP group not found for this room');
          }

          // Send message via XMTP
          let sentMessage;
          if (replyToId) {
            sentMessage = await XMTPGroupManager.sendReply(
              xmtpClient,
              groupId,
              message,
              replyToId
            );
          } else {
            sentMessage = await XMTPGroupManager.sendMessage(
              xmtpClient,
              groupId,
              message
            );
          }

          // Format response
          const chatMessage = {
            id: `${Date.now()}_${userFid}`,
            roomId: params.id,
            userId: userFid,
            username: user.username,
            displayName: user.displayName,
            pfp_url: user.pfp_url,
            message: message,
            timestamp: new Date().toISOString(),
            replyTo: replyToId ? { messageId: replyToId } : undefined
          };
          
          return successResponse(chatMessage, 'Message sent successfully');
        } catch (error) {
          console.error('Error sending XMTP message:', error);
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
          400: ErrorResponse,
          401: ErrorResponse,
          403: ErrorResponse,
          404: ErrorResponse,
          500: ErrorResponse
        },
        detail: {
          tags: ['Chat'],
          summary: 'Send Chat Message (XMTP)',
          description: `
Sends a chat message to a room via XMTP.

**Authorization:** User must be a participant in the room.

**Message Requirements:**
- Minimum length: 1 character
- Maximum length: 1000 characters

**Message Storage:**
- Messages are sent via XMTP network
- End-to-end encrypted
- Persisted in XMTP's decentralized storage

**Validation:**
- User must be authenticated
- User must be an active participant in the room
- Message must meet length requirements
- XMTP client must be initialized

**Authentication Required:** Yes (Farcaster JWT + Wallet)
          `,
          security: [{ bearerAuth: [] }]
        }
      })

      // Delete/archive XMTP group - HOST only
      .delete('/:id/messages', async ({ headers, params, set }) => {
        try {
          const userFid = headers['x-user-fid'] as string;

          if (!userFid) {
            set.status = 401;
            return errorResponse('Authentication required');
          }

          // Authorization check - only host can delete room messages
          const requester = await User.findOne({ fid: parseInt(userFid) });
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

          // Get XMTP group ID
          const groupId = await XMTPGroupManager.getGroupId(params.id);
          if (!groupId) {
            return successResponse(undefined, 'No XMTP group found');
          }

          // Get XMTP client
          const xmtpClient = xmtpClientManager.getClient(userFid);
          if (!xmtpClient) {
            set.status = 400;
            return errorResponse('XMTP client not initialized');
          }

          // Delete group reference (XMTP doesn't support message deletion)
          await XMTPGroupManager.deleteGroup(xmtpClient, groupId, params.id);
          
          return successResponse(undefined, 'XMTP group reference removed successfully');
        } catch (error) {
          console.error('Error deleting XMTP group:', error);
          set.status = 500;
          return errorResponse('Failed to delete group');
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
          summary: 'Remove XMTP Group Reference',
          description: `
Removes the XMTP group reference for a room.

**Authorization:** Only the room host can perform this action.

**Note:** XMTP does not support deleting individual messages. This endpoint removes
the group reference from our system but messages remain in XMTP's network.

**Use Case:** 
- Cleanup after room ends
- Privacy compliance (removes association)

**Authentication Required:** Yes (Farcaster JWT)
          `,
          security: [{ bearerAuth: [] }]
        }
      })

      // Initialize XMTP client endpoint
      .post('/xmtp/init', async ({ headers, body, set }) => {
        try {
          const userFid = headers['x-user-fid'] as string;
          const { walletAddress, signature, message: signedMessage } = body;

          if (!userFid) {
            set.status = 401;
            return errorResponse('Authentication required');
          }

          const user = await User.findOne({ fid: parseInt(userFid) });
          if (!user) {
            set.status = 404;
            return errorResponse('User not found');
          }

          const encryptionKey = await ensureXMTPKey(user);

          // Create sign function that returns the provided signature
          const signMessage = async (msg: string) => {
            // In production, verify that msg matches signedMessage
            return signature;
          };

          const xmtpClient = await xmtpClientManager.getOrCreateClient(
            userFid,
            walletAddress,
            encryptionKey,
            signMessage
          );

          return successResponse({
            inboxId: xmtpClient.inboxId,
            address: walletAddress,
          }, 'XMTP client initialized successfully');
        } catch (error) {
          console.error('Error initializing XMTP client:', error);
          set.status = 500;
          return errorResponse('Failed to initialize XMTP client');
        }
      }, {
        body: t.Object({
          walletAddress: t.String({ description: 'Connected wallet address' }),
          signature: t.String({ description: 'Wallet signature for XMTP auth' }),
          message: t.String({ description: 'Message that was signed' })
        }),
        response: {
          200: t.Object({
            success: t.Boolean(),
            data: t.Object({
              inboxId: t.String(),
              address: t.String()
            }),
            message: t.String()
          }),
          401: ErrorResponse,
          404: ErrorResponse,
          500: ErrorResponse
        },
        detail: {
          tags: ['Chat'],
          summary: 'Initialize XMTP Client',
          description: `
Initializes XMTP client for the authenticated user with wallet signature.

**Required:**
- User must be authenticated
- Wallet address must be connected
- Valid signature from wallet

**Response:**
- \`inboxId\`: XMTP inbox ID for the user
- \`address\`: Wallet address used

**Authentication Required:** Yes (Farcaster JWT)
          `,
          security: [{ bearerAuth: [] }]
        }
      })
  );
