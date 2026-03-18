import { t } from 'elysia';
import { ParticipantRole, ParticipantStatus } from './common';

/**
 * Entity schemas for main data structures
 */

export const UserSchema = t.Object({
  fid: t.Optional(t.String()),
  privyId: t.Optional(t.String()),
  username: t.String(),
  displayName: t.String(),
  pfp_url: t.String(),
  wallet: t.Optional(t.String()),
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

// Bankr transaction schema for chat messages
export const BankrChatTransactionSchema = t.Object({
  type: t.String(), // 'transfer_erc20', 'transfer_eth', 'swap', etc.
  chainId: t.Number(),
  to: t.String(),
  data: t.Optional(t.String()),
  value: t.Optional(t.String()),
  gas: t.Optional(t.String()),
  description: t.Optional(t.String()),
  status: t.Optional(t.Union([
    t.Literal('pending'),
    t.Literal('executed'),
    t.Literal('confirmed'),
    t.Literal('failed')
  ])),
  txHash: t.Optional(t.String())
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
  })),
  isBot: t.Optional(t.Boolean()),
  status: t.Optional(t.Union([
    t.Literal('pending'),
    t.Literal('completed'),
    t.Literal('failed')
  ])),
  threadId: t.Optional(t.String()), // Bankr AI conversation thread ID
  transactions: t.Optional(t.Array(BankrChatTransactionSchema)), // Bankr transactions to execute
  prompterFid: t.Optional(t.String()) // FID of user who triggered the transaction
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
  interested: t.Array(t.String()),
  topics: t.Optional(t.Array(t.String())),
  isRecurring: t.Optional(t.Boolean()),
  recurrenceType: t.Optional(t.Union([t.Literal('daily'), t.Literal('weekly'), t.Null()])),
  recurrenceDay: t.Optional(t.Union([t.Number(), t.Null()])),
  parentRoomId: t.Optional(t.Union([t.String(), t.Null()])),
  occurrenceNumber: t.Optional(t.Number()),
  recordingEnabled: t.Optional(t.Boolean())
});

// Agora API related schemas
export const AgoraTokenResponseSchema = t.Object({
  token: t.String(),
  channelName: t.String(),
  uid: t.Number(),
  role: t.String(),
  expiry: t.Number()
});

export const AgoraChannelUserSchema = t.Object({
  uid: t.Number()
});


// Type exports
export type User = typeof UserSchema.static;
export type RoomParticipant = typeof RoomParticipantSchema.static;
export type ChatMessage = typeof ChatMessageSchema.static;
export type BankrChatTransaction = typeof BankrChatTransactionSchema.static;
export type Room = typeof RoomSchema.static;
export type AgoraTokenResponse = typeof AgoraTokenResponseSchema.static;
export type AgoraChannelUser = typeof AgoraChannelUserSchema.static;
