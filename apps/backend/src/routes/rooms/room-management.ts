import { Elysia, t } from "elysia";
import mongoose from "mongoose";
import Room from "../../models/Room";
import User from "../../models/User";
import RoomParticipant from "../../models/RoomParticipant";
import {
  RoomUpdateRequestSchema,
  CreateRoomProtectedRequestSchema,
} from "../../schemas";
import { errorResponse, successResponse, isValidRoomStatus } from "../../utils";
import { authMiddleware } from "../../middleware/auth";
import { HMSAPI } from "../../services/hmsAPI";
import { RedisRoomParticipantsService } from "../../services/redis";
import { RedisTippingService } from "../../services/redis/tippingDetails";
import { trackViewerJoin } from "../../services/ads/viewTracking";
import { evaluateAutoAds, forceStopAds } from "../ads";
import { announceFiresideLive, announceFiresideScheduled } from "../../services/xBot";
import { getSystemClient, createXMTPGroup } from "../../services/xmtp";
import "../../config/database";
import { 
  GetRoomsResponseSchema, 
  GetRoomResponseSchema, 
  GetBulkRoomsResponseSchema,
  GetRoomsByTopicsResponseSchema,
  GetRecordingsResponseSchema,
  CreateRoomResponseSchema,
  GetUpcomingRoomsResponseSchema,
  StartRoomResponseSchema,
  UpdateRoomResponseSchema,
  ErrorResponse,
  SimpleSuccessResponseSchema
} from "../../schemas/documentation";

// Common response schemas for documentation
const RoomHostSchema = t.Object({
  fid: t.Number({ description: 'Farcaster ID of the host' }),
  username: t.String({ description: 'Username of the host' }),
  displayName: t.String({ description: 'Display name of the host' }),
  pfp_url: t.String({ description: 'Profile picture URL' })
});

const RoomResponseSchema = t.Object({
  _id: t.String({ description: 'MongoDB ObjectId of the room' }),
  name: t.String({ description: 'Room name' }),
  description: t.Optional(t.String({ description: 'Room description' })),
  host: RoomHostSchema,
  roomId: t.String({ description: '100ms room ID' }),
  status: t.Union([t.Literal('upcoming'), t.Literal('ongoing'), t.Literal('ended')]),
  startTime: t.String({ description: 'ISO date string of room start time' }),
  endTime: t.Optional(t.String({ description: 'ISO date string of room end time' })),
  enabled: t.Boolean({ description: 'Whether the room is enabled' }),
  topics: t.Array(t.String(), { description: 'Array of topic tags' }),
  adsEnabled: t.Optional(t.Boolean({ description: 'Whether ads are enabled for this room' })),
  strength: t.Optional(t.Number({ description: 'Current participant count' }))
});

