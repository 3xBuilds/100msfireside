import { t } from 'elysia';

/**
 * Common types and enums used across the application
 */

// Participant and room related enums
export const ParticipantRole = t.Union([
  t.Literal('host'),
  t.Literal('co-host'),
  t.Literal('speaker'),
  t.Literal('listener')
]);

export const ParticipantStatus = t.Union([
  t.Literal('active'),
  t.Literal('inactive')
]);

export const RoomStatus = t.Union([
  t.Literal('upcoming'),
  t.Literal('ongoing'),
  t.Literal('ended')
]);

// Type exports
export type ParticipantRole = typeof ParticipantRole.static;
export type ParticipantStatus = typeof ParticipantStatus.static;
export type RoomStatus = typeof RoomStatus.static;
