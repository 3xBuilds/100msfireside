import { RedisUtils } from '../redis/redis-utils';
import { AdsCurrentState, AdsRoomSnapshot, AdsState } from '../../types/ads';

const ROOM_STATE_TTL_SECONDS = 600;

const roomStateKey = (roomId: string) => `ads:room:${roomId}`;
const roomEventsChannel = (roomId: string) => `ads:room:${roomId}:events`;

export interface SnapshotPatch {
  state?: AdsState;
  sessionId?: string | null;
  sessionStartedAt?: string | null;
  current?: AdsCurrentState | null;
  lastEvent: string;
  reason?: string | null;
  participantCount?: number;
  minParticipants?: number;
}

function buildSnapshot(roomId: string, previous: AdsRoomSnapshot | null, patch: SnapshotPatch): AdsRoomSnapshot {
  return {
    roomId,
    state: patch.state ?? previous?.state ?? 'stopped',
    sessionId: patch.sessionId === undefined ? previous?.sessionId : patch.sessionId,
    sessionStartedAt: patch.sessionStartedAt === undefined ? previous?.sessionStartedAt : patch.sessionStartedAt,
    current: patch.current === undefined ? previous?.current : patch.current,
    lastEvent: patch.lastEvent,
    reason: patch.reason === undefined ? previous?.reason : patch.reason,
    participantCount: patch.participantCount ?? previous?.participantCount,
    minParticipants: patch.minParticipants ?? previous?.minParticipants,
    updatedAt: new Date().toISOString()
  };
}

export async function updateRoomSnapshot(roomId: string, patch: SnapshotPatch): Promise<AdsRoomSnapshot> {
  const client = await RedisUtils.getClient();
  const key = roomStateKey(roomId);
  const previousRaw = await client.get(key);
  const previous = previousRaw ? RedisUtils.safeJsonParse<AdsRoomSnapshot>(previousRaw) : null;

  const snapshot = buildSnapshot(roomId, previous, patch);
  const payload = JSON.stringify(snapshot);

  console.log('[ads] snapshot publish', snapshot);

  await client.set(key, payload, 'EX', ROOM_STATE_TTL_SECONDS);
  await client.publish(roomEventsChannel(roomId), payload);

  return snapshot;
}

export async function getRoomSnapshot(roomId: string): Promise<AdsRoomSnapshot | null> {
  const client = await RedisUtils.getClient();
  const key = roomStateKey(roomId);
  const raw = await client.get(key);
  if (!raw) return null;
  return RedisUtils.safeJsonParse<AdsRoomSnapshot>(raw);
}

export function getRoomStateKey(roomId: string) {
  return roomStateKey(roomId);
}

export function getRoomEventsChannel(roomId: string) {
  return roomEventsChannel(roomId);
}


