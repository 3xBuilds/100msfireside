import { t } from 'elysia';
import { ParticipantRole, RoomStatus } from './common';

/**
 * Request schemas for API validation
 */

export const CreateAdRequestSchema = t.Object({
  title: t.String({ minLength: 1, maxLength: 256 }),
  rooms: t.Number({ minimum: 1 }),
  minutes: t.Number({ minimum: 1 }),
  txhashes: t.Array(t.String({ minLength: 1 }), { minItems: 1 }),
  minParticipants: t.Number({ minimum: 1, maximum: 1000 })
});

// Room management requests
export const CreateRoomRequestSchema = t.Object({
  name: t.String({ minLength: 1, maxLength: 100 }),
  description: t.Optional(t.String({ maxLength: 500 })),
  host: t.String(), // FID as string
  startTime: t.String() // ISO date string
});

export const CreateRoomProtectedRequestSchema = t.Object({
  name: t.String({ minLength: 1, maxLength: 100 }),
  description: t.Optional(t.String({ maxLength: 500 })),
  startTime: t.String(),
  topics: t.Array(t.String(), { minItems: 1 }),
  adsEnabled: t.Optional(t.Boolean()),
  isRecurring: t.Optional(t.Boolean()),
  recurrenceType: t.Optional(t.Union([t.Literal('daily'), t.Literal('weekly'), t.Null()])),
  recurrenceDay: t.Optional(t.Union([t.Number({ minimum: 0, maximum: 6 }), t.Null()])),
  recordingEnabled: t.Optional(t.Boolean())
});

export const RoomUpdateRequestSchema = t.Object({
  status: t.Optional(RoomStatus),
  endTime: t.Optional(t.String()),
  participants: t.Optional(t.Array(t.String())),
  interested: t.String(),
  action: t.Optional(t.Union([
    t.Literal('add'),
    t.Literal('remove')
  ])),
  adsEnabled: t.Optional(t.Boolean())
});

export const EndRoomRequestSchema = t.Object({
  userId: t.String()
});

// Participant management requests
export const AddParticipantRequestSchema = t.Object({
  userFid: t.String(),
  role: t.Optional(ParticipantRole)
});

export const UpdateParticipantRoleRequestSchema = t.Object({
  userFid: t.String(),
  newRole: ParticipantRole
});

export const GetParticipantsByRoleRequestSchema = t.Object({
  role: ParticipantRole
});

export const LeaveRoomRequestSchema = t.Object({
  userFid: t.String()
});

// Chat requests
export const SendChatMessageRequestSchema = t.Object({
  userFid: t.String({ minLength: 1 }),
  message: t.String({ minLength: 1, maxLength: 1000 })
});

export const GetChatMessagesRequestSchema = t.Object({
  limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
  offset: t.Optional(t.Number({ minimum: 0 }))
});

// User update requests
export const UpdateUserTopicsRequestSchema = t.Object({
  topics: t.Array(t.String())
});

// Type exports
export type CreateRoomRequest = typeof CreateRoomRequestSchema.static;
export type CreateRoomProtectedRequest = typeof CreateRoomProtectedRequestSchema.static;
export type RoomUpdateRequest = typeof RoomUpdateRequestSchema.static;
export type EndRoomRequest = typeof EndRoomRequestSchema.static;
export type AddParticipantRequest = typeof AddParticipantRequestSchema.static;
export type UpdateParticipantRoleRequest = typeof UpdateParticipantRoleRequestSchema.static;
export type GetParticipantsByRoleRequest = typeof GetParticipantsByRoleRequestSchema.static;
export type LeaveRoomRequest = typeof LeaveRoomRequestSchema.static;
export type SendChatMessageRequest = typeof SendChatMessageRequestSchema.static;
export type GetChatMessagesRequest = typeof GetChatMessagesRequestSchema.static;
export type UpdateUserTopicsRequest = typeof UpdateUserTopicsRequestSchema.static;
export type CreateAdRequest = typeof CreateAdRequestSchema.static;
