import { Elysia, t } from 'elysia';
import crypto from 'crypto';
import { authMiddleware } from '../../middleware/auth';
import { errorResponse, successResponse } from '../../utils';
import Advertisement, { IAdvertisement } from '../../models/Advertisement';
import AdAssignment, { IAdAssignment } from '../../models/AdAssignment';
import Room from '../../models/Room';
import User from '../../models/User';
import { RedisUtils } from '../../services/redis/redis-utils';
import { RedisRoomParticipantsService } from '../../services/redis';
import config from '../../config';
import { s3UploadService } from '../../services/s3Upload';
import { enqueueWebhookRetry, sendWebhookRequest } from '../../services/ads/webhookDelivery';
import { getRoomSnapshot, updateRoomSnapshot } from '../../services/ads/adsStateCache';
import { AdsState, AdsCurrentState } from '../../types/ads';
import { startReservationTracking, finalizeReservationTracking, flushRoomReservationViews } from '../../services/ads/viewTracking';
import { adRevDistribute } from '../../services/ads/adRevDistribute';
import {
  GetQuoteResponseSchema,
  GetActiveAdsResponseSchema,
  CreateAdResponseSchema,
  StartAdsSessionResponseSchema,
  StopAdsSessionResponseSchema,
  GetAdSessionResponseSchema,
  RoomEndedAdsResponseSchema,
  TestDistributeResponseSchema,
  SimpleSuccessResponseSchema,
  ErrorResponse
} from '../../schemas/documentation';

const rotationTimers = new Map<string, NodeJS.Timeout>();
const DEFAULT_MIN_PARTICIPANTS = 1;
const MAX_MIN_PARTICIPANTS = 1000;
const DEFAULT_WEBHOOK_URL = config.adsWebhookUrl;
const START_LOCK_TTL_SEC = 30;

interface CurrentAdPayload {
  reservationId: string;
  adId: string;
  title: string;
  imageUrl: string;
  durationSec: number;
  startedAt: string;
  sessionId: string;
  webhookUrl: string;
  minParticipants: number;
  participantCountAtStart: number;
}

function toSnapshotCurrent(current: CurrentAdPayload): AdsCurrentState {
  return {
    reservationId: current.reservationId,
    adId: current.adId,
    title: current.title,
    imageUrl: current.imageUrl,
    durationSec: current.durationSec,
    startedAt: current.startedAt,
    sessionId: current.sessionId,
    minParticipants: current.minParticipants,
    participantCountAtStart: current.participantCountAtStart
  };
}

interface AllocationResult {
  assignment: IAdAssignment;
  currentPayload: CurrentAdPayload;
  ad: IAdvertisement;
}

function generateId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function logAds(message: string, meta?: Record<string, any>) {
  const ts = new Date().toISOString();
  if (meta) {
    console.log(`[ads] ${ts} ${message}`, meta);
  } else {
    console.log(`[ads] ${ts} ${message}`);
  }
}

function resolveWebhookUrl(override?: string) {
  if (override && override.trim().length > 0) return override.trim();
  return DEFAULT_WEBHOOK_URL;
}

function normalizeTxHashes(input: any): string[] {
  if (Array.isArray(input)) {
    return input.map((val) => String(val).trim()).filter(Boolean);
  }

  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((val) => String(val).trim()).filter(Boolean);
      }
    } catch {}
    return trimmed.split(',').map((v) => v.trim()).filter(Boolean);
  }

  return [];
}

async function getActiveParticipantCount(roomId: string): Promise<number> {
  try {
    const total = await RedisRoomParticipantsService.getParticipantCount(roomId, true);
    if (typeof total === 'number') return total;
    if (typeof (total as any)?.total === 'number') return (total as any).total;
  } catch (err) {
    console.error('[ads] failed to fetch participant count', { roomId, err });
  }
  return 0;
}

