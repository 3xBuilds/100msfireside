import { t } from 'elysia';
import { RoomParticipantSchema, ChatMessageSchema } from './entities';

/**
 * Response schemas for API responses
 */

// Standard API response structure
export const ApiResponseSchema = t.Object({
  success: t.Boolean(),
  data: t.Optional(t.Any()),
  message: t.Optional(t.String()),
  error: t.Optional(t.String()),
  details: t.Optional(t.String()) // Only in development
});

// Participant responses
export const ParticipantResponseSchema = t.Object({
  success: t.Boolean(),
  data: t.Optional(RoomParticipantSchema),
  message: t.Optional(t.String())
});

export const ParticipantsResponseSchema = t.Object({
  success: t.Boolean(),
  data: t.Optional(t.Object({
    participants: t.Array(RoomParticipantSchema),
    totalCount: t.Optional(t.Number())
  })),
  message: t.Optional(t.String())
});

// Chat responses
export const MessageResponseSchema = t.Object({
  success: t.Boolean(),
  data: t.Optional(ChatMessageSchema),
  message: t.Optional(t.String())
});

export const MessagesResponseSchema = t.Object({
  success: t.Boolean(),
  data: t.Optional(t.Object({
    messages: t.Array(ChatMessageSchema),
    totalCount: t.Optional(t.Number()),
    limit: t.Optional(t.Number()),
    offset: t.Optional(t.Number())
  })),
  message: t.Optional(t.String())
});

// Room responses
export const RoomResponseSchema = t.Object({
  success: t.Boolean(),
  data: t.Optional(t.Object({
    room: t.Object({
      id: t.String(),
      name: t.String(),
      description: t.Optional(t.String()),
      host: t.Object({
        fid: t.String(),
        username: t.String(),
        displayName: t.String(),
        pfp_url: t.String()
      }),
      participants: t.Array(t.Object({
        fid: t.String(),
        username: t.String(),
        displayName: t.String(),
        pfp_url: t.String(),
        role: t.String(),
        joinedAt: t.String()
      })),
      startTime: t.String(),
      endTime: t.Union([t.String(), t.Null()]),
      status: t.Union([
        t.Literal('upcoming'),
        t.Literal('ongoing'),
        t.Literal('ended')
      ]),
      
    })
  })),
  message: t.Optional(t.String())
});

export const RoomsResponseSchema = t.Object({
  success: t.Boolean(),
  data: t.Optional(t.Object({
    rooms: t.Array(t.Object({
      id: t.String(),
      name: t.String(),
      description: t.Optional(t.String()),
      host: t.Object({
        fid: t.String(),
        username: t.String(),
        displayName: t.String(),
        pfp_url: t.String()
      }),
      participants: t.Array(t.Object({
        fid: t.String(),
        username: t.String(),
        displayName: t.String(),
        pfp_url: t.String(),
        role: t.String(),
        joinedAt: t.String()
      })),
      startTime: t.String(),
      endTime: t.Union([t.String(), t.Null()]),
      status: t.Union([
        t.Literal('upcoming'),
        t.Literal('ongoing'),
        t.Literal('ended')
      ]),
      
    }))
  })),
  message: t.Optional(t.String())
});

// User authentication responses
export const UserResponseSchema = t.Object({
  success: t.Boolean(),
  data: t.Optional(t.Union([
    t.Number(), // FID number for basic auth response
    t.Object({  // Full user object
      fid: t.String(),
      username: t.String(),
      displayName: t.String(),
      pfp_url: t.String(),
      wallet: t.String(),
      bio: t.Optional(t.String())
    })
  ])),
  message: t.Optional(t.String())
});

// Type exports
export type ApiResponse = typeof ApiResponseSchema.static;
export type ParticipantResponse = typeof ParticipantResponseSchema.static;
export type ParticipantsResponse = typeof ParticipantsResponseSchema.static;
export type MessageResponse = typeof MessageResponseSchema.static;
export type MessagesResponse = typeof MessagesResponseSchema.static;
export type RoomResponse = typeof RoomResponseSchema.static;
export type RoomsResponse = typeof RoomsResponseSchema.static;
export type UserResponse = typeof UserResponseSchema.static;
