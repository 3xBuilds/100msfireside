import { t } from 'elysia';

/**
 * Shared documentation schemas for OpenAPI/Scalar
 * 
 * NOTE: These schemas use t.Any() liberally for fields that Mongoose returns as:
 * - Date objects (instead of ISO strings)
 * - null (instead of undefined for optional fields)
 * - ObjectId (instead of strings)
 * - Map objects (instead of plain objects)
 * 
 * This prevents Elysia's runtime response validation from rejecting valid responses.
 * The schemas are primarily for documentation purposes.
 */

// ============================================
// Common Response Wrappers
// ============================================

export const SuccessResponse = <T extends ReturnType<typeof t.Object>>(dataSchema: T) =>
  t.Object({
    success: t.Literal(true),
    data: dataSchema,
    message: t.Optional(t.Any())
  });

export const ErrorResponse = t.Object({
  success: t.Literal(false),
  error: t.String({ description: 'Error message' }),
  details: t.Optional(t.Any({ description: 'Additional error details (development only)' }))
});

// ============================================
// User Schemas
// ============================================

export const UserSchema = t.Object({
  _id: t.Any({ description: 'MongoDB ObjectId' }),
  fid: t.Any({ description: 'Farcaster ID' }),
  username: t.Any({ description: 'Username' }),
  displayName: t.Any({ description: 'Display name' }),
  pfp_url: t.Any({ description: 'Profile picture URL' }),
  wallet: t.Optional(t.Any({ description: 'Primary wallet address' })),
  topics: t.Optional(t.Any({ description: 'Interest topics array' })),
  socials: t.Optional(t.Any({ description: 'Social platform links' })),
  autoAdsEnabled: t.Optional(t.Any({ description: 'Auto-enable ads for new rooms' }))
});

export const UserPublicSchema = t.Object({
  fid: t.Any({ description: 'Farcaster ID' }),
  username: t.Any({ description: 'Username' }),
  displayName: t.Any({ description: 'Display name' }),
  pfp_url: t.Any({ description: 'Profile picture URL' })
});

// ============================================
// Room Schemas
// ============================================

export const RoomHostSchema = t.Object({
  fid: t.Any({ description: 'Farcaster ID of the host' }),
  username: t.Any({ description: 'Username of the host' }),
  displayName: t.Any({ description: 'Display name of the host' }),
  pfp_url: t.Any({ description: 'Profile picture URL' })
});

export const RoomSchema = t.Object({
  _id: t.Any({ description: 'MongoDB ObjectId of the room' }),
  name: t.Any({ description: 'Room name' }),
  description: t.Optional(t.Any({ description: 'Room description' })),
  host: t.Any({ description: 'Host user object' }),
  roomId: t.Any({ description: 'Agora channel name' }),
  status: t.Any({ description: 'Room status: upcoming, ongoing, or ended' }),
  startTime: t.Any({ description: 'Room start time (Date or ISO string)' }),
  endTime: t.Optional(t.Any({ description: 'Room end time (Date, ISO string, or null)' })),
  enabled: t.Any({ description: 'Whether the room is enabled' }),
  topics: t.Any({ description: 'Array of topic tags' }),
  adsEnabled: t.Optional(t.Any({ description: 'Whether ads are enabled for this room' })),
  strength: t.Optional(t.Any({ description: 'Current participant count' }))
});

export const RoomWithParticipantsSchema = t.Object({
  _id: t.Any({ description: 'MongoDB ObjectId of the room' }),
  name: t.Any({ description: 'Room name' }),
  description: t.Optional(t.Any({ description: 'Room description' })),
  host: t.Any({ description: 'Host user object' }),
  roomId: t.Any({ description: 'Agora channel name' }),
  status: t.Any({ description: 'Room status' }),
  startTime: t.Any({ description: 'Room start time' }),
  endTime: t.Optional(t.Any({ description: 'Room end time' })),
  enabled: t.Any({ description: 'Whether the room is enabled' }),
  topics: t.Any({ description: 'Array of topic tags' }),
  adsEnabled: t.Optional(t.Any({ description: 'Whether ads are enabled' })),
  participants: t.Any({ description: 'Array of participant objects' })
});

// ============================================
// Participant Schemas
// ============================================

