import { Elysia, t } from 'elysia';
import User from '../../models/User';
import Room from '../../models/Room';
import RoomParticipant from '../../models/RoomParticipant';
import { RedisRoomParticipantsService, RedisRoomStatisticsService } from '../../services/redis';
import { evaluateAutoAds, forceStopAds } from '../ads';
import { trackViewerJoin, trackViewerLeave } from '../../services/ads/viewTracking';
import { RewardService } from '../../services/rewards/RewardService';
import { XMTPGroupManager, xmtpClientManager } from '../../services/xmtp';
import {
  AddParticipantRequestSchema,
  UpdateParticipantRoleRequestSchema,
} from '../../schemas';
import { HMSAPI } from '../../services/hmsAPI';
import { errorResponse, successResponse, VALID_ROLES, isValidRole } from '../../utils';
import { authMiddleware } from '../../middleware/auth';
import { 
  GetParticipantsResponseSchema, 
  JoinRoomResponseSchema,
  EndRoomResponseSchema,
  LiveParticipantsResponseSchema,
  ParticipantActionResponseSchema,
  LeaveRoomResponseSchema,
  SimpleSuccessResponseSchema,
  ErrorResponse 
} from '../../schemas/documentation';

// Documentation schemas
const ParticipantSchema = t.Object({
  userId: t.String({ description: 'Farcaster ID of the participant' }),
  username: t.String({ description: 'Username' }),
  displayName: t.String({ description: 'Display name' }),
  pfp_url: t.String({ description: 'Profile picture URL' }),
  role: t.Union([
    t.Literal('host'),
    t.Literal('co-host'),
    t.Literal('speaker'),
    t.Literal('listener')
  ], { description: 'Role in the room' }),
  status: t.Optional(t.Union([
    t.Literal('active'),
    t.Literal('inactive')
  ], { description: 'Active status' })),
  joinedAt: t.String({ description: 'ISO timestamp of when they joined' })
});

