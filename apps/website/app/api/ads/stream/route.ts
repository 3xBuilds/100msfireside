import { NextRequest, NextResponse } from 'next/server';
import { fetchRoomSnapshot, roomChannel, RoomSnapshot } from '@/utils/adsStore';
import { getRedisClient } from '@/utils/redis';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const encoder = new TextEncoder();
const KEEP_ALIVE_MS = 10_000;

function formatEvent(data: RoomSnapshot | string) {
  const payload = typeof data === 'string' ? data : JSON.stringify(data);
  return `event: ad-state\ndata: ${payload}\n\n`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const roomId = searchParams.get('roomId');

  if (!roomId) {
    return NextResponse.json({ error: 'roomId is required' }, { status: 400 });
  }

  const redis = getRedisClient();
  const subscriber = redis.duplicate();
  const channel = roomChannel(roomId);

  const ensureConnected = async () => {
    if (subscriber.status === 'ready' || subscriber.status === 'connecting') {
      return;
    }
    if (subscriber.status === 'wait' || subscriber.status === 'end') {
      await subscriber.connect();
    }
  };

  let cleanup: (() => Promise<void> | void) | null = null;
  let abortHandler: (() => void) | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      const sendSnapshot = (snapshot: RoomSnapshot | string) => {
        controller.enqueue(encoder.encode(formatEvent(snapshot)));
      };

      sendSnapshot(await fetchRoomSnapshot(roomId));

      await ensureConnected();
      if (subscriber.status !== 'ready') {
        await new Promise<void>((resolve, reject) => {
          const onReady = () => {
            subscriber.removeListener('error', onError);
            resolve();
          };
          const onError = (err: Error) => {
            subscriber.removeListener('ready', onReady);
            reject(err);
          };
          subscriber.once('ready', onReady);
          subscriber.once('error', onError);
        });
      }
      const onMessage = (incomingChannel: string, message: string) => {
        if (incomingChannel !== channel) {
          return;
        }
        if (!message || message === 'null') {
          return;
        }
        sendSnapshot(message);
      };

      subscriber.on('message', onMessage);
      await subscriber.subscribe(channel);

      controller.enqueue(encoder.encode(`: keep-alive ${Date.now()}\n\n`));
      const keepAlive = setInterval(() => {
        controller.enqueue(encoder.encode(`: keep-alive ${Date.now()}\n\n`));
      }, KEEP_ALIVE_MS);

      cleanup = async () => {
        clearInterval(keepAlive);
        try {
          await subscriber.unsubscribe(channel);
        } catch {
          // ignore
        }
        subscriber.off('message', onMessage);
        if (subscriber.status !== 'end') {
          try {
            await subscriber.quit();
          } catch {
            subscriber.disconnect();
          }
        }
        if (abortHandler) {
          req.signal.removeEventListener('abort', abortHandler);
          abortHandler = null;
        }
        cleanup = null;
      };

      const abort = req.signal;
      if (abort.aborted) {
        await cleanup?.();
        controller.close();
        return;
      }

      abortHandler = () => {
        cleanup?.();
        try {
          controller.close();
        } catch {
          // ignore
        }
      };

      abort.addEventListener('abort', abortHandler, { once: true });
    },
    async cancel() {
      await cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
