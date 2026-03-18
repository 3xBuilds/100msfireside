import { NextRequest, NextResponse } from 'next/server';
import { isDuplicateIdempotency } from '@/utils/adsCache';
import { clearRoomSnapshot, fetchRoomSnapshot, updateRoomSnapshot } from '@/utils/adsStore';
import { verifyAdsWebhook } from '@/utils/adsWebhook';

const shouldLog = process.env.NODE_ENV !== 'production';
const logAdsWebhook = (message: string, meta?: Record<string, unknown>) => {
  if (!shouldLog) return;
  const timestamp = new Date().toISOString();
  if (meta) {
    console.log(`[${timestamp}] [AdsWebhook] ${message}`, meta);
  } else {
    console.log(`[${timestamp}] [AdsWebhook] ${message}`);
  }
};

export async function GET(req: NextRequest) {
  const roomId = req.nextUrl.searchParams.get('roomId');
  if (!roomId) {
    return NextResponse.json({ error: 'roomId is required' }, { status: 400 });
  }

  const snapshot = await fetchRoomSnapshot(roomId);
  logAdsWebhook('Cache requested', {
    roomId,
    state: snapshot.state,
    hasCurrent: Boolean(snapshot.current),
  });
  return NextResponse.json(snapshot);
}

export async function POST(req: NextRequest) {
  const secret = process.env.ADS_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'ADS_WEBHOOK_SECRET is not configured' }, { status: 500 });
  }

  const body = await req.text();
  const signature = req.headers.get('x-ads-signature') || undefined;
  const timestamp = req.headers.get('x-ads-timestamp') || undefined;
  const eventType = req.headers.get('x-ads-event') || undefined;
  const idempotencyKey = req.headers.get('idempotency-key') || undefined;

  const isValid = verifyAdsWebhook(signature, timestamp, body, secret);
  if (!isValid) {
    logAdsWebhook('Invalid webhook signature', { eventType, timestamp });
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  if (isDuplicateIdempotency(idempotencyKey)) {
    logAdsWebhook('Duplicate webhook skipped', { eventType, idempotencyKey });
    return NextResponse.json({ ok: true, deduped: true });
  }

  let payload: any;
  try {
    payload = JSON.parse(body);
  } catch (error) {
    console.error('Failed to parse ads webhook payload', error);
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const roomId = payload?.roomId;
  if (!roomId) {
    return NextResponse.json({ error: 'Missing roomId in payload' }, { status: 400 });
  }

  logAdsWebhook('Event received', {
    eventType,
    roomId,
    reservationId: payload?.reservationId,
    sessionId: payload?.sessionId,
  });

  switch (eventType) {
    case 'ads.session.started':
      await updateRoomSnapshot(roomId, (prev) => ({
        ...prev,
        state: 'running',
        sessionId: payload.sessionId ?? prev.sessionId,
        sessionStartedAt: payload.startedAt ?? prev.sessionStartedAt,
      }));
      logAdsWebhook('Session marked running', {
        roomId,
        sessionId: payload.sessionId,
      });
      break;
    case 'ads.ad.started':
      if (payload.reservationId) {
        await updateRoomSnapshot(roomId, (prev) => ({
          ...prev,
          state: 'running',
          sessionId: payload.sessionId ?? prev.sessionId,
          sessionStartedAt: payload.startedAt ?? prev.sessionStartedAt,
          current: {
            reservationId: payload.reservationId,
            adId: payload.adId,
            title: payload.title,
            imageUrl: payload.imageUrl,
            durationSec: payload.durationSec,
            startedAt: payload.startedAt,
            sessionId: payload.sessionId ?? prev.sessionId ?? '',
          },
        }));
        logAdsWebhook('Ad cached', {
          roomId,
          reservationId: payload.reservationId,
          adId: payload.adId,
          durationSec: payload.durationSec,
        });
      }
      break;
    case 'ads.ad.completed':
      if (payload.reservationId) {
        await updateRoomSnapshot(roomId, (prev) => {
          if (prev.current?.reservationId !== payload.reservationId) {
            return prev;
          }
          const next = { ...prev };
          delete next.current;
          return next;
        });
        logAdsWebhook('Ad completion processed', {
          roomId,
          reservationId: payload.reservationId,
        });
      }
      break;
    case 'ads.session.stopped':
    case 'ads.session.idle':
      await clearRoomSnapshot(roomId);
      logAdsWebhook('Session stopped', {
        roomId,
        sessionId: payload.sessionId,
        reason: eventType === 'ads.session.idle' ? payload?.reason || 'idle' : 'stopped',
      });
      break;
    default:
      console.warn('Unhandled ads webhook event', eventType);
      logAdsWebhook('Unhandled event', { eventType, roomId });
      break;
  }

  return NextResponse.json({ ok: true });
}

