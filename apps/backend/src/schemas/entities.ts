import { t } from 'elysia';
import { ParticipantRole, ParticipantStatus } from './common';

/**
 * Entity schemas for main data structures
 */

export const UserSchema = t.Object({
  fid: t.String(),
  username: t.String(),
  displayName: t.String(),
  pfp_url: t.String(),
  wallet: t.String(),
  bio: t.Optional(t.String()),
  topics: t.Optional(t.Array(t.String())),
  token: t.Optional(t.String()),
  socials: t.Optional(t.Record(t.String(), t.String())),
  autoAdsEnabled: t.Optional(t.Boolean())
});

export const RoomParticipantSchema = t.Object({
  userId: t.String(),
  username: t.String(),
  displayName: t.String(),
  pfp_url: t.String(),
  wallet: t.String(),
  role: ParticipantRole,
  status: ParticipantStatus,
  joinedAt: t.String()
});

export const ChatMessageSchema = t.Object({
  id: t.String(),
  roomId: t.String(),
  userId: t.String(),
  username: t.String(),
  displayName: t.String(),
  pfp_url: t.String(),
  message: t.String(),
  timestamp: t.String(),
  replyTo: t.Optional(t.Object({
    messageId: t.String(),
    message: t.String(),
    username: t.String(),
    pfp_url: t.String()
  }))
});

export const RoomSchema = t.Object({
  name: t.String(),
  enabled: t.Boolean(),
  adsEnabled: t.Optional(t.Boolean()),
  description: t.Optional(t.String()),
  host: t.String(),
  startTime: t.String(),
  endTime: t.Union([t.String(), t.Null()]),
  ended_at: t.Optional(t.String()),
  status: t.Union([
    t.Literal('upcoming'),
    t.Literal('ongoing'),
    t.Literal('ended')
  ]),
  roomId: t.String(),
  xmtpGroupId: t.Optional(t.Union([t.String(), t.Null()])),
  interested: t.Array(t.String()),
  topics: t.Optional(t.Array(t.String())),
  isRecurring: t.Optional(t.Boolean()),
  recurrenceType: t.Optional(t.Union([t.Literal('daily'), t.Literal('weekly'), t.Null()])),
  recurrenceDay: t.Optional(t.Union([t.Number(), t.Null()])),
  parentRoomId: t.Optional(t.Union([t.String(), t.Null()])),
  occurrenceNumber: t.Optional(t.Number()),
  recordingEnabled: t.Optional(t.Boolean())
});

// HMS API related schemas
export const HMSCreateRoomResponseSchema = t.Object({
  id: t.String(),
  name: t.String(),
  description: t.String(),
  template_id: t.String(),
  created_at: t.String(),
  updated_at: t.String()
});

export const HMSRoomCodeResponseSchema = t.Object({
  id: t.String(),
  code: t.String(),
  role: t.String(),
  room_id: t.String(),
  created_at: t.String(),
  updated_at: t.String()
});


// Type exports
export type User = typeof UserSchema.static;
export type RoomParticipant = typeof RoomParticipantSchema.static;
export type ChatMessage = typeof ChatMessageSchema.static;
export type Room = typeof RoomSchema.static;
export type HMSCreateRoomResponse = typeof HMSCreateRoomResponseSchema.static;
export type HMSRoomCodeResponse = typeof HMSRoomCodeResponseSchema.static;