async function getCurrentSessionId(roomId: string): Promise<string | null> {
  try {
    const client = await RedisUtils.getClient();
    const raw = await client.get(RedisUtils.adKeys.roomAdCurrent(roomId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.sessionId || null;
  } catch (err) {
    console.error('[ads] failed to read current session id', { roomId, err });
    return null;
  }
}

async function deliverWebhook(url: string, event: string, payload: any, idempotencyKey?: string) {
  const key = idempotencyKey || payload?.eventId || generateId('evt');
  try {
    await sendWebhookRequest(url, event, payload, key);
  } catch (err) {
    console.error('Webhook delivery failed, scheduling retry', { event, url, error: err instanceof Error ? err.message : err });
    await enqueueWebhookRetry({ url, event, payload, idempotencyKey: key, attempt: 1 });
  }
}

async function decrementInventory(adId: string) {
  const ad = await Advertisement.findByIdAndUpdate(adId, { $inc: { roomsRemaining: -1 } }, { new: true });
  if (ad && ad.roomsRemaining <= 0 && ad.status !== 'completed') {
    ad.status = 'completed';
    await ad.save();
  }
}

async function completeCurrentAd(roomId: string, assignmentId: string) {
  const assignment = await AdAssignment.findById(assignmentId);
  if (!assignment || assignment.status !== 'reserved') return;

  const ad = await Advertisement.findById(assignment.adId);
  const participantCount = await getActiveParticipantCount(roomId);

  assignment.status = 'completed';
  assignment.completedAt = new Date();
  await assignment.save();

  await decrementInventory(String(assignment.adId));

  const payload = {
    event: 'ads.ad.completed',
    eventId: generateId('evt'),
    roomId,
    sessionId: assignment.sessionId,
    reservationId: String(assignment._id),
    adId: String(assignment.adId),
    completedAt: new Date().toISOString(),
    minParticipants: ad?.minParticipants ?? DEFAULT_MIN_PARTICIPANTS,
    participantCount
  };
  await deliverWebhook(assignment.webhookUrl, 'ads.ad.completed', payload, payload.eventId);
  await finalizeReservationTracking(String(assignment._id), new Date(payload.completedAt));
  await updateRoomSnapshot(roomId, {
    state: 'running',
    sessionId: assignment.sessionId,
    current: null,
    lastEvent: 'ads.ad.completed',
    participantCount,
    minParticipants: ad?.minParticipants ?? DEFAULT_MIN_PARTICIPANTS
  });
}

async function scheduleRotation(roomId: string, assignment: IAdAssignment, durationSec: number, startedAtIso: string, retryCount = 0) {
  const lockKey = RedisUtils.adKeys.roomAdLock(roomId);
  const acquired = await RedisUtils.acquireLock(lockKey, durationSec + 30);
  if (!acquired) {
    const nextRetry = Math.min(2000, 250 + retryCount * 250);
    logAds('rotation lock busy, retrying', { roomId, assignmentId: String(assignment._id), retryCount, nextRetry });
    setTimeout(() => {
      scheduleRotation(roomId, assignment, durationSec, startedAtIso, retryCount + 1).catch((err) => {
        console.error('[ads] rotation retry failed', err);
      });
    }, nextRetry);
    return;
  }

  const existing = rotationTimers.get(roomId);
  if (existing) clearTimeout(existing);

  const parsedStarted = Date.parse(startedAtIso || assignment.reservedAt?.toISOString() || '');
  const startedMs = Number.isNaN(parsedStarted) ? Date.now() : parsedStarted;
  const endMs = startedMs + durationSec * 1000;

  const schedule = (delayMs: number) => {
    logAds('scheduling rotation tick', { roomId, assignmentId: String(assignment._id), delayMs });
    const timer = setTimeout(run, delayMs);
    rotationTimers.set(roomId, timer);
  };

  const run = async () => {
    try {
      const now = Date.now();
      const remainingMs = endMs - now;
      logAds('rotation tick fired', { roomId, assignmentId: String(assignment._id), remainingMs });
      if (remainingMs > 250) {
        schedule(Math.max(250, remainingMs));
        return;
      }

      await completeCurrentAd(roomId, String(assignment._id));

      const client = await RedisUtils.getClient();
      const state = await client.get(RedisUtils.adKeys.roomAdsState(roomId));
      if (state !== 'running') {
        await client.del(RedisUtils.adKeys.roomAdCurrent(roomId));
        return;
      }

      const latestCount = await getActiveParticipantCount(roomId);
      const next = await allocateNextAd(roomId, assignment.webhookUrl, assignment.sessionId, latestCount);
      if (!next) {
        await client.set(RedisUtils.adKeys.roomAdsState(roomId), 'stopped');
      }
    } catch (e) {
      console.error('[ads] rotation tick failed', e);
    } finally {
      rotationTimers.delete(roomId);
      await RedisUtils.releaseLock(lockKey);
    }
  };

  const initialDelay = Math.max(500, endMs - Date.now());
  schedule(initialDelay);
}

async function eligibleAdExists(roomId: string, participantCount?: number): Promise<boolean> {
  const usedAdIds = await AdAssignment.distinct('adId', { roomId });
  const query: any = { status: 'active', roomsRemaining: { $gt: 0 }, _id: { $nin: usedAdIds } };
  if (typeof participantCount === 'number' && Number.isFinite(participantCount)) {
    query.minParticipants = { $lte: Math.max(0, participantCount) };
  }
  const count = await Advertisement.countDocuments(query);
  return count > 0;
}

async function allocateNextAd(roomId: string, webhookUrl: string, sessionId: string, participantCount?: number): Promise<AllocationResult | null> {
  // Idempotency: if a reservation already exists for this session/room, return it
  const existing = await AdAssignment.findOne({ roomId, sessionId, status: 'reserved' });
  if (existing) {
    const ad = await Advertisement.findById(existing.adId);
    if (ad) {
      const currentPayload: CurrentAdPayload = {
        reservationId: String(existing._id),
        adId: String(ad._id),
        title: ad.title,
        imageUrl: ad.imageUrl,
        durationSec: existing.durationSec,
        startedAt: (existing.reservedAt ?? new Date()).toISOString(),
        sessionId,
        webhookUrl,
        minParticipants: ad.minParticipants ?? DEFAULT_MIN_PARTICIPANTS,
        participantCountAtStart: participantCount ?? 0
      };
      await updateRoomSnapshot(roomId, {
        state: 'running',
        sessionId,
        current: toSnapshotCurrent(currentPayload),
        lastEvent: 'ads.ad.started',
        participantCount: currentPayload.participantCountAtStart,
        minParticipants: currentPayload.minParticipants
      });
      return { assignment: existing, currentPayload, ad };
    }
  }

  const usedAdIds = await AdAssignment.distinct('adId', { roomId });
  const baseQuery: any = { status: 'active', roomsRemaining: { $gt: 0 }, _id: { $nin: usedAdIds } };
  const threshold = typeof participantCount === 'number' && Number.isFinite(participantCount) ? Math.max(0, participantCount) : undefined;
  const query = threshold !== undefined ? { ...baseQuery, minParticipants: { $lte: threshold } } : baseQuery;
  let ad = await Advertisement.findOne(query).sort({ createdAt: 1 });
  const client = await RedisUtils.getClient();

  if (!ad) {
    const fallbackAd = await Advertisement.findOne(baseQuery).sort({ createdAt: 1 });
    const reason = fallbackAd ? 'insufficient_participants' : 'no_inventory';
    const minRequired = fallbackAd?.minParticipants ?? DEFAULT_MIN_PARTICIPANTS;
    console.warn('[ads] allocateNextAd found no eligible ads', { roomId, sessionId, reason, threshold, minRequired });
    const payload = {
      event: 'ads.session.idle',
      eventId: generateId('evt'),
      roomId,
      sessionId,
      reason,
      minParticipants: minRequired,
      participantCount: participantCount ?? 0
    };
    await deliverWebhook(webhookUrl, 'ads.session.idle', payload, payload.eventId);
    await client.del(RedisUtils.adKeys.roomAdCurrent(roomId));
    await updateRoomSnapshot(roomId, {
      state: 'stopped',
      sessionId,
      current: null,
      lastEvent: 'ads.session.idle',
      reason,
      participantCount: payload.participantCount,
      minParticipants: minRequired
    });
    return null;
  }

  const durationSec = ad.minutesPerRoom * 60;
  const now = new Date();
  const assignment = await AdAssignment.create({
    adId: ad._id,
    roomId,
    durationSec,
    status: 'reserved',
    reservedAt: now,
    expiresAt: new Date(now.getTime() + durationSec * 1000),
    webhookUrl,
    sessionId
  });

  const currentPayload: CurrentAdPayload = {
    reservationId: String(assignment._id),
    adId: String(ad._id),
    title: ad.title,
    imageUrl: ad.imageUrl,
    durationSec,
    startedAt: now.toISOString(),
    sessionId,
    webhookUrl,
    minParticipants: ad.minParticipants ?? DEFAULT_MIN_PARTICIPANTS,
    participantCountAtStart: participantCount ?? 0
  };

  await client.set(RedisUtils.adKeys.roomAdCurrent(roomId), JSON.stringify(currentPayload));

  const eventPayload = {
    event: 'ads.ad.started',
    eventId: generateId('evt'),
    roomId,
    sessionId,
    reservationId: currentPayload.reservationId,
    adId: currentPayload.adId,
    title: currentPayload.title,
    imageUrl: currentPayload.imageUrl,
    durationSec: currentPayload.durationSec,
    startedAt: currentPayload.startedAt,
    minParticipants: currentPayload.minParticipants,
    participantCount: currentPayload.participantCountAtStart
  };
  await deliverWebhook(webhookUrl, 'ads.ad.started', eventPayload, eventPayload.eventId);

  logAds('ad started', {
    roomId,
    sessionId,
    reservationId: currentPayload.reservationId,
    adId: currentPayload.adId,
    durationSec,
    minParticipants: currentPayload.minParticipants,
    participantCount: currentPayload.participantCountAtStart
  });

  await updateRoomSnapshot(roomId, {
    state: 'running',
    sessionId,
    current: toSnapshotCurrent(currentPayload),
    lastEvent: 'ads.ad.started',
    participantCount: currentPayload.participantCountAtStart,
    minParticipants: currentPayload.minParticipants
  });

  await startReservationTracking({
    reservationId: currentPayload.reservationId,
    roomId,
    adId: currentPayload.adId,
    sessionId,
    startedAt: currentPayload.startedAt,
    durationSec
  });

  await scheduleRotation(roomId, assignment, durationSec, currentPayload.startedAt);
  return { assignment, currentPayload, ad };
}

async function restoreRoomAdRotations() {
  try {
    const client = await RedisUtils.getClient();
    const pattern = 'room:*:ads:current';
    let cursor = '0';

    do {
      const [nextCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;

      for (const key of keys) {
        const parts = key.split(':');
        const roomId = parts[1];
        if (!roomId) continue;

        try {
          const state = await client.get(RedisUtils.adKeys.roomAdsState(roomId));
          if (state !== 'running') {
            await client.del(key);
            continue;
          }

          const currentRaw = await client.get(key);
          if (!currentRaw) continue;

          const current = JSON.parse(currentRaw);
          if (!current?.reservationId || !current?.durationSec || !current?.startedAt) {
            await client.del(key);
            continue;
          }

          if (rotationTimers.has(roomId)) continue;

          const assignment = await AdAssignment.findById(current.reservationId);
          if (!assignment || assignment.status !== 'reserved') {
            await client.del(key);
            continue;
          }

          const startedAtMs = new Date(current.startedAt).getTime();
          if (Number.isNaN(startedAtMs)) {
            await client.del(key);
            continue;
          }

          const endAtMs = startedAtMs + Number(current.durationSec) * 1000;
          const remainingMs = endAtMs - Date.now();
          const remainingSec = remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 1;

          logAds(`Restoring ad rotation for room ${roomId} with ${remainingSec}s remaining`);
          await scheduleRotation(roomId, assignment, current.durationSec, current.startedAt);
        } catch (roomError) {
          console.error(`Failed to restore ad rotation for room ${roomId}`, roomError);
        }
      }
    } while (cursor !== '0');
  } catch (err) {
    console.error('Failed to restore room ad rotations', err);
  }
}

async function recoverRoomAdSession(roomId: string): Promise<{ state: AdsState, current: any } | null> {
  try {
    const assignment = await AdAssignment.findOne({ roomId, status: 'reserved' }).sort({ reservedAt: -1 });
    if (!assignment) return null;

    if (!assignment.webhookUrl || !assignment.sessionId) return null;

    const ad = await Advertisement.findById(assignment.adId);
    if (!ad) return null;

    const remainingMs = assignment.expiresAt ? assignment.expiresAt.getTime() - Date.now() : assignment.durationSec * 1000;
    if (remainingMs <= 0) {
      console.warn(`Found expired ad assignment ${assignment._id} for room ${roomId}, scheduling immediate completion`);
      await scheduleRotation(roomId, assignment, 1, new Date().toISOString());
      return null;
    }

    const participantCount = await getActiveParticipantCount(roomId);

    const currentPayload: CurrentAdPayload = {
      reservationId: String(assignment._id),
      adId: String(assignment.adId),
      title: ad.title,
      imageUrl: ad.imageUrl,
      durationSec: assignment.durationSec,
      startedAt: (assignment.reservedAt ?? new Date()).toISOString(),
      sessionId: assignment.sessionId,
      webhookUrl: assignment.webhookUrl,
      minParticipants: ad.minParticipants ?? DEFAULT_MIN_PARTICIPANTS,
      participantCountAtStart: participantCount
    };

    const client = await RedisUtils.getClient();
    await client.set(RedisUtils.adKeys.roomAdsState(roomId), 'running');
    await client.set(RedisUtils.adKeys.roomAdCurrent(roomId), JSON.stringify(currentPayload));

    await scheduleRotation(roomId, assignment, assignment.durationSec, currentPayload.startedAt);

    console.warn(`Recovered ads session state for room ${roomId} from assignment ${assignment._id}`);

    await updateRoomSnapshot(roomId, {
      state: 'running',
      sessionId: assignment.sessionId,
      current: toSnapshotCurrent(currentPayload),
      lastEvent: 'ads.ad.started',
      participantCount,
      minParticipants: currentPayload.minParticipants
    });

    return { state: 'running', current: currentPayload };
  } catch (err) {
    console.error(`Failed to recover ads session state for room ${roomId}`, err);
    return null;
  }
}

interface StartSessionOptions {
  webhookUrl?: string;
  participantCountOverride?: number;
  requireAdsEnabled?: boolean;
  room?: any;
  initiatedBy?: 'manual' | 'auto';
}

interface StartSessionResult {
  started: boolean;
  sessionId: string | null;
  reason?: string;
  participantCount: number;
  allocation: AllocationResult | null;
}

async function startAdsSession(roomId: string, options: StartSessionOptions = {}): Promise<StartSessionResult> {
  const participantCount = typeof options.participantCountOverride === 'number'
    ? options.participantCountOverride
    : await getActiveParticipantCount(roomId);

  let room = options.room;
  if (!room) {
    room = await Room.findById(roomId).select('adsEnabled');
  }
  if (!room) {
    return { started: false, reason: 'room_not_found', sessionId: null, participantCount, allocation: null };
  }

  if (options.requireAdsEnabled && room.adsEnabled === false) {
    return { started: false, reason: 'ads_disabled', sessionId: null, participantCount, allocation: null };
  }

  const webhookUrl = resolveWebhookUrl(options.webhookUrl);
  if (!webhookUrl) {
    return { started: false, reason: 'missing_webhook', sessionId: null, participantCount, allocation: null };
  }

  const client = await RedisUtils.getClient();
  const stateKey = RedisUtils.adKeys.roomAdsState(roomId);
  const currentState = await client.get(stateKey);
  if (currentState === 'running') {
    const existingSessionId = await getCurrentSessionId(roomId);
    return { started: true, reason: 'already_running', sessionId: existingSessionId, participantCount, allocation: null };
  }

  const hasInventory = await eligibleAdExists(roomId, participantCount);
  if (!hasInventory) {
    return { started: false, reason: 'no_eligible_ads', sessionId: null, participantCount, allocation: null };
  }

  const startLockKey = RedisUtils.adKeys.roomAdsStartLock(roomId);
  const locked = await RedisUtils.acquireLock(startLockKey, START_LOCK_TTL_SEC);
  if (!locked) {
    return { started: false, reason: 'start_in_progress', sessionId: null, participantCount, allocation: null };
  }

  let sessionId: string | null = null;
  let allocation: AllocationResult | null = null;

  try {
    await client.set(stateKey, 'running');
    sessionId = generateId('sess');
    allocation = await allocateNextAd(roomId, webhookUrl, sessionId, participantCount);
    if (!allocation) {
      await client.set(stateKey, 'stopped');
      return { started: false, reason: 'allocation_failed', sessionId, participantCount, allocation: null };
    }

    const startedAt = new Date().toISOString();
    const payload = {
      event: 'ads.session.started',
      eventId: generateId('evt'),
      roomId,
      sessionId,
      startedAt,
      participantCount,
      minParticipants: allocation.currentPayload.minParticipants,
      source: options.initiatedBy || 'manual'
    };
    await deliverWebhook(webhookUrl, 'ads.session.started', payload, payload.eventId);
    await updateRoomSnapshot(roomId, {
      state: 'running',
      sessionId,
      sessionStartedAt: startedAt,
      lastEvent: 'ads.session.started',
      participantCount,
      minParticipants: allocation.currentPayload.minParticipants
    });

    return { started: true, sessionId, participantCount, allocation };
  } catch (err) {
    await client.set(stateKey, 'stopped');
    console.error('[ads] failed to start ads session', { roomId, err });
    return { started: false, reason: 'unexpected_error', sessionId, participantCount, allocation: null };
  } finally {
    await RedisUtils.releaseLock(startLockKey);
  }
}

interface StopSessionResult {
  stopped: boolean;
  sessionId: string | null;
  reason?: string;
}

async function stopAdsSession(roomId: string, reason: string = 'manual_stop'): Promise<StopSessionResult> {
  const client = await RedisUtils.getClient();
  const stateKey = RedisUtils.adKeys.roomAdsState(roomId);
  await client.set(stateKey, 'stopped');

  const currentKey = RedisUtils.adKeys.roomAdCurrent(roomId);
  const currentRaw = await client.get(currentKey);
  let sessionId: string | null = null;

  if (currentRaw) {
    try {
      const current: CurrentAdPayload = JSON.parse(currentRaw);
      sessionId = current.sessionId;
      const assignment = await AdAssignment.findById(current.reservationId);
      if (assignment && assignment.status === 'reserved') {
        assignment.status = 'canceled';
        assignment.canceledAt = new Date();
        await assignment.save();
      }

      const participantCount = await getActiveParticipantCount(roomId);
      const eventId = generateId('evt');
      await deliverWebhook(current.webhookUrl, 'ads.session.stopped', {
        event: 'ads.session.stopped',
        eventId,
        roomId,
        sessionId: current.sessionId,
        stoppedAt: new Date().toISOString(),
        reason,
        minParticipants: current.minParticipants ?? DEFAULT_MIN_PARTICIPANTS,
        participantCount
      }, eventId);
      await updateRoomSnapshot(roomId, {
        state: 'stopped',
        sessionId: current.sessionId,
        current: null,
        lastEvent: 'ads.session.stopped',
        reason,
        participantCount,
        minParticipants: current.minParticipants ?? DEFAULT_MIN_PARTICIPANTS
      });
    } catch (err) {
      console.error('[ads] failed to emit session stopped event', { roomId, err });
    }
  }

  if (!sessionId) {
    await updateRoomSnapshot(roomId, {
      state: 'stopped',
      sessionId: null,
      current: null,
      lastEvent: 'ads.session.stopped',
      reason
    });
  }

  await client.del(currentKey);
  const timer = rotationTimers.get(roomId);
  if (timer) {
    clearTimeout(timer);
    rotationTimers.delete(roomId);
  }

  if (reason === 'room_ended') {
    await flushRoomReservationViews(roomId);
  }

  return { stopped: true, sessionId, reason };
}

export async function evaluateAutoAds(roomId: string, participantCountOverride?: number) {
  try {
    const room = await Room.findById(roomId).select('adsEnabled');
    if (!room) {
      return;
    }

    if (room.adsEnabled === false) {
      await stopAdsSession(roomId, 'ads_disabled');
      return;
    }

    const result = await startAdsSession(roomId, {
      participantCountOverride,
      requireAdsEnabled: true,
      room,
      initiatedBy: 'auto'
    });

    if (!result.started) {
      console.log('[ads:auto] evaluation skipped', {
        roomId,
        reason: result.reason,
        participantCount: result.participantCount
      });
    }
  } catch (err) {
    console.error('[ads:auto] evaluation failed', { roomId, err });
  }
}

export async function forceStopAds(roomId: string, reason: string = 'manual_stop') {
  return stopAdsSession(roomId, reason);
}

// Documentation schemas
const AdvertisementSchema = t.Object({
  id: t.String({ description: 'Advertisement ID' }),
  title: t.String({ description: 'Ad title' }),
  imageUrl: t.String({ description: 'URL to ad image' }),
  minutesPerRoom: t.Number({ description: 'Duration in minutes per room' }),
  totalRooms: t.Number({ description: 'Total rooms purchased' }),
  roomsRemaining: t.Number({ description: 'Remaining room slots' }),
  minParticipants: t.Number({ description: 'Minimum participants required' }),
  status: t.Union([t.Literal('active'), t.Literal('completed'), t.Literal('paused')]),
  txHashes: t.Array(t.String(), { description: 'Payment transaction hashes' })
});

const AdSessionStateSchema = t.Object({
  state: t.Union([t.Literal('running'), t.Literal('stopped')]),
  current: t.Optional(t.Object({
    reservationId: t.String(),
    adId: t.String(),
    title: t.String(),
    imageUrl: t.String(),
    durationSec: t.Number(),
    startedAt: t.String(),
    sessionId: t.String()
  })),
  sessionId: t.Optional(t.String()),
  lastEvent: t.Optional(t.String()),
  reason: t.Optional(t.String()),
  participantCount: t.Optional(t.Number()),
  minParticipants: t.Optional(t.Number())
});

export const adsRoutes = new Elysia({ prefix: '/ads' })
  .group('/public', (app) =>
    app
      .post('/quote', ({ body }) => {
        const { rooms, minutes } = body as any;
        const priceUsd = (rooms || 0) * (minutes || 0) * 1;
        return successResponse({ priceUsd });
      }, {
        body: t.Object({
          rooms: t.Number({ minimum: 1, description: 'Number of rooms to advertise in' }),
          minutes: t.Number({ minimum: 1, description: 'Duration in minutes per room' })
        }),
        response: {
          200: GetQuoteResponseSchema
        },
        detail: {
          tags: ['Ads'],
          summary: 'Get Ad Quote',
          description: `
Calculates the price for an advertisement campaign.

**Pricing Formula:**
\`priceUsd = rooms × minutes × $1\`

**Example:**
- 10 rooms × 5 minutes = $50

**Note:** This is a public endpoint for price discovery before purchase.
          `
        }
      })

      .post('/test-distribute/:roomId', async ({ params, set }) => {
        try {
          console.log('🧪 Test distribute endpoint called for roomId:', params.roomId);
          const result = await adRevDistribute(params.roomId);
          console.log('✅ Test distribute completed:', result);
          return successResponse(result || { message: 'Distribution completed' });
        } catch (e) {
          console.error('❌ Test distribute failed:', e);
          set.status = 500;
          return errorResponse(e instanceof Error ? e.message : 'Failed to distribute ad revenue');
        }
      }, {
        params: t.Object({
          roomId: t.String({ description: 'MongoDB ObjectId of the room' })
        }),
        response: {
          200: TestDistributeResponseSchema,
          500: ErrorResponse
        },
        detail: {
          tags: ['Ads'],
          summary: 'Test Ad Revenue Distribution',
          description: `
**Development/Testing Endpoint**

Manually triggers ad revenue distribution for a room.

**Use Case:**
Testing the payout calculation and distribution logic without ending a room.

**Warning:** This is primarily for development and debugging purposes.
          `
        }
      })
  )
  .guard({ beforeHandle: authMiddleware })
  .group('/protected', (app) =>
    app
      .post('/create', async ({ headers, body, set }) => {
        try {
          const userFid = headers['x-user-privyid'] as string;
          if (!userFid) { set.status = 401; return errorResponse('User authentication required'); }
          const user = await User.findOne({ privyId: userFid });
          if (!user) { set.status = 404; return errorResponse('User not found'); }

          console.log('Advertisement creation request body:', body);
          console.log('Body type:', typeof body);
          console.log('Body keys:', Object.keys(body || {}));

          // Extract form data from body - Elysia parses formdata into an object
          const formData = body as any;
          const title = formData.title as string;
          const image = formData.image as File;
          const rooms = parseInt(formData.rooms as string);
          const minutes = parseInt(formData.minutes as string);
          const txHashes = normalizeTxHashes((formData as any).txhashes ?? (formData as any).txHashes);
          const minParticipantsRaw = formData.minParticipants ?? formData.min_participants ?? formData.minparticipants;
          const minParticipants = minParticipantsRaw ? parseInt(String(minParticipantsRaw)) : DEFAULT_MIN_PARTICIPANTS;

          if (!title || !image || !rooms || !minutes) {
            set.status = 400; return errorResponse('Missing required fields');
          }

          if (isNaN(rooms) || rooms < 1) {
            set.status = 400; return errorResponse('Rooms must be a number greater than 0');
          }

          if (isNaN(minutes) || minutes < 1) {
            set.status = 400; return errorResponse('Minutes must be a number greater than 0');
          }

          // Validate image file
          if (!image || !image.type || !image.type.startsWith('image/')) {
            set.status = 400; return errorResponse('File must be an image');
          }

          // Upload image to S3
          let imageUrl: string;
          try {
            imageUrl = await s3UploadService.uploadFile(image, 'advertisements');
          } catch (uploadError) {
            console.error('S3 upload error:', uploadError);
            set.status = 500; return errorResponse('Failed to upload image');
          }

          const ad = await Advertisement.create({
            title,
            imageUrl,
            minutesPerRoom: minutes,
            totalRooms: rooms,
            roomsRemaining: rooms,
            minParticipants,
            status: 'active',
            txHashes: txHashes ?? []
          });

          return successResponse({
            id: String(ad._id),
            title: ad.title,
            imageUrl: ad.imageUrl,
            minutesPerRoom: ad.minutesPerRoom,
            totalRooms: ad.totalRooms,
            roomsRemaining: ad.roomsRemaining,
            minParticipants: ad.minParticipants,
            status: ad.status,
            txHashes: ad.txHashes ?? []
          });
        } catch (e) {
          console.error('Advertisement creation error:', e);
          set.status = 500; return errorResponse('Failed to create advertisement');
        }
      }, {
        type: 'formdata',
        response: {
          200: CreateAdResponseSchema,
          400: ErrorResponse,
          401: ErrorResponse,
          404: ErrorResponse,
          500: ErrorResponse
        },
        detail: {
          tags: ['Ads'],
          summary: 'Create Advertisement',
          description: `
Creates a new advertisement campaign.

**Form Data Fields:**
- \`title\`: Ad title (required)
- \`image\`: Image file (required, must be image type)
- \`rooms\`: Number of rooms (required, ≥1)
- \`minutes\`: Duration per room in minutes (required, ≥1)
- \`minParticipants\`: Minimum participants to show ad (default: 1, max: 1000)
- \`txHashes\`: Payment transaction hashes (optional, array or comma-separated)

**Process:**
1. Validates input
2. Uploads image to S3
3. Creates advertisement record
4. Returns created advertisement

**Ad Lifecycle:**
- Created as "active"
- \`roomsRemaining\` decrements as ads are shown
- Status changes to "completed" when \`roomsRemaining\` reaches 0

**Authentication Required:** Yes (Farcaster JWT)
          `,
          security: [{ bearerAuth: [] }]
        }
      })

      .get('/active', async () => {
        const ads = await Advertisement.find({ status: 'active', roomsRemaining: { $gt: 0 } }).sort({ createdAt: 1 }).lean();
        return successResponse({ ads });
      }, {
        response: {
          200: GetActiveAdsResponseSchema
        },
        detail: {
          tags: ['Ads'],
          summary: 'Get Active Advertisements',
          description: `
Retrieves all active advertisements with remaining inventory.

**Filters Applied:**
- \`status: 'active'\`
- \`roomsRemaining > 0\`

**Sort:** By creation date (oldest first - FIFO for fairness)

**Use Case:**
Checking available ad inventory, admin dashboard.

**Authentication Required:** Yes (Farcaster JWT)
          `,
          security: [{ bearerAuth: [] }]
        }
      })

      .post('/rooms/:roomId/start', async ({ params, headers, body, set }) => {
        try {
          const userFid = headers['x-user-privyid'] as string;
          if (!userFid) { set.status = 401; return errorResponse('User authentication required'); }
          const user = await User.findOne({ privyId: userFid });
          if (!user) { set.status = 404; return errorResponse('User not found'); }

          console.log('[ads] start request received', { roomId: params.roomId, userFid });

          const room = await Room.findById(params.roomId).populate('host', '_id');
          if (!room) { set.status = 404; return errorResponse('Room not found'); }
          if (String((room as any).host._id) !== String(user._id)) { set.status = 403; return errorResponse('Only the room host can start ads'); }

          const { webhookUrl } = body as any;
          const participantCount = await getActiveParticipantCount(params.roomId);
          const result = await startAdsSession(params.roomId, {
            webhookUrl,
            participantCountOverride: participantCount,
            room,
            initiatedBy: 'manual'
          });

          if (!result.started) {
            console.warn('[ads] start request did not start session', {
              roomId: params.roomId,
              reason: result.reason,
              participantCount: result.participantCount
            });
          }

          return successResponse({
            sessionId: result.sessionId,
            started: result.started,
            reason: result.reason,
            participantCount: result.participantCount
          });
        } catch (e) {
          console.error('[ads] failed to start ads session', {
            roomId: params.roomId,
            error: e instanceof Error ? e.message : e
          });
          set.status = 500; return errorResponse('Failed to start ads session');
        }
      }, {
        params: t.Object({
          roomId: t.String({ description: 'MongoDB ObjectId of the room' })
        }),
        body: t.Optional(t.Object({ 
          webhookUrl: t.Optional(t.String({ description: 'Custom webhook URL for ad events' })) 
        })),
        response: {
          200: StartAdsSessionResponseSchema,
          401: ErrorResponse,
          403: ErrorResponse,
          404: ErrorResponse,
          500: ErrorResponse
        },
        detail: {
          tags: ['Ads'],
          summary: 'Start Ads Session',
          description: `
Manually starts an ad session for a room.

**Authorization:** Only the room host can start ads.

**Process:**
1. Validates room and authorization
2. Checks for eligible ads (inventory, participant threshold)
3. Allocates first ad
4. Starts rotation timer
5. Sends webhook events

**Possible Reasons for Not Starting:**
- \`room_not_found\`: Room doesn't exist
- \`ads_disabled\`: Room has ads disabled
- \`no_eligible_ads\`: No ads match criteria
- \`already_running\`: Session already active
- \`start_in_progress\`: Another start request is processing

**Webhooks Sent:**
- \`ads.session.started\`: Session initialized
- \`ads.ad.started\`: First ad begins

**Authentication Required:** Yes (Farcaster JWT)
          `,
          security: [{ bearerAuth: [] }]
        }
      })

      .post('/rooms/:roomId/stop', async ({ params, headers, body, set }) => {
        try {
          const userFid = headers['x-user-privyid'] as string;
          if (!userFid) { set.status = 401; return errorResponse('User authentication required'); }
          const user = await User.findOne({ privyId: userFid });
          if (!user) { set.status = 404; return errorResponse('User not found'); }

          const room = await Room.findById(params.roomId).populate('host', '_id');
          if (!room) { set.status = 404; return errorResponse('Room not found'); }
          if (String((room as any).host._id) !== String(user._id)) { set.status = 403; return errorResponse('Only the room host can stop ads'); }

          const result = await stopAdsSession(params.roomId, 'manual_stop');

          return successResponse({ stopped: result.stopped, sessionId: result.sessionId });
        } catch (e) {
          set.status = 500; return errorResponse('Failed to stop ads session');
        }
      }, {
        params: t.Object({
          roomId: t.String({ description: 'MongoDB ObjectId of the room' })
        }),
        response: {
          200: StopAdsSessionResponseSchema,
          401: ErrorResponse,
          403: ErrorResponse,
          404: ErrorResponse,
          500: ErrorResponse
        },
        detail: {
          tags: ['Ads'],
          summary: 'Stop Ads Session',
          description: `
Manually stops an active ad session for a room.

**Authorization:** Only the room host can stop ads.

**Actions:**
1. Sets session state to "stopped"
2. Cancels current ad assignment
3. Clears rotation timer
4. Sends \`ads.session.stopped\` webhook

**Use Case:**
Host wants to disable ads mid-room without ending the room.

**Authentication Required:** Yes (Farcaster JWT)
          `,
          security: [{ bearerAuth: [] }]
        }
      })

      .post('/rooms/:roomId/room-ended', async ({ params, headers, set }) => {
        try {
          const userFid = headers['x-user-privyid'] as string;
          if (!userFid) { set.status = 401; return errorResponse('User authentication required'); }
          const user = await User.findOne({ privyId: userFid });
          if (!user) { set.status = 404; return errorResponse('User not found'); }

          const room = await Room.findById(params.roomId).populate('host', '_id');
          if (!room) { set.status = 404; return errorResponse('Room not found'); }
          if (String((room as any).host._id) !== String(user._id)) { set.status = 403; return errorResponse('Only the room host can stop ads'); }

          const result = await stopAdsSession(params.roomId, 'room_ended');
          
          console.log(`[ads] Room ${params.roomId} ended - payout will be processed by daily cron`);

          return successResponse({ stopped: result.stopped, sessionId: result.sessionId });
        } catch (e) {
          set.status = 500; return errorResponse('Failed to stop ads session');
        }
      }, {
        params: t.Object({
          roomId: t.String({ description: 'MongoDB ObjectId of the room' })
        }),
        response: {
          200: RoomEndedAdsResponseSchema,
          401: ErrorResponse,
          403: ErrorResponse,
          404: ErrorResponse,
          500: ErrorResponse
        },
        detail: {
          tags: ['Ads'],
          summary: 'Signal Room Ended (Ads)',
          description: `
Signals that a room has ended and stops any active ad sessions.

**Authorization:** Only the room host can call this.

**Actions:**
1. Stops ad session with reason "room_ended"
2. Flushes view tracking data


**Authentication Required:** Yes (Farcaster JWT)
          `,
          security: [{ bearerAuth: [] }]
        }
      })

      .get('/sessions/:roomId', async ({ params }) => {
        let snapshot = await getRoomSnapshot(params.roomId);

        if (!snapshot) {
          const recovered = await recoverRoomAdSession(params.roomId);
          if (recovered?.current) {
            snapshot = await getRoomSnapshot(params.roomId);
            if (!snapshot) {
              snapshot = {
                roomId: params.roomId,
                state: recovered.state,
                sessionId: recovered.current.sessionId,
                current: toSnapshotCurrent(recovered.current),
                lastEvent: 'ads.ad.started',
                reason: null,
                participantCount: recovered.current.participantCountAtStart,
                minParticipants: recovered.current.minParticipants,
                updatedAt: new Date().toISOString()
              };
            }
          }
        }

        if (!snapshot) {
          return successResponse({ state: 'stopped', current: null });
        }

        return successResponse({
          state: snapshot.state,
          current: snapshot.current,
          sessionId: snapshot.sessionId,
          lastEvent: snapshot.lastEvent,
          reason: snapshot.reason,
          updatedAt: snapshot.updatedAt,
          participantCount: snapshot.participantCount,
          minParticipants: snapshot.minParticipants
        });
      }, {
        params: t.Object({
          roomId: t.String({ description: 'MongoDB ObjectId of the room' })
        }),
        response: {
          200: GetAdSessionResponseSchema
        },
        detail: {
          tags: ['Ads'],
          summary: 'Get Ads Session State',
          description: `
Retrieves the current state of the ad session for a room.

**Response Fields:**
- \`state\`: "running" or "stopped"
- \`current\`: Currently playing ad (if any)
- \`sessionId\`: Current session identifier
- \`lastEvent\`: Last webhook event type
- \`reason\`: Reason for current state (if stopped)
- \`participantCount\`: Active participants at last update
- \`minParticipants\`: Minimum required for current/last ad

**Recovery:**
If no cached state exists, attempts to recover from database.

**Use Case:**
Frontend polling for current ad display, debugging ad state.

**Authentication Required:** Yes (Farcaster JWT)
          `,
          security: [{ bearerAuth: [] }]
        }
      })
  );

export { allocateNextAd, restoreRoomAdRotations };