export const ParticipantRoleSchema = t.Union([
  t.Literal('host'),
  t.Literal('co-host'),
  t.Literal('speaker'),
  t.Literal('listener')
], { description: 'Role in the room' });

export const ParticipantSchema = t.Object({
  userId: t.Any({ description: 'Farcaster ID of the participant' }),
  username: t.Any({ description: 'Username' }),
  displayName: t.Any({ description: 'Display name' }),
  pfp_url: t.Any({ description: 'Profile picture URL' }),
  role: t.Any({ description: 'Role: host, co-host, speaker, or listener' }),
  status: t.Optional(t.Any({ description: 'Status: active or inactive' })),
  joinedAt: t.Any({ description: 'Timestamp of when they joined' })
});

// ============================================
// Chat Schemas
// ============================================

export const ChatMessageSchema = t.Object({
  id: t.Any({ description: 'Unique message ID' }),
  roomId: t.Any({ description: 'Room ID the message belongs to' }),
  userId: t.Any({ description: 'Farcaster ID of the sender' }),
  username: t.Any({ description: 'Username of the sender' }),
  displayName: t.Any({ description: 'Display name of the sender' }),
  pfp_url: t.Any({ description: 'Profile picture URL of the sender' }),
  message: t.Any({ description: 'Message content' }),
  timestamp: t.Any({ description: 'Timestamp of when the message was sent' }),
  isBot: t.Optional(t.Any({ description: 'Whether this message is from a bot' })),
  status: t.Optional(t.Any({ description: 'Message status: pending, completed, or failed (for bot messages)' }))
});

// ============================================
// Advertisement Schemas
// ============================================

export const AdvertisementSchema = t.Object({
  id: t.Any({ description: 'Advertisement ID' }),
  title: t.Any({ description: 'Ad title' }),
  imageUrl: t.Any({ description: 'URL to ad image' }),
  minutesPerRoom: t.Any({ description: 'Duration in minutes per room' }),
  totalRooms: t.Any({ description: 'Total rooms purchased' }),
  roomsRemaining: t.Any({ description: 'Remaining room slots' }),
  minParticipants: t.Any({ description: 'Minimum participants required' }),
  status: t.Any({ description: 'Ad status: active, completed, or paused' }),
  txHashes: t.Any({ description: 'Payment transaction hashes array' })
});

export const AdSessionCurrentSchema = t.Object({
  reservationId: t.Any({ description: 'Current reservation ID' }),
  adId: t.Any({ description: 'Current ad ID' }),
  title: t.Any({ description: 'Ad title' }),
  imageUrl: t.Any({ description: 'Ad image URL' }),
  durationSec: t.Any({ description: 'Duration in seconds' }),
  startedAt: t.Any({ description: 'Timestamp when ad started' }),
  sessionId: t.Any({ description: 'Session identifier' }),
  minParticipants: t.Any({ description: 'Minimum participants for this ad' }),
  participantCountAtStart: t.Any({ description: 'Participant count when ad started' })
});

export const AdSessionStateSchema = t.Object({
  state: t.Any({ description: 'Session state: running or stopped' }),
  current: t.Optional(t.Any({ description: 'Current ad session details or null' })),
  sessionId: t.Optional(t.Any({ description: 'Session ID or null' })),
  lastEvent: t.Optional(t.Any({ description: 'Last webhook event type' })),
  reason: t.Optional(t.Any({ description: 'Reason for state or null' })),
  updatedAt: t.Optional(t.Any({ description: 'Last update timestamp' })),
  participantCount: t.Optional(t.Any({ description: 'Current participant count' })),
  minParticipants: t.Optional(t.Any({ description: 'Minimum participants required' }))
});

// ============================================
// Search Schemas
// ============================================

export const PaginationSchema = t.Object({
  limit: t.Any({ description: 'Results per page' }),
  offset: t.Any({ description: 'Results skipped' }),
  total: t.Any({ description: 'Total results available' })
});

export const SearchUserResultSchema = t.Object({
  fid: t.Any(),
  username: t.Any(),
  displayName: t.Any(),
  pfp_url: t.Any(),
  bio: t.Optional(t.Any()),
  topics: t.Optional(t.Any())
});

