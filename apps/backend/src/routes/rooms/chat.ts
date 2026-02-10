import { Elysia, t } from 'elysia';
import User from '../../models/User';
import Room from '../../models/Room';
import { RedisChatService, RedisRoomParticipantsService } from '../../services/redis';
import { errorResponse, successResponse } from '../../utils';
import { authMiddleware } from '../../middleware/auth';
import { getSystemClient, addMemberToGroup, canMessage, getInboxIdFromAddress } from '../../services/xmtp';
import { IdentifierKind } from '@xmtp/node-sdk';
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
          const userFid = headers['x-user-fid'] as string;
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
          const user = await User.findOne({ fid: parseInt(userFid) });
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

          await RedisChatService.deleteMessages(params.id);
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
  )
  .group('/protected', (app) =>
    app
      .use(authMiddleware)
      
      // Get XMTP group info for a room
      .get('/:id/xmtp-group', async ({ params, set }) => {
        try {
          const room = await Room.findById(params.id);
          
          if (!room) {
            set.status = 404;
            return errorResponse('Room not found');
          }

          return successResponse({
            xmtpGroupId: room.xmtpGroupId || null,
            exists: !!room.xmtpGroupId
          });
        } catch (error) {
          console.error('Error fetching XMTP group:', error);
          set.status = 500;
          return errorResponse('Failed to fetch XMTP group information');
        }
      }, {
        detail: {
          tags: ['Chat'],
          summary: 'Get XMTP Group Information',
          description: `
Retrieves the XMTP group conversation ID for a room.

**Returns:**
- \`xmtpGroupId\`: The XMTP group conversation ID (or null if not created yet)
- \`exists\`: Boolean indicating if an XMTP group exists for this room

**Authentication Required:** Yes (Farcaster JWT)
          `,
          security: [{ bearerAuth: [] }]
        }
      })

      // Add member to XMTP group
      .post('/:id/xmtp-add-member', async ({ params, headers, body, set }) => {
        try {
          const userFid = headers['x-user-fid'] as string;
          const { wallet } = body;
          
          if (!userFid) {
            set.status = 401;
            return errorResponse('User authentication required');
          }

          if (!wallet) {
            set.status = 400;
            return errorResponse('Wallet address is required');
          }

          const room = await Room.findById(params.id);
          if (!room) {
            set.status = 404;
            return errorResponse('Room not found');
          }

          if (!room.xmtpGroupId) {
            set.status = 400;
            return errorResponse('XMTP group not created for this room yet');
          }

          // Check if user can receive XMTP messages
          const xmtpClient = await getSystemClient();
          const canReceive = await canMessage(xmtpClient, [wallet]);

          console.log('Checking if user wallet can receive XMTP messages:', wallet, canReceive.get(wallet.toLowerCase()));
          
          if (!canReceive.get(wallet.toLowerCase())) {
            set.status = 400;
            return errorResponse('Your wallet is not registered on the XMTP network. Please open the chat in the app to complete registration by signing the initialization message.');
          }

          // Get user's inbox ID from their wallet address
          const userInboxId = await getInboxIdFromAddress(xmtpClient, wallet);
          
          if (!userInboxId) {
            set.status = 400;
            return errorResponse('Unable to retrieve inbox ID for your wallet. Please ensure you have initialized XMTP by opening the chat.');
          }

          // Add member to group
          await addMemberToGroup(xmtpClient, room.xmtpGroupId, userInboxId);

          return successResponse({
            message: 'Successfully added to XMTP group',
            groupId: room.xmtpGroupId
          });
        } catch (error: any) {
          console.error('Error adding member to XMTP group:', error);
          
          // Don't fail if user is already a member
          if (error.message?.includes('already in group')) {
            return successResponse({
              message: 'User already in XMTP group',
              groupId: (await Room.findById(params.id))?.xmtpGroupId
            });
          }
          
          set.status = 500;
          return errorResponse('Failed to add member to XMTP group');
        }
      }, {
        body: t.Object({
          wallet: t.String({ 
            description: 'Ethereum wallet address of the user to add to the group' 
          })
        }),
        detail: {
          tags: ['Chat'],
          summary: 'Add Member to XMTP Group',
          description: `
Adds the authenticated user to the room's XMTP group chat.

**Requirements:**
- User must have an XMTP-compatible wallet
- Room must have an XMTP group created
- User wallet must be XMTP-enabled (canMessage check)

**Request Body:**
- \`wallet\`: Ethereum wallet address of the user

**Process:**
1. Validates user can receive XMTP messages
2. Retrieves user's inbox ID from wallet address
3. Adds user to the XMTP group conversation

**Idempotent:** Safe to call multiple times for the same user.

**Authentication Required:** Yes (Farcaster JWT)
          `,
          security: [{ bearerAuth: [] }]
        }
      })
  );
