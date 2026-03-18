import { Elysia, t } from 'elysia';
import Room from '../../models/Room';
import User from '../../models/User';
import { RedisRoomParticipantsService } from '../../services/redis';
import { AgoraAPI } from '../../services/agoraAPI';
import { errorResponse, successResponse } from '../../utils';
import { authMiddleware } from '../../middleware/auth';
import { GetRoomCodesResponseSchema, GetMyCodeResponseSchema, ErrorResponse } from '../../schemas/documentation';
import config from '../../config';

// Documentation schemas
const AgoraTokenSchema = t.Object({
  token: t.String({ description: 'Agora RTC token for joining' }),
  channelName: t.String({ description: 'Agora channel name' }),
  uid: t.Number({ description: 'Agora user ID (FID)' }),
  role: t.String({ description: 'Role in the room (host, co-host, speaker, listener)' }),
  appId: t.String({ description: 'Agora App ID' })
});

export const integrationRoutes = new Elysia()
  .group('/public', (app) =>
    app
      // Get Agora tokens for all roles (for admin/debug)
      .get('/:id/codes', async ({ params, set }) => {
        try {
          const room = await Room.findById(params.id);
          if (!room) {
            set.status = 404;
            return errorResponse('Room not found');
          }
          
          const agoraAPI = new AgoraAPI();
          const roles = ['host', 'co-host', 'speaker', 'listener'] as const;
          const tokens = roles.map(role => ({
            role,
            token: agoraAPI.generateToken(room.roomId, 0, role),
            channelName: room.roomId,
            appId: config.agoraAppId
          }));
          
          return successResponse({ roomCodes: tokens });
        } catch (error) {
          console.error('Error generating Agora tokens:', error);
          set.status = 500;
          return errorResponse('Failed to generate Agora tokens');
        }
      }, {
        params: t.Object({
          id: t.String({ description: 'MongoDB ObjectId of the room' })
        }),
        response: {
          200: GetRoomCodesResponseSchema,
          404: ErrorResponse,
          500: ErrorResponse
        },
        detail: {
          tags: ['Rooms'],
          summary: 'Get Agora Tokens for All Roles',
          description: `
Generates Agora RTC tokens for all roles in a room.

**Roles:**
- \`host\`: Full control over the room (publisher)
- \`co-host\`: Can moderate and manage participants (publisher)
- \`speaker\`: Can speak in the room (publisher)
- \`listener\`: Can only listen (subscriber)

**Note:** This is a public endpoint. For getting a user's specific token, use the /my-code endpoint.
          `
        }
      })
  )

  .guard({
    beforeHandle: authMiddleware
  })
  .group('/protected', (app) =>
    app
      // Get user's specific Agora token based on their role (PROTECTED)
      .get('/:id/my-code', async ({ headers, params, set }) => {
        try {
          const userFid = headers['x-user-privyid'] as string;
          const roomId = params.id;
          
          if (!userFid) {
            set.status = 401;
            return errorResponse('Authentication required');
          }

          const [room, user] = await Promise.all([
            Room.findById(roomId).populate('host', 'fid'),
            User.findOne({ privyId: userFid })
          ]);
          
          if (!room) {
            set.status = 404;
            return errorResponse('Room not found');
          }

          if (!user) {
            set.status = 404;
            return errorResponse('User not found');
          }

          // Determine user's role in the room
          let role: 'host' | 'co-host' | 'speaker' | 'listener' = 'listener';
          
          // Check if user is the host
          if (room.host && (room.host as any).fid === parseInt(userFid)) {
            role = 'host';
          } else {
            // Check if user is a participant with a specific role
            const existingParticipant = await RedisRoomParticipantsService.getParticipant(roomId, userFid);
            if (existingParticipant) {
              role = existingParticipant.role as typeof role;
            }
          }
          
          // Generate Agora token for this user
          const agoraAPI = new AgoraAPI();
          const uid = parseInt(userFid);
          const token = agoraAPI.generateToken(room.roomId, uid, role);

          console.log(`[Agora Token Generation] User FID: ${userFid}, Role: ${role}, Room ID: ${roomId}, token: ${token}`);

          return successResponse({
            role,
            token,
            channelName: room.roomId,
            uid,
            appId: config.agoraAppId
          });
        } catch (error) {
          console.error('Error generating user Agora token:', error);
          set.status = 500;
          return errorResponse('Failed to generate Agora token');
        }
      }, {
        params: t.Object({
          id: t.String({ description: 'MongoDB ObjectId of the room' })
        }),
        response: {
          200: GetMyCodeResponseSchema,
          401: ErrorResponse,
          404: ErrorResponse,
          500: ErrorResponse
        },
        detail: {
          tags: ['Rooms'],
          summary: 'Get My Agora Token',
          description: `
Generates an Agora RTC token for the authenticated user based on their role.

**Role Detection:**
1. If user is the room host → generates publisher token
2. If user is a participant → generates token matching their role
3. Default → generates subscriber (listener) token

**Response:**
- \`role\`: The detected role for the user
- \`token\`: The Agora RTC token for joining
- \`channelName\`: The Agora channel name
- \`uid\`: The user's Agora UID (their FID)
- \`appId\`: The Agora App ID

**Authentication Required:** Yes (Farcaster JWT)
          `,
          security: [{ bearerAuth: [] }]
        }
      })
  );