export const SearchRoomResultSchema = t.Object({
  _id: t.Any(),
  roomId: t.Any(),
  name: t.Any(),
  description: t.Optional(t.Any()),
  topics: t.Any(),
  host: t.Any(),
  status: t.Any(),
  startTime: t.Any(),
  endTime: t.Optional(t.Any()),
  enabled: t.Any()
});

// ============================================
// Room Code Schemas
// ============================================

export const RoomCodeSchema = t.Object({
  token: t.Any({ description: 'Agora RTC token' }),
  channelName: t.Any({ description: 'Agora channel name' }),
  role: t.Any({ description: 'Role this token grants' }),
  appId: t.Any({ description: 'Agora App ID' })
});

// ============================================
// Response Schemas for Routes
// ============================================

// Rooms
export const GetRoomsResponseSchema = t.Object({
  success: t.Boolean(),
  data: t.Object({
    rooms: t.Any()
  })
});

export const GetRoomResponseSchema = t.Object({
  success: t.Boolean(),
  data: t.Object({
    room: t.Any()
  })
});

// Participants
export const GetParticipantsResponseSchema = t.Object({
  success: t.Boolean(),
  data: t.Object({
    participants: t.Any(),
    count: t.Any(),
    filters: t.Any()
  })
});

export const JoinRoomResponseSchema = t.Object({
  success: t.Boolean(),
  data: t.Object({
    participant: t.Any()
  }),
  message: t.Optional(t.Any())
});

// Chat
export const GetMessagesResponseSchema = t.Object({
  success: t.Boolean(),
  data: t.Object({
    messages: t.Any(),
    totalCount: t.Any(),
    limit: t.Any(),
    offset: t.Any(),
    hasMore: t.Any()
  })
});

export const SendMessageResponseSchema = t.Object({
  success: t.Boolean(),
  data: t.Any(),
  message: t.Optional(t.Any())
});

// Users
export const GetUserResponseSchema = t.Object({
  success: t.Boolean(),
  data: t.Object({
    user: t.Any()
  })
});

export const HandleUserResponseSchema = t.Object({
  success: t.Boolean(),
  data: t.Object({
    user: t.Any()
  }),
  message: t.Optional(t.Any())
});

// Search
export const SearchUsersResponseSchema = t.Object({
  success: t.Boolean(),
  data: t.Object({
    users: t.Any(),
    pagination: t.Any()
  }),
  message: t.Optional(t.Any())
});

export const SearchRoomsResponseSchema = t.Object({
  success: t.Boolean(),
  data: t.Object({
    rooms: t.Any(),
    pagination: t.Any()
  }),
  message: t.Optional(t.Any())
});

export const GlobalSearchResponseSchema = t.Object({
  success: t.Boolean(),
  data: t.Object({
    users: t.Any(),
    rooms: t.Any(),
    pagination: t.Any()
  }),
  message: t.Optional(t.Any())
});

// Ads
export const GetActiveAdsResponseSchema = t.Object({
  success: t.Boolean(),
  data: t.Object({
    ads: t.Any()
  })
});

export const CreateAdResponseSchema = t.Object({
  success: t.Boolean(),
  data: t.Any()
});

export const StartAdsSessionResponseSchema = t.Object({
  success: t.Boolean(),
  data: t.Object({
    sessionId: t.Any(),
    started: t.Any(),
    reason: t.Optional(t.Any()),
    participantCount: t.Any()
  })
});

export const StopAdsSessionResponseSchema = t.Object({
  success: t.Boolean(),
  data: t.Object({
    stopped: t.Any(),
    sessionId: t.Any()
  })
});

export const GetAdSessionResponseSchema = t.Object({
  success: t.Boolean(),
  data: t.Any()
});

// Quote
export const GetQuoteResponseSchema = t.Object({
  success: t.Boolean(),
  data: t.Object({
    priceUsd: t.Any({ description: 'Price in USD' })
  })
});

// Room Codes
export const GetRoomCodesResponseSchema = t.Object({
  success: t.Boolean(),
  data: t.Object({
    roomCodes: t.Any()
  })
});