export const roomManagementRoutes = new Elysia()
  .group("/public", (app: any) =>
    app
      // Get all enabled rooms
      .get("/", async ({ set }: any) => {
        try {
          const rooms = await Room.find({ enabled: true })
            .sort({ createdAt: -1 })
            .lean();

          console.log("Fetched rooms:", rooms.length);

          // Extract unique host IDs and fetch their User documents
          const uniqueHostIds = new Set<string>();
          rooms.forEach((room: any) => {
            if (room.host) {
              uniqueHostIds.add(room.host.toString());
            }
          });

          // Fetch User documents to get FIDs
          const hostUsers = await User.find({
            _id: { $in: Array.from(uniqueHostIds) }
          }).lean();

          // Create a map of userId to FID
          const userIdToFidMap: Record<string, number> = {};
          hostUsers.forEach((user: any) => {
            userIdToFidMap[user._id.toString()] = user.fid;
          });

          console.log("User ID to FID map:", userIdToFidMap);

          // Extract unique FIDs
          const uniqueFids = new Set<number>();
          rooms.forEach((room: any) => {
            if (room.host) {
              const fid = userIdToFidMap[room.host.toString()];
              if (fid) {
                uniqueFids.add(fid);
              }
            }
          });

          console.log("UNique FIDS", uniqueFids);

          // Fetch host details from Neynar API
          const fidsArray = Array.from(uniqueFids);
          let hostMap: Record<string, any> = {}; // Map userId to host details
          
          if (fidsArray.length > 0) {
            try {
              const res = await fetch(
                `https://api.neynar.com/v2/farcaster/user/bulk?fids=${fidsArray.join(',')}`,
                {
                  headers: {
                    "x-api-key": process.env.NEYNAR_API_KEY as string,
                  },
                }
              );
              const data = await res.json();

              console.log("Neynar host details response:", data);
              
              // Create a map of userId to user details
              if (data.users) {
                // Create reverse map: fid to userId
                const fidToUserIdMap: Record<number, string> = {};
                Object.entries(userIdToFidMap).forEach(([userId, fid]) => {
                  fidToUserIdMap[fid] = userId;
                });

                data.users.forEach((user: any) => {
                  const userId = fidToUserIdMap[user.fid];
                  if (userId) {
                    hostMap[userId] = {
                      fid: user.fid,
                      username: user.username,
                      displayName: user.display_name,
                      pfp_url: user.pfp_url,
                    };
                  }
                });
              }
            } catch (error) {
              console.error("Error fetching host details from Neynar:", error);
            }
          }

          // Get the active participants count for each room using HMS API
          const hmsAPI = new HMSAPI();

          console.log("HOST MAP", hostMap);

          // Add strength field and host details to each room
          const roomsWithStrength = await Promise.all(
            rooms.map(async (room: any) => {
              try {
                console.log("Fetching peers for room:", room.roomId);
                // Call HMS API to get peers for this room
                const peersData = await hmsAPI.listRoomPeers(room.roomId);
                console.log("This is peers data", peersData, room.roomId);
                // Add strength field and host details
                return {
                  ...room,
                  host: hostMap[room.host.toString()] || null,
                  strength: peersData.count,
                };
              } catch (error) {
                console.error(
                  `Failed to get peers for room ${room.roomId}:`,
                  error
                );
                // Return room with zero strength if we can't get the count
                return {
                  ...room,
                  host: hostMap[room.host.toString()] || null,
                  strength: 0,
                };
              }
            })
          );

          console.log("Rooms with strength:", roomsWithStrength);

          return successResponse({ rooms: roomsWithStrength });
        } catch (error) {
          set.status = 500;
          return errorResponse(
            "Failed to fetch rooms",
            error instanceof Error ? error.message : "Unknown error"
          );
        }
      }, {
        response: {
          200: GetRoomsResponseSchema,
          500: ErrorResponse
        },
        detail: {
          tags: ['Rooms'],
          summary: 'Get All Active Rooms',
          description: `
Retrieves all enabled/active rooms with their current participant counts.

**Features:**
- Returns rooms sorted by creation date (newest first)
- Includes host profile information from Farcaster
- Includes real-time participant count (strength) from 100ms
- Only returns rooms where \`enabled: true\`

**Note:** This is a public endpoint and does not require authentication.
          `
        }
      })

      // Get room by ID
      .get("/:id", async ({ params, set }: any) => {
        try {
          console.log("Fetching room by ID:", params.id);
          const room = await Room.findById(params.id)
            .populate("host", "fid username displayName pfp_url")
            .lean();

          console.log("Room fetched by ID:", room);

          if (!room) {
            set.status = 404;
            return errorResponse("Room not found");
          }

          // Get participants with their user details
          const participantRecords = await RoomParticipant.find({
            roomId: params.id,
          })
            .populate("userId", "fid username displayName pfp_url")
            .lean();

          // Transform participants to include role and joinedAt
          const participants = participantRecords.map((participant) => ({
            ...participant.userId,
            role: participant.role,
            joinedAt: participant.joinedAt,
          }));

          const roomWithParticipants = {
            ...room,
            participants,
          };

          console.log("Fetched room:", roomWithParticipants);

          return successResponse({ room: roomWithParticipants });
        } catch (error) {
          set.status = 500;
          console.log("Error fetching room by ID:", error);
          return errorResponse("Failed to fetch room");
        }
      }, {
        params: t.Object({
          id: t.String({ description: 'MongoDB ObjectId of the room' })
        }),
        response: {
          200: GetRoomResponseSchema,
          404: ErrorResponse,
          500: ErrorResponse
        },
        detail: {
          tags: ['Rooms'],
          summary: 'Get Room by ID',
          description: `
Retrieves a single room by its MongoDB ObjectId.

**Returns:**
- Full room details including host information
- List of all participants with their roles and join times

**Note:** This is a public endpoint and does not require authentication.
          `
        }
      })

      // Get multiple rooms by IDs
      .post(
        "/bulk",
        async ({ body, set }: any) => {
          try {
            const { ids } = body;

            if (!Array.isArray(ids) || ids.length === 0) {
              set.status = 400;
              return errorResponse("Room IDs array is required");
            }

            const rooms = await Room.find({
              _id: { $in: ids },
              enabled: true,
            })
              .populate("host", "fid username displayName pfp_url")
              .sort({ createdAt: -1 })
              .lean();

            // Get participants for all rooms
            const roomIds = rooms.map((room: any) => room._id);
            const allParticipantRecords = await RoomParticipant.find({
              roomId: { $in: roomIds },
            })
              .populate("userId", "fid username displayName pfp_url")
              .lean();

            // Group participants by room ID
            const participantsByRoom: Record<string, any[]> =
              allParticipantRecords.reduce(
                (acc: Record<string, any[]>, participant: any) => {
                  const roomId = participant.roomId.toString();
                  if (!acc[roomId]) {
                    acc[roomId] = [];
                  }
                  acc[roomId].push({
                    ...participant.userId,
                    role: participant.role,
                    joinedAt: participant.joinedAt,
                  });
                  return acc;
                },
                {}
              );

            // Add participants to each room
            const roomsWithParticipants = rooms.map((room: any) => ({
              ...room,
              participants: participantsByRoom[room._id.toString()] || [],
            }));

            return successResponse({ rooms: roomsWithParticipants });
          } catch (error) {
            console.error("Error fetching rooms by IDs:", error);
            set.status = 500;
            return errorResponse(
              "Failed to fetch rooms by IDs",
              error instanceof Error ? error.message : "Unknown error"
            );
          }
        },
        {
          body: t.Object({
            ids: t.Array(t.String(), { 
              description: 'Array of MongoDB ObjectIds',
              minItems: 1
            })
          }),
          response: {
            200: GetBulkRoomsResponseSchema,
            400: ErrorResponse,
            500: ErrorResponse
          },
          detail: {
            tags: ['Rooms'],
            summary: 'Get Multiple Rooms by IDs',
            description: `
Retrieves multiple rooms by their MongoDB ObjectIds in a single request.

**Use Case:** Efficient batch fetching when you have a list of room IDs.

**Features:**
- Only returns enabled rooms
- Includes host and participant information for each room
- Results sorted by creation date (newest first)

**Note:** This is a public endpoint and does not require authentication.
            `
          }
        }
      )

      // Get recordings for a room
      .get("/:id/recordings", async ({ params, set }: any) => {
        try {
          const room = await Room.findOne({ roomId: params.id });

          if (!room) {
            set.status = 404;
            return errorResponse("Room not found");
          }

          // Check if recording was enabled for this room
          if (!room.recordingEnabled) {
            return successResponse({ recordings: [], message: "Recording was not enabled for this room" });
          }

          const hmsAPI = new HMSAPI();
          const recordingsData = await hmsAPI.getRecordingAssets(room.roomId);

          return successResponse({ recordings: recordingsData });
        } catch (error) {
          console.error("Error fetching recording assets:", error);
          set.status = 500;
          return errorResponse(
            "Failed to fetch recording assets",
            error instanceof Error ? error.message : "Unknown error"
          );
        }
      }, {
        params: t.Object({
          id: t.String({ description: '100ms room ID' })
        }),
        response: {
          200: GetRecordingsResponseSchema,
          404: ErrorResponse,
          500: ErrorResponse
        },
        detail: {
          tags: ['Rooms'],
          summary: 'Get Room Recordings',
          description: `
Retrieves recording assets for a room from 100ms.

**Note:** The \`id\` parameter should be the 100ms room ID, not the MongoDB ObjectId.

**Returns:**
- List of available recording assets
- Recording metadata including duration and URLs

**Note:** This is a public endpoint and does not require authentication.
          `
        }
      })

      // Get rooms by topics
      .post(
        "/by-topics",
        async ({ body, set }: any) => {
          try {
            const { topics } = body;
            if (!Array.isArray(topics) || topics.length === 0) {
              set.status = 400;
              return errorResponse("No topics provided");
            }

            const rooms = await Room.find({
              topics: { $in: topics },
              // enabled: true
            })
              .select(
                "name description host status startTime endTime topics roomId enabled"
              )
              .populate("host", "fid username displayName pfp_url")
              .sort({ createdAt: -1 })
              .limit(10)
              .lean();

            // console.log("Rooms found for topics", topics, rooms);

            return successResponse({ rooms });
          } catch (error) {
            console.error("Error fetching rooms by topics:", error);
            set.status = 500;
            return errorResponse(
              "Failed to fetch rooms by topics",
              error instanceof Error ? error.message : "Unknown error"
            );
          }
        },
        {
          body: t.Object({
            topics: t.Array(t.String(), {
              description: 'Array of topic tags to filter by',
              minItems: 1
            })
          }),
          response: {
            200: GetRoomsByTopicsResponseSchema,
            400: ErrorResponse,
            500: ErrorResponse
          },
          detail: {
            tags: ['Rooms'],
            summary: 'Get Rooms by Topics',
            description: `
Retrieves rooms that match any of the provided topics.

**Features:**
- Filters rooms by topic tags (uses \`$in\` - matches any topic)
- Returns up to 10 rooms per request
- Results sorted by creation date (newest first)

**Use Case:** Content discovery based on user interests.

**Note:** This is a public endpoint and does not require authentication.
            `
          }
        }
      )

      // Get rooms with recording enabled
      .get('/recorded', async ({ set }: any) => {
        try {
          const rooms = await Room.find({ 
            status: "ended",
            $or: [
              { recordingEnabled: true },
              { ended_at: { $lt: new Date('2026-01-15') } }
            ]
          })
            .populate('host', 'fid username displayName pfp_url')
            .sort({ createdAt: -1 })
            .limit(10)
            .lean();

          const formattedRooms = rooms.map((room: any) => ({
            _id: room._id.toString(),
            name: room.name,
            description: room.description || "",
            host: {
              fid: Number(room.host?.fid),
              username: room.host?.username || "",
              displayName: room.host?.displayName || "",
              pfp_url: room.host?.pfp_url || ""
            },
            roomId: room.roomId || "",
            status: room.status,
            startTime: room.startTime?.toISOString(),
            endTime: room.endTime ? room.endTime.toISOString() : undefined,
            enabled: room.enabled,
            topics: room.topics || [],
            adsEnabled: room.adsEnabled
          }));

          console.log("Fetched recorded rooms:", formattedRooms.length);

          return successResponse({ rooms: formattedRooms });
        } catch (error) {
          console.error('Error fetching recorded rooms:', error);
          set.status = 500;
          return errorResponse(
            'Failed to fetch recorded rooms',
            error instanceof Error ? error.message : 'Unknown error'
          );
        }
      }, {
        response: {
          200: t.Object({
            success: t.Boolean(),
            data: t.Object({
              rooms: t.Array(RoomResponseSchema)
            })
          }),
          500: ErrorResponse
        },
        detail: {
          tags: ['Rooms'],
          summary: 'Get Rooms with Recording Enabled',
          description: 'Retrieves all enabled rooms that have recording enabled.'
        }
      })

      // Get live rooms with tip statistics
      .get('/live-tips', async ({ set }: any) => {
        try {
          // Fetch all ongoing rooms
          const ongoingRooms = await Room.find({ 
            status: 'ongoing', 
            enabled: true 
          })
            .populate('host', 'fid username displayName pfp_url')
            .sort({ createdAt: -1 })
            .lean();

          // Fetch tip statistics for each room in parallel
          const roomsWithTips = await Promise.all(
            ongoingRooms.map(async (room:any) => {
              try {
                const statistics = await RedisTippingService.getTipStatistics(room.roomId);
                
                return {
                  roomId: room._id.toString(),
                  hmsRoomId: room.roomId,
                  name: room.name,
                  description: room.description,
                  host: room.host,
                  topics: room.topics,
                  startTime: room.startTime,
                  statistics: {
                    totalTipsUSD: statistics.totalTipsUSD,
                    totalTipsByUsers: statistics.totalTipsByUsers,
                    tipsByCurrency: statistics.tipsByCurrency,
                    // Only include summary, not full tip history for performance
                  }
                };
              } catch (error) {
                // If tip fetching fails for a room, return room with zero tips
                console.error(`Error fetching tips for room ${room.roomId}:`, error);
                return {
                  roomId: room._id.toString(),
                  hmsRoomId: room.roomId,
                  name: room.name,
                  description: room.description,
                  host: room.host,
                  topics: room.topics,
                  startTime: room.startTime,
                  statistics: {
                    totalTipsUSD: 0,
                    totalTipsByUsers: 0,
                    tipsByCurrency: {
                      ETH: { count: 0, totalUSD: 0, totalNative: 0 },
                      USDC: { count: 0, totalUSD: 0, totalNative: 0 },
                      FIRE: { count: 0, totalUSD: 0, totalNative: 0 },
                    }
                  }
                };
              }
            })
          );

          // Sort by total tips (highest first)
          const sortedRooms = roomsWithTips.sort((a, b) => 
            b.statistics.totalTipsUSD - a.statistics.totalTipsUSD
          );

          return successResponse({ 
            rooms: sortedRooms,
            count: sortedRooms.length 
          });
        } catch (error) {
          console.error('Error fetching live rooms with tips:', error);
          set.status = 500;
          return errorResponse(
            'Failed to fetch live rooms with tip statistics',
            error instanceof Error ? error.message : 'Unknown error'
          );
        }
      }, {
        response: {
          200: t.Object({
            success: t.Boolean(),
            data: t.Object({
              rooms: t.Array(t.Object({
                roomId: t.String({ description: 'MongoDB ObjectId' }),
                hmsRoomId: t.String({ description: '100ms room ID' }),
                name: t.String({ description: 'Room name' }),
                description: t.Optional(t.String({ description: 'Room description' })),
                host: RoomHostSchema,
                topics: t.Array(t.String()),
                startTime: t.String(),
                statistics: t.Object({
                  totalTipsUSD: t.Number(),
                  totalTipsByUsers: t.Number(),
                  tipsByCurrency: t.Object({
                    ETH: t.Object({
                      count: t.Number(),
                      totalUSD: t.Number(),
                      totalNative: t.Number(),
                    }),
                    USDC: t.Object({
                      count: t.Number(),
                      totalUSD: t.Number(),
                      totalNative: t.Number(),
                    }),
                    FIRE: t.Object({
                      count: t.Number(),
                      totalUSD: t.Number(),
                      totalNative: t.Number(),
                    }),
                  })
                })
              })),
              count: t.Number({ description: 'Total number of live rooms' })
            })
          }),
          500: ErrorResponse
        },
        detail: {
          tags: ['Rooms'],
          summary: 'Get Live Rooms with Tip Statistics',
          description: `
Retrieves all ongoing rooms with their aggregated tip statistics.

**Features:**
- Fetches only ongoing (live) rooms
- Includes tip statistics for each room (total USD, tips by currency)
- Sorted by total tips (highest first)
- Gracefully handles rooms with no tips or tip fetching errors

**Use Case:** Display trending rooms by tipping activity on the main page.

**Performance Note:** For many live rooms, consider adding caching (30-60s) to reduce Redis load.

**Note:** This is a public endpoint and does not require authentication.
          `
        }
      })
  )

  .group(
    "/protected",
    (app: any) =>
      app
        .guard({
          beforeHandle: authMiddleware,
        })

        .get("/upcoming", async ({ headers, set }:any) => {
          try {
            const userFid = headers["x-user-fid"] as string;

            if (!userFid) {
              set.status = 401;
              return errorResponse("User authentication required");
            }

            const user = await User.findOne({ fid: parseInt(userFid) });
            if (!user) {
              set.status = 404;
              return errorResponse("User not found");
            }

            console.log(
              `[Upcoming Rooms] Fetching upcoming rooms for user FID: ${userFid}`
            );

            const upcomingRooms = await Room.find({
              host: user._id,
              status: "upcoming",
              enabled: true,
            })
              .sort({ startTime: 1 }) // Sort by start time ascending (earliest first)
              .populate("host", "fid username displayName pfp_url")
              .lean();

            console.log(
              `[Upcoming Rooms] Found ${upcomingRooms.length} upcoming rooms for user FID: ${userFid}`
            );

            return successResponse({ rooms: upcomingRooms });
          } catch (error) {
            console.error("Error fetching upcoming rooms:", error);
            set.status = 500;
            return errorResponse(
              "Failed to fetch upcoming rooms",
              error instanceof Error ? error.message : "Unknown error"
            );
          }
        }, {
          response: {
            200: GetUpcomingRoomsResponseSchema,
            401: ErrorResponse,
            404: ErrorResponse,
            500: ErrorResponse
          },
          detail: {
            tags: ['Rooms'],
            summary: 'Get My Upcoming Rooms',
            description: `
Retrieves all upcoming rooms hosted by the authenticated user.

**Features:**
- Only returns rooms with \`status: "upcoming"\` and \`enabled: true\`
- Sorted by start time (earliest first)
- Useful for dashboard/scheduling views

**Authentication Required:** Yes (Farcaster JWT)
            `,
            security: [{ bearerAuth: [] }]
          }
        })
        // Non-transactional version for standalone MongoDB
        .post(
          "/",
          async ({ headers, body, set }: any) => {
            let savedRoom: any = null;
            let hmsRoom: any = null;

            try {
              const { name, description, startTime, topics, adsEnabled, isRecurring, recurrenceType, recordingEnabled } = body;
              const userFid = headers["x-user-fid"] as string;

              const hostUser = await User.findOne({ fid: parseInt(userFid) });
              if (!hostUser) {
                set.status = 404;
                return errorResponse("Host user not found");
              }
              const resolvedAdsEnabled =
                typeof adsEnabled === "boolean"
                  ? adsEnabled
                  : Boolean((hostUser as any).autoAdsEnabled);

              const hmsAPI = new HMSAPI();

              //trim the name off any symbols or digits and append Date.now() to ensure uniqueness
              const trimmedName = name.replace(/[^\w\s]/gi, "").trim();
              const uniqueName = `${trimmedName}-${Date.now()}`;

              const currentTime = new Date();
              const roomStartTime = new Date(startTime);

              if (currentTime > roomStartTime) {
                try {
                  hmsRoom = await hmsAPI.createRoom(
                    uniqueName,
                    description || ""
                  );
                } catch (error) {
                  console.error("Error creating room in 100ms:", error);
                  set.status = 500;
                  return errorResponse(
                    "Failed to create room in 100ms service"
                  );
                }

                try {
                  await hmsAPI.generateRoomCodes(hmsRoom.id);
                } catch (error) {
                  console.error("Error generating room codes:", error);
                  set.status = 500;
                  return errorResponse("Failed to generate room codes");
                }
              }

              const calculatedRecurrenceDay = isRecurring && recurrenceType === 'weekly' 
                ? roomStartTime.getDay() 
                : null;

              const room = new Room({
                name,
                description: description || "",
                host: hostUser._id,
                startTime: roomStartTime,
                roomId: hmsRoom ? hmsRoom.id : "",
                status: currentTime < roomStartTime ? "upcoming" : "ongoing",
                enabled: true,
                topics,
                adsEnabled: resolvedAdsEnabled,
                isRecurring: isRecurring || false,
                recurrenceType: recurrenceType || null,
                recurrenceDay: calculatedRecurrenceDay,
                parentRoomId: null,
                occurrenceNumber: isRecurring ? 1 : null,
                recordingEnabled: recordingEnabled !== undefined ? recordingEnabled : true,
              });

              try {
                savedRoom = await room.save();

                // Create host participant record
                if (savedRoom) {
                  await RoomParticipant.create({
                    roomId: savedRoom._id,
                    userId: hostUser._id,
                    role: "host",
                    joinedAt: new Date(),
                  });
                }
              } catch (error) {
                throw error;
              }

              if (savedRoom) {
                await savedRoom.populate(
                  "host",
                  "fid username displayName pfp_url"
                );
              }

              // Create XMTP group for the room
              if (savedRoom) {
                try {
                  console.log(`Creating XMTP group for room ${savedRoom._id}...`);
                  const xmtpClient = await getSystemClient();
                  const groupId = await createXMTPGroup(
                    xmtpClient,
                    savedRoom._id.toString()
                  );
                  
                  // Update room with XMTP group ID
                  savedRoom.xmtpGroupId = groupId;
                  await savedRoom.save();
                  
                  console.log(`✅ XMTP group ${groupId} created for room ${savedRoom._id}`);
                } catch (xmtpError) {
                  // Don't fail room creation if XMTP fails
                  console.error('Failed to create XMTP group:', xmtpError);
                }
              }

              try {
                if (savedRoom) {
                  const roomId = savedRoom._id.toString();
                  await RedisRoomParticipantsService.addParticipant(
                    roomId,
                    hostUser.toObject(),
                    "host"
                  );
                  await trackViewerJoin(roomId, hostUser.fid.toString());
                  console.log("Host added to Redis participants successfully");
                }
              } catch (redisError) {
                console.error("Failed to add host to Redis:", redisError);
              }

              // Announce on X
              if (savedRoom && savedRoom.status === "ongoing") {
                // Room is going live immediately
                announceFiresideLive({
                  id: savedRoom._id.toString(),
                  name: savedRoom.name,
                  description: savedRoom.description,
                  hostDisplayName: savedRoom.host?.displayName || hostUser.displayName,
                  hostUsername: savedRoom.host?.username || hostUser.username,
                  hostFid: hostUser.fid,
                  topics: savedRoom.topics
                }).catch(err => console.error("[X Bot] Live announcement failed:", err));
              } else if (savedRoom && savedRoom.status === "upcoming") {
                // Room is scheduled for later
                announceFiresideScheduled({
                  id: savedRoom._id.toString(),
                  name: savedRoom.name,
                  description: savedRoom.description,
                  hostDisplayName: savedRoom.host?.displayName || hostUser.displayName,
                  hostUsername: savedRoom.host?.username || hostUser.username,
                  hostFid: hostUser.fid,
                  topics: savedRoom.topics,
                  startTime: savedRoom.startTime
                }).catch(err => console.error("[X Bot] Scheduled announcement failed:", err));
              }

              return successResponse(savedRoom, "Room created successfully");
            } catch (error) {
              console.error("Error creating room:", error);
              set.status = 500;
              return errorResponse(
                "Failed to create room",
                error instanceof Error ? error.message : "Unknown error"
              );
            }
          },
          {
            body: CreateRoomProtectedRequestSchema,
            response: {
              200: CreateRoomResponseSchema,
              404: ErrorResponse,
              500: ErrorResponse
            },
            detail: {
              tags: ['Rooms'],
              summary: 'Create New Room',
              description: `
Creates a new audio room.

**Behavior:**
- If \`startTime\` is in the future, creates an "upcoming" room without 100ms room
- If \`startTime\` is now or past, creates an "ongoing" room with 100ms integration
- Automatically adds the authenticated user as the host
- Tracks the host as a viewer for ad analytics

**Ads Behavior:**
- If \`adsEnabled\` is not provided, uses the host's \`autoAdsEnabled\` preference
- Can be toggled later via room update

**Required Fields:**
- \`name\`: Room name (1-100 characters)
- \`startTime\`: ISO date string
- \`topics\`: Array of topic tags (at least 1)

**Authentication Required:** Yes (Farcaster JWT)
              `,
              security: [{ bearerAuth: [] }]
            }
          }
        )

        // Start recording for a room
        .post("/start-recording/:roomId", async ({ headers, params, set }: any) => {
          try {
            const userFid = headers["x-user-fid"] as string;

            if (!userFid) {
              set.status = 401;
              return errorResponse("Unauthorized", "Missing user FID");
            }

            const user = await User.findOne({ fid: parseInt(userFid) });
            if (!user) {
              set.status = 404;
              return errorResponse("User not found");
            }

            const room = await Room.findById(params.roomId).populate(
              "host",
              "fid username displayName pfp_url _id"
            );
            if (!room) {
              set.status = 404;
              return errorResponse("Room not found");
            }

            // Check if user is the host or co-host
            if (room.host._id.toString() !== user._id.toString()) {
              // Check if user is a co-host
              const participant = await RoomParticipant.findOne({
                roomId: room._id,
                userId: user._id,
                role: "co-host"
              });

              if (!participant) {
                set.status = 403;
                return errorResponse("Only host or co-host can start recording");
              }
            }

            // Check if recording is already enabled
            if (room.recordingEnabled) {
              set.status = 400;
              return errorResponse("Recording is already enabled for this room");
            }

            // Check if room has an HMS room ID
            if (!room.roomId) {
              set.status = 400;
              return errorResponse("Room must be started before recording can begin");
            }

            const hmsAPI = new HMSAPI();

            // Start recording using HMS API
            try {
              await hmsAPI.startRecording(room.roomId);
            } catch (error) {
              console.error("Error starting HMS recording:", error);
              set.status = 500;
              return errorResponse(
                "Failed to start recording in HMS",
                error instanceof Error ? error.message : "Unknown error"
              );
            }

            // Update room to set recordingEnabled to true
            const updatedRoom = await Room.findByIdAndUpdate(
              params.roomId,
              { recordingEnabled: true },
              { new: true }
            ).populate("host", "fid username displayName pfp_url")
            .lean();

            console.log(
              `[Recording Start] Successfully started recording for room ${params.roomId}`
            );

            return successResponse(
              { room: updatedRoom },
              "Recording started successfully"
            );
          } catch (error) {
            console.error("Error starting recording:", error);
            set.status = 500;
            return errorResponse(
              "Failed to start recording",
              error instanceof Error ? error.message : "Unknown error"
            );
          }
        }, {
          params: t.Object({
            roomId: t.String({ description: 'MongoDB ObjectId of the room' })
          }),
          response: {
            200: t.Object({
              success: t.Boolean(),
              data: t.Any(),
              message: t.String()
            }),
            400: ErrorResponse,
            401: ErrorResponse,
            403: ErrorResponse,
            404: ErrorResponse,
            500: ErrorResponse
          },
          detail: {
            tags: ['Rooms'],
            summary: 'Start Recording for Room',
            description: `
Starts recording for an ongoing room and updates the recordingEnabled flag.

**Prerequisites:**
- Room must be in "ongoing" status with an active HMS room
- Recording must not already be enabled
- User must be the host or a co-host

**Actions Performed:**
1. Validates user permissions (host or co-host only)
2. Starts recording via HMS API
3. Updates room document to set \`recordingEnabled: true\`

**Authorization:** Only the room host or co-hosts can start recording.

**Authentication Required:** Yes (Farcaster JWT)
            `,
            security: [{ bearerAuth: [] }]
          }
        })

        // Start a room - create HMS room and update room info
        .post("/start/:roomId", async ({ headers, params, set }: any) => {
          try {
            const userFid = headers["x-user-fid"] as string;

            if (!userFid) {
              set.status = 401;
              return errorResponse("User authentication required");
            }

            const user = await User.findOne({ fid: parseInt(userFid) });
            if (!user) {
              set.status = 404;
              return errorResponse("User not found");
            }

            const room = await Room.findById(params.roomId).populate(
              "host",
              "fid username displayName pfp_url _id"
            );
            if (!room) {
              set.status = 404;
              return errorResponse("Room not found");
            }

            // Check if user is the host
            if (room.host._id.toString() !== user._id.toString()) {
              set.status = 403;
              return errorResponse("Only the room host can start the room");
            }

            // Check if room already has an HMS room ID
            if (room.roomId) {
              set.status = 400;
              return errorResponse("Room has already been started");
            }

            const hmsAPI = new HMSAPI();
            let hmsRoom: any = null;

            // Trim the name off any symbols or digits and append Date.now() to ensure uniqueness
            const trimmedName = room.name.replace(/[^\w\s]/gi, "").trim();
            const uniqueName = `${trimmedName}-${Date.now()}`;

            try {
              hmsRoom = await hmsAPI.createRoom(
                uniqueName,
                room.description || ""
              );
            } catch (error) {
              console.error("Error creating room in 100ms:", error);
              set.status = 500;
              return errorResponse("Failed to create room in 100ms service");
            }

            try {
              await hmsAPI.generateRoomCodes(hmsRoom.id);
            } catch (error) {
              console.error("Error generating room codes:", error);
              set.status = 500;
              return errorResponse("Failed to generate room codes");
            }

            // Start recording if enabled
            if (room.recordingEnabled) {
              try {
                await hmsAPI.startRecording(hmsRoom.id);
                console.log(`[Recording] Started recording for room ${hmsRoom.id}`);
              } catch (recordingError) {
                console.error("Error starting recording:", recordingError);
                // Don't fail room start if recording fails
              }
            }

            const interested = room.interested || [];

            const tokens = await Promise.all(
              interested.map(async (userId: any) => {
                const user = await User.findById(userId);
                return user?.token;
              })
            );

            // Update the room with HMS room ID and set status to ongoing
            const updatedRoom = await Room.findByIdAndUpdate(
              params.roomId,
              {
                roomId: hmsRoom.id,
                status: "ongoing",
              },
              { new: true }
            ).populate("host", "fid username displayName pfp_url");

            // Create XMTP group if not already created
            if (updatedRoom && !updatedRoom.xmtpGroupId) {
              try {
                console.log(`Creating XMTP group for started room ${updatedRoom._id}...`);
                const xmtpClient = await getSystemClient();
                const groupId = await createXMTPGroup(
                  xmtpClient,
                  updatedRoom._id.toString()
                );
                
                // Update room with XMTP group ID
                updatedRoom.xmtpGroupId = groupId;
                await updatedRoom.save();
                
                console.log(`✅ XMTP group ${groupId} created for room ${updatedRoom._id}`);
              } catch (xmtpError) {
                // Don't fail room start if XMTP fails
                console.error('Failed to create XMTP group:', xmtpError);
              }
            }

            console.log(
              `[Room Start] Successfully started room ${params.roomId} with HMS ID: ${hmsRoom.id}`
            );

            const res1 = await fetch(
              "https://api.farcaster.xyz/v1/frame-notifications",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },

                body: JSON.stringify({
                  notificationId: crypto.randomUUID(),
                  title: `Going Live!`,
                  body: `${
                    room?.host.displayName || room?.host.username
                  } has started the room ${updatedRoom?.name}`,
                  targetUrl: `https://firesidebase.vercel.app/call/${room?._id}`,
                  tokens: tokens,
                }),
              }
            ).catch((err) => {
              console.error("FCast notification error:", err);
            });

            const res2 = await fetch(
              "https://api.neynar.com/f/app_host/notify",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },

                body: JSON.stringify({
                  notificationId: crypto.randomUUID(),
                  title: `Going Live!`,
                  body: `${
                    room?.host.displayName || room?.host.username
                  } has started the room ${updatedRoom?.name}`,
                  targetUrl: `https://firesidebase.vercel.app/call/${room?._id}`,
                  tokens: tokens,
                }),
              }
            ).catch((err) => {
              console.error("Neynar notification error:", err);
            });

            console.log("FCast notification response:", res1, res2);

            // Announce on X
            if (updatedRoom) {
              announceFiresideLive({
                id: updatedRoom._id.toString(),
                name: updatedRoom.name,
                description: updatedRoom.description,
                hostDisplayName: (updatedRoom.host as any)?.displayName || '',
                hostUsername: (updatedRoom.host as any)?.username || '',
                hostFid: (updatedRoom.host as any)?.fid || 0,
                topics: updatedRoom.topics
              }).catch(err => console.error("[X Bot] Announcement failed:", err));
            }

            return successResponse(updatedRoom, "Room started successfully");
          } catch (error) {
            console.error("Error starting room:", error);
            set.status = 500;
            return errorResponse(
              "Failed to start room",
              error instanceof Error ? error.message : "Unknown error"
            );
          }
        }, {
          params: t.Object({
            roomId: t.String({ description: 'MongoDB ObjectId of the room to start' })
          }),
          response: {
            200: StartRoomResponseSchema,
            400: ErrorResponse,
            401: ErrorResponse,
            403: ErrorResponse,
            404: ErrorResponse,
            500: ErrorResponse
          },
          detail: {
            tags: ['Rooms'],
            summary: 'Start Scheduled Room',
            description: `
Starts a scheduled (upcoming) room by creating the 100ms room and sending notifications.

**Actions Performed:**
1. Creates room in 100ms platform
2. Generates room codes for all roles
3. Updates room status to "ongoing"
4. Sends push notifications to interested users via Farcaster and Neynar

**Prerequisites:**
- Room must be in "upcoming" status
- Room must not have an existing 100ms room ID
- User must be the room host

**Authorization:** Only the room host can start the room.

**Authentication Required:** Yes (Farcaster JWT)
            `,
            security: [{ bearerAuth: [] }]
          }
        })

        // Update room
        .put(
          "/:id",
          async ({ headers, params, body, set }: any) => {
            try {
              const userFid = headers["x-user-fid"] as string;
              const user = await User.findOne({ fid: parseInt(userFid) });

              if (!user) {
                set.status = 404;
                return errorResponse("User not found");
              }

              var room = await Room.findById(params.id);
              if (!room) {
                set.status = 404;
                return errorResponse("Room not found");
              }

              const {
                status,
                endTime,
                participants,
                action,
                interested,
                adsEnabled,
              } = body;

              const updates: any = {};
              let shouldAutoStart = false;
              let shouldAutoStop = false;

              if (interested) {
                var arr = room.interested || [];

                const user = await User.findOne({ fid: interested });
                if (!user) {
                  set.status = 404;
                  return errorResponse("Interested user not found");
                }
                if (arr.includes(user._id)) {
                  return successResponse(room, "Room updated successfully");
                }
                arr.push(user._id);

                room.interested = arr;

                await room.save();

                return successResponse(room, "Room updated successfully");
              }

              if (room.host.toString() !== user._id.toString()) {
                set.status = 403;
                return errorResponse("Only the room host can update the room");
              }

              if (status && isValidRoomStatus(status)) {
                updates.status = status;
              } else if (status) {
                set.status = 400;
                return errorResponse("Invalid room status");
              }

              if (endTime) {
                updates.endTime = new Date(endTime);
              }

              if (
                typeof adsEnabled === "boolean" &&
                adsEnabled !== room.adsEnabled
              ) {
                updates.adsEnabled = adsEnabled;
                shouldAutoStart = adsEnabled;
                shouldAutoStop = !adsEnabled;
              }

              // sponsorship removed

              if (participants && action) {
                if (action === "add") {
                  for (const participantId of participants) {
                    await RoomParticipant.findOneAndUpdate(
                      { roomId: room._id, userId: participantId },
                      {
                        roomId: room._id,
                        userId: participantId,
                        role: "listener",
                        joinedAt: new Date(),
                      },
                      { upsert: true, new: true }
                    );
                  }
                } else if (action === "remove") {
                  await RoomParticipant.deleteMany({
                    roomId: room._id,
                    userId: { $in: participants },
                  });
                } else {
                  set.status = 400;
                  return errorResponse(
                    'Invalid action. Must be "add" or "remove"'
                  );
                }
              }

              const updatedRoom = await Room.findByIdAndUpdate(
                params.id,
                updates,
                {
                  new: true,
                  runValidators: true,
                }
              );

              if (!updatedRoom) {
                set.status = 404;
                return errorResponse("Room not found");
              }

              if (shouldAutoStop) {
                forceStopAds(params.id, "ads_disabled").catch((err) =>
                  console.error("[ads] failed to stop after toggle", err)
                );
              } else if (shouldAutoStart) {
                evaluateAutoAds(params.id).catch((err) =>
                  console.error("[ads] failed to auto-start after toggle", err)
                );
              }

              // Get updated room with participants
              const updatedRoomWithHost = await Room.findById(updatedRoom._id)
                .populate("host", "fid username displayName pfp_url")
                .lean();

              // Get participants with their user details
              const participantRecords = await RoomParticipant.find({
                roomId: updatedRoom._id,
              })
                .populate("userId", "fid username displayName pfp_url")
                .lean();

              // Transform participants to include role and joinedAt
              const roomParticipants = participantRecords.map(
                (participant: any) => ({
                  ...participant.userId,
                  role: participant.role,
                  joinedAt: participant.joinedAt,
                })
              );

              const roomWithParticipants = {
                ...updatedRoomWithHost,
                participants: roomParticipants,
              };

              return successResponse(
                roomWithParticipants,
                "Room updated successfully"
              );
            } catch (error) {
              set.status = 500;
              return errorResponse("Failed to update room");
            }
          },
          {
            body: RoomUpdateRequestSchema,
            params: t.Object({
              id: t.String({ description: 'MongoDB ObjectId of the room' })
            }),
            response: {
              200: UpdateRoomResponseSchema,
              400: ErrorResponse,
              403: ErrorResponse,
              404: ErrorResponse,
              500: ErrorResponse
            },
            detail: {
              tags: ['Rooms'],
              summary: 'Update Room',
              description: `
Updates room properties. Different behaviors based on the update type:

**Interest Registration (Public-ish):**
- Any authenticated user can add themselves as "interested"
- Used for notification subscriptions when room goes live

**Host-Only Updates:**
- \`status\`: Change room status (upcoming/ongoing/ended)
- \`endTime\`: Set room end time
- \`adsEnabled\`: Toggle ads for the room
- \`participants\` + \`action\`: Bulk add/remove participants

**Ads Behavior:**
- Toggling \`adsEnabled\` to \`true\` triggers auto-start evaluation
- Toggling \`adsEnabled\` to \`false\` stops any running ad session

**Authentication Required:** Yes (Farcaster JWT)
              `,
              security: [{ bearerAuth: [] }]
            }
          }
        )
        // Skip recurring room occurrence
        .put(
          "/:id/skip",
          async ({ headers, params, set }: any) => {
            try {
              const userFid = headers["x-user-fid"] as string;
              const roomId = params.id;

              const user = await User.findOne({ fid: parseInt(userFid) });
              if (!user) {
                set.status = 404;
                return errorResponse("User not found");
              }

              const room = await Room.findById(roomId);
              if (!room) {
                set.status = 404;
                return errorResponse("Room not found");
              }

              // Authorization check
              if (room.host.toString() !== user._id.toString()) {
                set.status = 403;
                return errorResponse("Only the room host can skip occurrences");
              }

              // Validate room is recurring
              if (!room.isRecurring) {
                set.status = 400;
                return errorResponse("This is not a recurring room");
              }

              // Validate room is upcoming
              if (room.status !== 'upcoming') {
                set.status = 400;
                return errorResponse("Only upcoming rooms can be skipped");
              }

              // Calculate next occurrence from current time
              const { calculateNextOccurrence } = await import('../../cron/room-cleanup');
              const nextStartTime = calculateNextOccurrence(
                new Date(), // Use current time as base
                room.recurrenceType!,
                room.recurrenceDay
              );

              // Update room with new start time and reset interested users
              room.startTime = nextStartTime;
              room.interested = [];
              await room.save();

              await room.populate("host", "fid username displayName pfp_url");

              return successResponse(
                room,
                "Room occurrence skipped successfully"
              );
            } catch (error) {
              console.error("Error skipping room:", error);
              set.status = 500;
              return errorResponse(
                "Failed to skip room",
                error instanceof Error ? error.message : "Unknown error"
              );
            }
          },
          {
            params: t.Object({
              id: t.String({ description: 'MongoDB ObjectId of the room' })
            }),
            response: {
              200: UpdateRoomResponseSchema,
              400: ErrorResponse,
              403: ErrorResponse,
              404: ErrorResponse,
              500: ErrorResponse
            },
            detail: {
              tags: ['Rooms'],
              summary: 'Skip Recurring Room Occurrence',
              description: `
Skip the next occurrence of a recurring room and reschedule it to the following valid date.

**Behavior:**
- Calculates next occurrence based on current date/time (not the old start time)
- For daily rooms: Schedules for tomorrow at the same time
- For weekly rooms: Schedules for next occurrence of the specified day
- Resets the \`interested\` array (notification subscribers)

**Validation:**
- Room must be recurring (\`isRecurring: true\`)
- Room must be in \`upcoming\` status
- Only the room host can skip occurrences

**Use Case:** Host realizes they can't make the scheduled time and wants to push it to the next occurrence without manual rescheduling.

**Authentication Required:** Yes (Farcaster JWT)
              `,
              security: [{ bearerAuth: [] }]
            }
          }
        )
  );