export const participantRoutes = new Elysia()
  // PUBLIC ROUTES
  .group('/public', (app) =>
    app
      // Get room participants with flexible filtering
      .get('/:id/participants', async ({ params, query, set }) => {
        try {
          const {
            role,
            activeOnly = 'true',
            groupByRole = 'false'
          } = query;

          const isActiveOnly = activeOnly === 'true';
          const shouldGroupByRole = groupByRole === 'true';

          // If specific role is requested
          if (role && typeof role === 'string') {
            if (!isValidRole(role)) {
              set.status = 400;
              return errorResponse(
                `Invalid role parameter. Valid roles are: ${VALID_ROLES.join(', ')}`
              );
            }

            const participants = await RedisRoomParticipantsService.getParticipants(
              params.id,
              role,
              isActiveOnly
            );

            return successResponse({
              role,
              participants,
              count: participants.length,
              filters: { role, activeOnly: isActiveOnly }
            });
          }

          // If grouping by role is requested
          if (shouldGroupByRole) {
            const participantsByRole = await RedisRoomParticipantsService.getParticipants(
              params.id,
              'grouped',
              isActiveOnly
            );

            const totalParticipants = Object.values(participantsByRole)
              .reduce((sum, roleUsers) => sum + (roleUsers as any[]).length, 0);

            return successResponse({
              participantsByRole,
              totalParticipants,
              filters: { activeOnly: isActiveOnly, groupByRole: true }
            });
          }

          // Default: Get all participants as flat list
          const participants = await RedisRoomParticipantsService.getParticipants(params.id, isActiveOnly);

          return successResponse({
            participants,
            count: participants.length,
            filters: { activeOnly: isActiveOnly, groupByRole: false }
          });

        } catch (error) {
          console.error('Error fetching participants:', error);
          set.status = 500;
          return errorResponse('Failed to fetch participants');
        }
      }, {
        params: t.Object({
          id: t.String({ description: 'MongoDB ObjectId of the room' })
        }),
        query: t.Object({
          role: t.Optional(t.String({ 
            description: 'Filter by role: host, co-host, speaker, listener' 
          })),
          activeOnly: t.Optional(t.String({ 
            description: 'Only return active participants (default: true)' 
          })),
          groupByRole: t.Optional(t.String({ 
            description: 'Group results by role (default: false)' 
          }))
        }),
        response: {
          200: GetParticipantsResponseSchema,
          400: ErrorResponse,
          500: ErrorResponse
        },
        detail: {
          tags: ['Participants'],
          summary: 'Get Room Participants',
          description: `
Retrieves participants for a room with flexible filtering options.

**Filtering Options:**
- \`role\`: Filter to specific role (host, co-host, speaker, listener)
- \`activeOnly\`: Show only active participants (default: true)
- \`groupByRole\`: Return participants grouped by their role

**Response Formats:**
1. **Default:** Flat list of all participants with count
2. **By Role:** Single role with count when \`role\` is specified
3. **Grouped:** Object with arrays for each role when \`groupByRole=true\`

**Data Source:** Redis (real-time participant state)

**Note:** This is a public endpoint and does not require authentication.
          `
        }
      })

      .get(`/:id/participants-live`, async ({ params, set }) => {
        try {
          const room = await Room.findById(params.id);
          if (!room) {
            set.status = 404;
            return errorResponse('Room not found');
          }
          const hmsAPI = new HMSAPI();
          const liveParticipants = await hmsAPI.listRoomPeers(room.roomId);
          return successResponse(liveParticipants);
        } catch (error) {
          console.error('Error fetching live participants:', error);
          set.status = 500;
          return errorResponse('Failed to fetch live participants');
        }
      }, {
        params: t.Object({
          id: t.String({ description: 'MongoDB ObjectId of the room' })
        }),
        response: {
          200: LiveParticipantsResponseSchema,
          404: ErrorResponse,
          500: ErrorResponse
        },
        detail: {
          tags: ['Participants'],
          summary: 'Get Live Participants from 100ms',
          description: `
Retrieves the current live participants directly from 100ms API.

**Use Case:** Real-time verification of who is actually connected to the audio room.

**Data Source:** 100ms API (authoritative for actual connections)

**Difference from /participants:**
- This endpoint queries 100ms directly
- /participants queries Redis (our cached state)
- 100ms data may differ slightly due to connection state transitions

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
      // Add participant to room (HOST/ADMIN only)
      .post('/:id/participants', async ({ headers, params, body, set }) => {
        try {
          const { userFid, role = 'listener' } = body;
          const requesterFid = headers['x-user-fid'] as string;

          // Authorization check - only host can add participants
          const requester = await User.findOne({ fid: parseInt(requesterFid) });
          if (!requester) {
            set.status = 404;
            return errorResponse('Requester not found');
          }

          const room = await Room.findById(params.id);
          if (!room) {
            set.status = 404;
            return errorResponse('Room not found');
          }

          // Check if requester is the room host
          if (room.host.toString() !== requester._id.toString()) {
            set.status = 403;
            return errorResponse('Only the room host can add participants');
          }

          // Fetch user data for the participant being added
          const user = await User.findOne({ fid: parseInt(userFid) });
          if (!user) {
            set.status = 404;
            return errorResponse('User not found');
          }

          await RedisRoomParticipantsService.addParticipant(params.id, user.toObject(), role);
          
          // Update peak participant counts
          await RedisRoomStatisticsService.updatePeakCounts(params.id);
          
          return successResponse(undefined, 'Participant added successfully');
        } catch (error) {
          set.status = 500;
          return errorResponse('Failed to add participant');
        }
      }, {
        body: AddParticipantRequestSchema,
        params: t.Object({
          id: t.String({ description: 'MongoDB ObjectId of the room' })
        }),
        response: {
          200: ParticipantActionResponseSchema,
          403: ErrorResponse,
          404: ErrorResponse,
          500: ErrorResponse
        },
        detail: {
          tags: ['Participants'],
          summary: 'Add Participant to Room',
          description: `
Adds a user as a participant to the room.

**Authorization:** Only the room host can add participants.

**Parameters:**
- \`userFid\`: Farcaster ID of the user to add
- \`role\`: Role to assign (default: "listener")

**Valid Roles:** host, co-host, speaker, listener

**Note:** This is for manual participant management. Users typically join via the /join endpoint.

**Authentication Required:** Yes (Farcaster JWT)
          `,
          security: [{ bearerAuth: [] }]
        }
      })

      // Update participant role (HOST/ADMIN only)
      .put('/:id/participants', async ({ headers, params, body, set }) => {
        try {
          const { userFid, newRole } = body;
          const requesterFid = headers['x-user-fid'] as string;

          // Authorization check - only host can update participant roles
          const requester = await User.findOne({ fid: parseInt(requesterFid) });
          if (!requester) {
            set.status = 404;
            return errorResponse('Requester not found');
          }

          const room = await Room.findById(params.id);
          if (!room) {
            set.status = 404;
            return errorResponse('Room not found');
          }

          // Check if requester is the room host
          if (room.host.toString() !== requester._id.toString()) {
            set.status = 403;
            return errorResponse('Only the room host can update participant roles');
          }

          // Additional check: prevent host from changing their own role
          if (userFid === requesterFid) {
            set.status = 400;
            return errorResponse('Host cannot change their own role');
          }

          await RedisRoomParticipantsService.updateParticipantRole(params.id, userFid, newRole);
          
          // Update peak participant counts after role change
          await RedisRoomStatisticsService.updatePeakCounts(params.id);
          
          return successResponse(undefined, 'Participant role updated successfully');
        } catch (error) {
          set.status = 500;
          return errorResponse('Failed to update participant role');
        }
      }, {
        body: UpdateParticipantRoleRequestSchema,
        params: t.Object({
          id: t.String({ description: 'MongoDB ObjectId of the room' })
        }),
        response: {
          200: ParticipantActionResponseSchema,
          400: ErrorResponse,
          403: ErrorResponse,
          404: ErrorResponse,
          500: ErrorResponse
        },
        detail: {
          tags: ['Participants'],
          summary: 'Update Participant Role',
          description: `
Updates the role of a participant in the room.

**Authorization:** Only the room host can update roles.

**Restrictions:**
- Host cannot change their own role
- Only valid roles can be assigned

**Valid Roles:** host, co-host, speaker, listener

**Use Case:** Promoting listeners to speakers, demoting speakers, etc.

**Authentication Required:** Yes (Farcaster JWT)
          `,
          security: [{ bearerAuth: [] }]
        }
      })

      // Remove participant from room (HOST/ADMIN only)
      .delete('/:id/participants', async ({ headers, params, query, set }) => {
        try {
          const { userFid } = query;
          const requesterFid = headers['x-user-fid'] as string;

          if (!userFid) {
            set.status = 400;
            return errorResponse('userFid parameter is required');
          }

          // Authorization check - only host can remove participants
          const requester = await User.findOne({ fid: parseInt(requesterFid) });
          if (!requester) {
            set.status = 404;
            return errorResponse('Requester not found');
          }

          const room = await Room.findById(params.id);
          if (!room) {
            set.status = 404;
            return errorResponse('Room not found');
          }

          // Check if requester is the room host
          if (room.host.toString() !== requester._id.toString()) {
            set.status = 403;
            return errorResponse('Only the room host can remove participants');
          }

          // Additional check: prevent host from removing themselves
          if (userFid === requesterFid) {
            set.status = 400;
            return errorResponse('Host cannot remove themselves from the room');
          }

          await RedisRoomParticipantsService.removeParticipant(params.id, userFid as string);
          await trackViewerLeave(params.id, userFid as string);
          return successResponse(undefined, 'Participant removed successfully');
        } catch (error) {
          set.status = 500;
          return errorResponse('Failed to remove participant');
        }
      }, {
        params: t.Object({
          id: t.String({ description: 'MongoDB ObjectId of the room' })
        }),
        query: t.Object({
          userFid: t.String({ description: 'Farcaster ID of the user to remove' })
        }),
        response: {
          200: ParticipantActionResponseSchema,
          400: ErrorResponse,
          403: ErrorResponse,
          404: ErrorResponse,
          500: ErrorResponse
        },
        detail: {
          tags: ['Participants'],
          summary: 'Remove Participant from Room',
          description: `
Removes a participant from the room (kick functionality).

**Authorization:** Only the room host can remove participants.

**Restrictions:**
- Host cannot remove themselves
- Removal also tracks the viewer leaving for ad analytics

**Side Effects:**
- Participant is removed from Redis
- View tracking is updated

**Authentication Required:** Yes (Farcaster JWT)
          `,
          security: [{ bearerAuth: [] }]
        }
      })

      // Join room (Any authenticated user)
      .post('/:id/join', async ({ headers, params, set }) => {
        try {
          const userFid = headers['x-user-fid'] as string;
          const role = 'listener'; // Default role for joining

          if (!userFid) {
            set.status = 400;
            return errorResponse('Authentication required');
          }

          // Get user data
          const user = await User.findOne({ fid: parseInt(userFid) });
          if (!user) {
            set.status = 404;
            return errorResponse('User not found');
          }

          // Check if user is already a participant to avoid duplicates
          const participants = await RedisRoomParticipantsService.getParticipants(params.id);
          const existingParticipant = participants.find((p: any) => p.userId === userFid);

          if (existingParticipant) {
            await RedisRoomParticipantsService.updateParticipantStatus(params.id, userFid, 'active');
            await trackViewerJoin(params.id, userFid);
            evaluateAutoAds(params.id).catch((err) => console.error('[ads:auto] join evaluation failed', err));
            return successResponse({
              participant: existingParticipant
            }, 'User already a participant');
          }

          // Add participant to room with listener role by default
          await RedisRoomParticipantsService.addParticipant(params.id, user.toObject(), role);
          await trackViewerJoin(params.id, user.fid.toString());
          evaluateAutoAds(params.id).catch((err) => console.error('[ads:auto] join evaluation failed', err));
          
          // Update peak participant counts
          await RedisRoomStatisticsService.updatePeakCounts(params.id);

          // Add participant to XMTP group if it exists
          try {
            const groupId = await XMTPGroupManager.getGroupId(params.id);
            if (groupId && user.wallet) {
              // Try to get user's XMTP client from cache
              const userClient = xmtpClientManager.getClient(userFid);
              
              if (userClient) {
                await XMTPGroupManager.addParticipant(
                  userClient,
                  groupId,
                  user.wallet
                );
                console.log(`Added user ${userFid} to XMTP group ${groupId}`);
              } else {
                console.log(`XMTP client not available for user ${userFid}, will be added when they initialize XMTP`);
              }
            }
          } catch (xmtpError) {
            console.error('Failed to add participant to XMTP group:', xmtpError);
            // Don't fail room join if XMTP fails
          }

          const participant = {
            userId: user.fid,
            username: user.username,
            displayName: user.displayName,
            pfp_url: user.pfp_url,
            role: role,
            joinedAt: new Date().toISOString()
          };

          return successResponse({ participant }, 'Participant joined successfully');
        } catch (error) {
          console.error('Error adding participant on join:', error);
          set.status = 500;
          return errorResponse('Failed to add participant');
        }
      }, {
        params: t.Object({
          id: t.String({ description: 'MongoDB ObjectId of the room' })
        }),
        response: {
          200: JoinRoomResponseSchema,
          400: ErrorResponse,
          404: ErrorResponse,
          500: ErrorResponse
        },
        detail: {
          tags: ['Participants'],
          summary: 'Join Room',
          description: `
Allows an authenticated user to join a room as a listener.

**Behavior:**
- New users are added with "listener" role
- Existing participants are marked as "active" (re-join scenario)
- Triggers ad evaluation (may start ads if threshold met)
- Tracks viewer join for ad analytics

**Side Effects:**
- User added to Redis participant list
- View tracking updated
- Auto-ads evaluation triggered

**Note:** All users join as listeners. Use role update for promotion.

**Authentication Required:** Yes (Farcaster JWT)
          `,
          security: [{ bearerAuth: [] }]
        }
      })

      // Leave room (Any authenticated user)
      .post('/:id/leave', async ({ headers, params, set }) => {
        try {
          const userFid = headers['x-user-fid'] as string;

          if (!userFid) {
            set.status = 400;
            return errorResponse('Authentication required');
          }

          // Mark participant as inactive instead of removing them
          await RedisRoomParticipantsService.updateParticipantStatus(params.id, userFid, 'inactive');
          await trackViewerLeave(params.id, userFid);
          return successResponse(undefined, 'Participant left successfully');
        } catch (error) {
          console.error('Error removing participant on leave:', error);
          set.status = 500;
          return errorResponse('Failed to remove participant');
        }
      }, {
        params: t.Object({
          id: t.String({ description: 'MongoDB ObjectId of the room' })
        }),
        response: {
          200: LeaveRoomResponseSchema,
          400: ErrorResponse,
          500: ErrorResponse
        },
        detail: {
          tags: ['Participants'],
          summary: 'Leave Room',
          description: `
Allows an authenticated user to leave a room.

**Behavior:**
- Marks participant as "inactive" (not deleted)
- Allows for re-join detection
- Updates view tracking for ad analytics

**Design Choice:** Participants are marked inactive rather than deleted to:
- Preserve join history
- Enable accurate ad view calculations
- Allow seamless re-joining

**Authentication Required:** Yes (Farcaster JWT)
          `,
          security: [{ bearerAuth: [] }]
        }
      })

      // End room (HOST only)
      .post('/:id/end', async ({ headers, params, set }) => {
        try {
          const userFid = headers['x-user-fid'] as string;
          const roomId = params.id;

          if (!userFid) {
            set.status = 400;
            return errorResponse('Authentication required');
          }

          const user = await User.findOne({ fid: parseInt(userFid) });
          if (!user) {
            set.status = 404;
            return errorResponse('User not found');
          }

          const room = await Room.findById(roomId);

          if (!room) {
            set.status = 404;
            return errorResponse('Room not found');
          }

          if (room.host.toString() !== user._id.toString()) {
            set.status = 403;
            return errorResponse('Only the host can end the room');
          }

          // End room in HMS
          try {
            const hmsAPI = new HMSAPI();
            await hmsAPI.endRoom(room.roomId);
            console.log('Room successfully ended in HMS');
          } catch (hmsError) {
            console.error('Error ending room in HMS:', hmsError);
          }

          const roles = ['host', 'co-host', 'speaker', 'listener'];
          let totalParticipants = 0;
          const roleBreakdown = {
            hosts: 0,
            coHosts: 0,
            speakers: 0,
            listeners: 0
          };

          try {
            // Get all participants grouped by role
            const groupedParticipants = await RedisRoomParticipantsService.getParticipants(
              params.id,
              'grouped',
              false
            );

            // Collect all FIDs and get user data
            const allFids = new Set<string>();
            for (const role of roles) {
              const roleParticipants = groupedParticipants[role as keyof typeof groupedParticipants] || [];
              roleParticipants.forEach(participant => {
                if (participant.userId) {
                  allFids.add(participant.userId);
                }
              });
            }

            if (allFids.size > 0) {
              const users = await User.find({
                fid: { $in: Array.from(allFids) }
              }).select('_id fid').lean();

              const fidToIdMap = new Map(users.map((user: any) => [user.fid, user._id]));

              const participantRecords = [];

              for (const role of roles) {
                const roleParticipants = groupedParticipants[role as keyof typeof groupedParticipants] || [];

                for (const participant of roleParticipants) {
                  const mongoId = fidToIdMap.get(participant.userId);
                  if (mongoId) {
                    participantRecords.push({
                      roomId: roomId,
                      userId: mongoId,
                      role: role,
                      joinedAt: new Date(participant.joinedAt || room.startTime),
                      leftAt: new Date()
                    });

                    totalParticipants++;
                    switch (role) {
                      case 'host':
                        roleBreakdown.hosts++;
                        break;
                      case 'co-host':
                        roleBreakdown.coHosts++;
                        break;
                      case 'speaker':
                        roleBreakdown.speakers++;
                        break;
                      case 'listener':
                        roleBreakdown.listeners++;
                        break;
                    }
                  }
                }
              }

              // Insert participant records
              if (participantRecords.length > 0) {
                try {
                  await RoomParticipant.insertMany(participantRecords, {
                    ordered: false
                  });
                  console.log(`Created ${participantRecords.length} participant records`);
                } catch (error: any) {
                  if (error.code === 11000) {
                    console.log('Some participant records already exist - this is normal');
                  } else {
                    console.error('Error creating participant records:', error);
                  }
                }
              }
            }
          } catch (error) {
            console.error('Error processing participants:', error);
          }

          // Update room status
          const updatedRoom = await Room.findByIdAndUpdate(
            roomId,
            {
              enabled: false,
              ended_at: new Date(),
              status: 'ended'
            },
            { new: true }
          );

          if (!updatedRoom) {
            set.status = 500;
            return errorResponse('Failed to update room');
          }

          if (updatedRoom.adsEnabled !== false) {
            try {
              const stopResult = await forceStopAds(roomId, 'room_ended');
              if (stopResult?.stopped) {
                console.log(`[ads] Ads stopped for room ${roomId} - payout will be processed by daily cron`);
              } else {
                console.warn(`[ads] Failed to stop ads for room ${roomId}`);
              }
            } catch (stopError) {
              console.error(`[ads] Failed to stop ads for room ${roomId}`, stopError);
            }
          }

          // Create next occurrence if recurring
          if (updatedRoom.isRecurring) {
            try {
              const { calculateNextOccurrence, createNextOccurrence } = await import('../../cron/room-cleanup');
              await createNextOccurrence(updatedRoom);
            } catch (recurError) {
              console.error('Error creating next occurrence:', recurError);
            }
          }

          // Distribute hosting rewards
          let rewardDistribution = null;
          try {
            const rewardResult = await RewardService.distributeHostingRewards(roomId);
            if (rewardResult.success) {
              rewardDistribution = rewardResult.reward;
              console.log('✅ Hosting rewards distributed successfully', rewardDistribution);
            }
          } catch (rewardError) {
            console.error('⚠️ Error distributing hosting rewards:', rewardError);
            // Don't fail the entire endpoint if rewards fail
          }

          return successResponse({
            room: updatedRoom,
            participantCount: totalParticipants,
            roleBreakdown,
            rewards: rewardDistribution
          }, 'Room ended successfully');
        } catch (error) {
          console.error('Error ending room:', error);
          set.status = 500;
          return errorResponse('Internal server error');
        }
      }, {
        params: t.Object({
          id: t.String({ description: 'MongoDB ObjectId of the room' })
        }),
        response: {
          200: EndRoomResponseSchema,
          400: ErrorResponse,
          403: ErrorResponse,
          404: ErrorResponse,
          500: ErrorResponse
        },
        detail: {
          tags: ['Participants'],
          summary: 'End Room',
          description: `
Ends a room session completely.

**Authorization:** Only the room host can end the room.

**Actions Performed:**
1. Ends the room in 100ms (disconnects all participants)
2. Persists all participant records to MongoDB
3. Updates room status to "ended" and \`enabled: false\`
4. Stops any running ad session
5. Triggers ad revenue distribution if ads were enabled

**Response Includes:**
- Updated room object
- Total participant count
- Breakdown by role (hosts, co-hosts, speakers, listeners)

**Ad Revenue Distribution:**
If ads were enabled, this endpoint triggers the payout calculation and distribution process asynchronously.

**Authentication Required:** Yes (Farcaster JWT)
          `,
          security: [{ bearerAuth: [] }]
        }
      })
  );