export const GetMyCodeResponseSchema = t.Object({
  success: t.Boolean(),
  data: t.Object({
    role: t.Any({ description: 'User role in the room' }),
    token: t.Any({ description: 'Agora RTC token' }),
    channelName: t.Any({ description: 'Agora channel name' }),
    uid: t.Any({ description: 'Agora user ID (FID)' }),
    appId: t.Any({ description: 'Agora App ID' })
  })
});

// Profile
export const GetAdsPreferenceResponseSchema = t.Object({
  success: t.Boolean(),
  data: t.Object({
    autoAdsEnabled: t.Any({ description: 'Whether auto-ads is enabled' })
  })
});

// End Room
export const EndRoomResponseSchema = t.Object({
  success: t.Boolean(),
  data: t.Object({
    room: t.Any(),
    participantCount: t.Any({ description: 'Total participants' }),
    roleBreakdown: t.Any(),
    rewards: t.Optional(t.Any())
  }),
  message: t.Optional(t.Any())
});

// Simple success response
export const SimpleSuccessResponseSchema = t.Object({
  success: t.Boolean(),
  message: t.Optional(t.Any())
});

// Admin
export const AdminCleanupResponseSchema = t.Object({
  success: t.Boolean(),
  message: t.Optional(t.Any()),
  error: t.Optional(t.Any()),
  details: t.Optional(t.Any())
});

// Bulk Rooms
export const GetBulkRoomsResponseSchema = t.Object({
  success: t.Boolean(),
  data: t.Object({
    rooms: t.Any()
  })
});

// Rooms by Topics
export const GetRoomsByTopicsResponseSchema = t.Object({
  success: t.Boolean(),
  data: t.Object({
    rooms: t.Any()
  })
});

// Recordings
export const GetRecordingsResponseSchema = t.Object({
  success: t.Boolean(),
  data: t.Object({
    recordings: t.Any()
  })
});

// Create Room
export const CreateRoomResponseSchema = t.Object({
  success: t.Boolean(),
  data: t.Any(),
  message: t.Optional(t.Any())
});

// Upcoming Rooms
export const GetUpcomingRoomsResponseSchema = t.Object({
  success: t.Boolean(),
  data: t.Object({
    rooms: t.Any()
  })
});

// Start Room
export const StartRoomResponseSchema = t.Object({
  success: t.Boolean(),
  data: t.Any(),
  message: t.Optional(t.Any())
});

// Update Room
export const UpdateRoomResponseSchema = t.Object({
  success: t.Boolean(),
  data: t.Any(),
  message: t.Optional(t.Any())
});

// Live Participants from Agora
export const LiveParticipantsResponseSchema = t.Object({
  success: t.Boolean(),
  data: t.Object({
    count: t.Any({ description: 'Number of live participants' }),
    peers: t.Optional(t.Any())
  })
});

// Add/Update/Remove Participant Success
export const ParticipantActionResponseSchema = t.Object({
  success: t.Boolean(),
  message: t.Optional(t.Any())
});

// Leave Room
export const LeaveRoomResponseSchema = t.Object({
  success: t.Boolean(),
  message: t.Optional(t.Any())
});

// Delete Messages
export const DeleteMessagesResponseSchema = t.Object({
  success: t.Boolean(),
  message: t.Optional(t.Any())
});

// User Profile by Username
export const GetUserProfileByUsernameResponseSchema = t.Object({
  success: t.Boolean(),
  data: t.Object({
    user: t.Any(),
    rooms: t.Any(),
    totalAudienceEngaged: t.Any({ description: 'Total unique participants across all rooms' }),
    maxAudienceEngaged: t.Any()
  })
});

// Update User Topics/Profile
export const UpdateUserResponseSchema = t.Object({
  success: t.Boolean(),
  data: t.Object({
    user: t.Any()
  }),
  message: t.Optional(t.Any())
});

// Test Ad Revenue Distribution
export const TestDistributeResponseSchema = t.Object({
  success: t.Boolean(),
  data: t.Object({
    result: t.Any({ description: 'Distribution calculation result' })
  }),
  message: t.Optional(t.Any())
});

// Room Ended (Ads)
export const RoomEndedAdsResponseSchema = t.Object({
  success: t.Boolean(),
  data: t.Object({
    stopped: t.Any({ description: 'Whether the session was stopped' }),
    sessionId: t.Any()
  })
});
