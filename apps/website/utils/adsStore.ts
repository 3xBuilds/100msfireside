import { getRedisClient } from './redis';

export type CurrentAdSnapshot = {
  reservationId: string;
  adId: string;
  title: string;
  imageUrl: string;
  durationSec: number;
  startedAt: string;
  sessionId: string;
};

export type RoomSnapshot = {
  state: 'running' | 'stopped';
  current?: CurrentAdSnapshot;
  sessionId?: string;
  sessionStartedAt?: string;
};

const KEY_PREFIX = 'ads:room:state:';
const CHANNEL_PREFIX = 'ads:room:events:';
const SNAPSHOT_TTL_SECONDS = Number(process.env.ADS_STATE_TTL_SECONDS || 60 * 10);

function roomKey(roomId: string) {
  return `${KEY_PREFIX}${roomId}`;
}

export function roomChannel(roomId: string) {
  return `${CHANNEL_PREFIX}${roomId}`;
}

function serialize(snapshot: RoomSnapshot) {
  return JSON.stringify(snapshot);
}

function deserialize(payload: string | null): RoomSnapshot {
  if (!payload) return { state: 'stopped' };
  try {
    const parsed = JSON.parse(payload) as RoomSnapshot;
    return parsed?.state ? parsed : { state: 'stopped' };
  } catch {
    return { state: 'stopped' };
  }
}

export async function fetchRoomSnapshot(roomId: string): Promise<RoomSnapshot> {
  const redis = getRedisClient();
  const payload = await redis.get(roomKey(roomId));
  return deserialize(payload);
}

export async function persistRoomSnapshot(roomId: string, snapshot: RoomSnapshot) {
  const redis = getRedisClient();
  const payload = serialize(snapshot);
  await redis
    .multi()
    .set(roomKey(roomId), payload, 'EX', SNAPSHOT_TTL_SECONDS)
    .publish(roomChannel(roomId), payload)
    .exec();
}

export async function updateRoomSnapshot(
  roomId: string,
  updater: (prev: RoomSnapshot) => RoomSnapshot
) {
  const current = await fetchRoomSnapshot(roomId);
  const next = updater(current) || { state: 'stopped' };
  await persistRoomSnapshot(roomId, next);
}

export async function clearRoomSnapshot(roomId: string) {
  await persistRoomSnapshot(roomId, { state: 'stopped' });
}

