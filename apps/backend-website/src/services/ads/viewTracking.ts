import { RedisUtils } from '../redis/redis-utils';
import { RedisRoomParticipantsService } from '../redis';
import AdView from '../../models/AdView';

const reservationMetaKey = (reservationId: string) => `ads:view:${reservationId}:meta`;
const reservationActiveKey = (reservationId: string) => `ads:view:${reservationId}:active`;
const reservationTotalsKey = (reservationId: string) => `ads:view:${reservationId}:totals`;
const roomReservationsKey = (roomId: string) => `ads:view:room:${roomId}:reservations`;

interface ReservationMeta {
  roomId: string;
  adId: string;
  sessionId: string;
  startedAt: string;
  durationSec: number;
}

export async function startReservationTracking(args: ReservationMeta & { reservationId: string }) {
  const client = await RedisUtils.getClient();
  const { reservationId, ...meta } = args;

  await client.set(reservationMetaKey(reservationId), JSON.stringify(meta), 'EX', 86400);
  await client.del(reservationActiveKey(reservationId));
  await client.del(reservationTotalsKey(reservationId));
  await client.sadd(roomReservationsKey(meta.roomId), reservationId);

  // Seed currently active participants
  const participants = await RedisRoomParticipantsService.getParticipants(meta.roomId, true);
  const now = Date.now();
  if (participants?.length) {
    const pipeline = client.pipeline();
    for (const participant of participants) {
      const userId = participant.userId;
      if (!userId) continue;
      pipeline.hset(reservationActiveKey(reservationId), userId, now.toString());
    }
    await RedisUtils.executePipeline(pipeline);
  }
}

async function getCurrentReservation(roomId: string): Promise<{ reservationId: string; meta: ReservationMeta } | null> {
  const client = await RedisUtils.getClient();
  const currentRaw = await client.get(RedisUtils.adKeys.roomAdCurrent(roomId));
  if (!currentRaw) return null;
  const current = RedisUtils.safeJsonParse<any>(currentRaw);
  if (!current?.reservationId) return null;
  const metaRaw = await client.get(reservationMetaKey(current.reservationId));
  if (!metaRaw) return null;
  return { reservationId: current.reservationId, meta: JSON.parse(metaRaw) as ReservationMeta };
}

export async function trackViewerJoin(roomId: string, userFid: string) {
  const entry = await getCurrentReservation(roomId);
  if (!entry) return;
  const client = await RedisUtils.getClient();
  await client.hsetnx(reservationActiveKey(entry.reservationId), userFid, Date.now().toString());
}

async function accumulateWatchTime(reservationId: string, userFid: string, nowMs: number) {
  const client = await RedisUtils.getClient();
  const joinRaw = await client.hget(reservationActiveKey(reservationId), userFid);
  if (!joinRaw) return;
  const joinMs = parseInt(joinRaw, 10);
  if (!Number.isFinite(joinMs)) {
    await client.hdel(reservationActiveKey(reservationId), userFid);
    return;
  }

  const metaRaw = await client.get(reservationMetaKey(reservationId));
  if (!metaRaw) return;
  const meta = JSON.parse(metaRaw) as ReservationMeta;
  const startedMs = new Date(meta.startedAt).getTime();
  const endMs = startedMs + meta.durationSec * 1000;
  const cappedNow = Math.min(Math.max(nowMs, startedMs), endMs);
  const delta = Math.max(0, cappedNow - joinMs);

  if (delta > 0) {
    await client.hincrby(reservationTotalsKey(reservationId), userFid, delta);
  }

  await client.hdel(reservationActiveKey(reservationId), userFid);
}

export async function trackViewerLeave(roomId: string, userFid: string) {
  const entry = await getCurrentReservation(roomId);
  if (!entry) return;
  await accumulateWatchTime(entry.reservationId, userFid, Date.now());
}

export async function finalizeReservationTracking(reservationId: string, completedAt: Date) {
  const client = await RedisUtils.getClient();
  const active = await client.hkeys(reservationActiveKey(reservationId));
  if (active?.length) {
    for (const userFid of active) {
      await accumulateWatchTime(reservationId, userFid, completedAt.getTime());
    }
  }
  await client.del(reservationActiveKey(reservationId));
}

async function flushReservation(reservationId: string) {
  const client = await RedisUtils.getClient();
  const metaRaw = await client.get(reservationMetaKey(reservationId));
  if (!metaRaw) return;
  const meta = JSON.parse(metaRaw) as ReservationMeta;
  const totals = await client.hgetall(reservationTotalsKey(reservationId));
  if (!totals || Object.keys(totals).length === 0) {
    await client.del(reservationTotalsKey(reservationId));
    await client.del(reservationMetaKey(reservationId));
    return;
  }

  const docs = Object.entries(totals).map(([userFid, watchedMs]) => ({
    reservationId,
    adId: meta.adId,
    roomId: meta.roomId,
    sessionId: meta.sessionId,
    userFid,
    watchedMs: parseInt(watchedMs, 10),
    startedAt: new Date(meta.startedAt),
    completedAt: new Date(new Date(meta.startedAt).getTime() + meta.durationSec * 1000)
  }));

  if (docs.length) {
    await AdView.bulkWrite(
      docs.map((doc) => ({
        updateOne: {
          filter: { reservationId: doc.reservationId, userFid: doc.userFid },
          update: doc,
          upsert: true
        }
      }))
    );
  }

  await client.del(reservationTotalsKey(reservationId));
  await client.del(reservationMetaKey(reservationId));
}

export async function flushRoomReservationViews(roomId: string) {
  const client = await RedisUtils.getClient();
  const reservations = await client.smembers(roomReservationsKey(roomId));
  if (!reservations?.length) return;
  for (const reservationId of reservations) {
    await flushReservation(reservationId);
    await client.srem(roomReservationsKey(roomId), reservationId);
  }
}


