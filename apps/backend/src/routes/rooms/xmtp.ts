import { Elysia, t } from 'elysia';
import User from '../../models/User';
import Room from '../../models/Room';
import { XMTPGroupManager, xmtpClientManager } from '../../services/xmtp';
import { ensureXMTPKey } from '../../utils/xmtp-helpers';
import { errorResponse, successResponse } from '../../utils';
import { authMiddleware } from '../../middleware/auth';
import { ErrorResponse } from '../../schemas/documentation';

/**
 * XMTP-specific routes for group management and invitations
 */
export const xmtpRoutes = new Elysia()
  .group('/public', (app) =>
    app
      // Get XMTP group ID for a room
      .get('/:id/xmtp-group', async ({ params, set }) => {
        try {
          const groupId = await XMTPGroupManager.getGroupId(params.id);
          
          if (!groupId) {
            return successResponse({ groupId: null }, 'No XMTP group found for this room');
          }

          return successResponse({ groupId }, 'XMTP group ID retrieved');
        } catch (error) {
          console.error('Error fetching XMTP group ID:', error);
          set.status = 500;
          return errorResponse('Failed to fetch XMTP group ID');
        }
      }, {
        params: t.Object({
          id: t.String({ description: 'MongoDB ObjectId of the room' })
        }),
        response: {
          200: t.Object({
            success: t.Boolean(),
            data: t.Object({
              groupId: t.Union([t.String(), t.Null()])
            }),
            message: t.String()
          }),
          500: ErrorResponse
        },
        detail: {
          tags: ['XMTP'],
          summary: 'Get XMTP Group ID',
          description: `
Retrieves the XMTP group conversation ID for a room.

**Response:**
- \`groupId\`: The XMTP group conversation ID, or null if no group exists

**Note:** This is a public endpoint.
          `
        }
      })
  )

  .guard({
    beforeHandle: authMiddleware
  })
  .group('/protected', (app) =>
    app
      // Invite user to XMTP group (manual invite)
      .post('/:id/xmtp-group/invite', async ({ headers, params, body, set }) => {
        try {
          const userFid = headers['x-user-fid'] as string;
          const { inviteeAddress, inviteeFid } = body;

          if (!userFid) {
            set.status = 401;
            return errorResponse('Authentication required');
          }

          // Get room and verify it exists
          const room = await Room.findById(params.id);
          if (!room) {
            set.status = 404;
            return errorResponse('Room not found');
          }

          // Get XMTP group ID
          const groupId = await XMTPGroupManager.getGroupId(params.id);
          if (!groupId) {
            set.status = 404;
            return errorResponse('XMTP group not found for this room');
          }

          // Get inviter's XMTP client
          const inviterClient = xmtpClientManager.getClient(userFid);
          if (!inviterClient) {
            set.status = 400;
            return errorResponse('XMTP client not initialized');
          }

          // Get invitee user data
          const inviteeUser = await User.findOne({ fid: parseInt(inviteeFid) });
          if (!inviteeUser) {
            set.status = 404;
            return errorResponse('Invitee user not found');
          }

          const walletAddress = inviteeAddress || inviteeUser.wallet;
          if (!walletAddress) {
            set.status = 400;
            return errorResponse('Invitee wallet address not found');
          }

          // Add to XMTP group
          const added = await XMTPGroupManager.addParticipant(
            inviterClient,
            groupId,
            walletAddress
          );

          if (!added) {
            set.status = 400;
            return errorResponse('Failed to add user to XMTP group. User may not be on XMTP network.');
          }

          return successResponse({
            invitee: {
              fid: inviteeUser.fid,
              username: inviteeUser.username,
              displayName: inviteeUser.displayName,
            }
          }, 'User invited to XMTP group successfully');
        } catch (error) {
          console.error('Error inviting user to XMTP group:', error);
          set.status = 500;
          return errorResponse('Failed to invite user to XMTP group');
        }
      }, {
        params: t.Object({
          id: t.String({ description: 'MongoDB ObjectId of the room' })
        }),
        body: t.Object({
          inviteeAddress: t.Optional(t.String({ description: 'Wallet address of user to invite' })),
          inviteeFid: t.String({ description: 'Farcaster ID of user to invite' })
        }),
        response: {
          200: t.Object({
            success: t.Boolean(),
            data: t.Object({
              invitee: t.Object({
                fid: t.Number(),
                username: t.String(),
                displayName: t.String()
              })
            }),
            message: t.String()
          }),
          400: ErrorResponse,
          401: ErrorResponse,
          404: ErrorResponse,
          500: ErrorResponse
        },
        detail: {
          tags: ['XMTP'],
          summary: 'Invite User to XMTP Group',
          description: `
Manually invite a user to the room's XMTP group chat.

**Authorization:** Requires authenticated user with initialized XMTP client.

**Use Case:**
- Add external participants to chat who aren't in the room
- Manual participant management

**Validation:**
- Invitee must exist in the system
- Invitee must have a wallet address
- Invitee must be on XMTP network

**Authentication Required:** Yes (Farcaster JWT + XMTP)
          `,
          security: [{ bearerAuth: [] }]
        }
      })

      // Get XMTP group members
      .get('/:id/xmtp-group/members', async ({ headers, params, set }) => {
        try {
          const userFid = headers['x-user-fid'] as string;

          if (!userFid) {
            set.status = 401;
            return errorResponse('Authentication required');
          }

          const groupId = await XMTPGroupManager.getGroupId(params.id);
          if (!groupId) {
            return successResponse({ members: [] }, 'No XMTP group found');
          }

          const userClient = xmtpClientManager.getClient(userFid);
          if (!userClient) {
            set.status = 400;
            return errorResponse('XMTP client not initialized');
          }

          const conversation = await userClient.conversations.getConversationById(groupId);
          if (!conversation) {
            set.status = 404;
            return errorResponse('XMTP group not found');
          }

          await conversation.sync();
          const members = conversation.members;

          return successResponse({ members }, 'XMTP group members retrieved');
        } catch (error) {
          console.error('Error fetching XMTP group members:', error);
          set.status = 500;
          return errorResponse('Failed to fetch group members');
        }
      }, {
        params: t.Object({
          id: t.String({ description: 'MongoDB ObjectId of the room' })
        }),
        response: {
          200: t.Object({
            success: t.Boolean(),
            data: t.Object({
              members: t.Array(t.Any())
            }),
            message: t.String()
          }),
          400: ErrorResponse,
          401: ErrorResponse,
          404: ErrorResponse,
          500: ErrorResponse
        },
        detail: {
          tags: ['XMTP'],
          summary: 'Get XMTP Group Members',
          description: `
Retrieves the list of members in the room's XMTP group.

**Authentication Required:** Yes (Farcaster JWT + XMTP)
          `,
          security: [{ bearerAuth: [] }]
        }
      })
  );
