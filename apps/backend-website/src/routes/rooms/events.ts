import { Elysia, t } from 'elysia';
import { RedisUtils } from '../../services/redis';
import { errorResponse, successResponse } from '../../utils';

/**
 * Room Events Relay
 *
 * Provides a lightweight Redis-backed event relay for real-time custom events
 * between peers in a room. Used because Agora Web SDK NG does not support
 * data streams / peer messaging.
 *
 * Redis key: room:{roomId}:events  (Sorted Set, score = timestamp ms)
 * Each event auto-expires after 60 seconds.
 */

const EVENTS_TTL = 60; // seconds
const MAX_EVENTS = 200; // max events kept per room

function eventsKey(roomId: string) {
  return `room:${roomId}:events`;
}

export const eventRoutes = new Elysia()
  .group('/public', (app) =>
    app
      /**
       * POST /rooms/public/:id/events
       * Push a custom event into the room's event stream.
       */
      .post('/:id/events', async ({ params, body, set }) => {
        try {
          const { type, data, senderId } = body as any;
          if (!type) {
            set.status = 400;
            return errorResponse('Missing event type');
          }

          const client = await RedisUtils.getClient();
          const key = eventsKey(params.id);
          const now = Date.now();

          const event = JSON.stringify({ type, data, senderId, ts: now });

          const pipeline = client.pipeline();
          pipeline.zadd(key, now, event);
          // Trim old events
          pipeline.zremrangebyscore(key, '-inf', String(now - EVENTS_TTL * 1000));
          // Cap total size
          pipeline.zremrangebyrank(key, 0, -(MAX_EVENTS + 1));
          pipeline.expire(key, EVENTS_TTL);
          await pipeline.exec();

          return successResponse({ sent: true });
        } catch (error) {
          console.error('Error posting room event:', error);
          set.status = 500;
          return errorResponse('Failed to post event');
        }
      }, {
        params: t.Object({ id: t.String() }),
        body: t.Object({
          type: t.String(),
          data: t.Any(),
          senderId: t.Optional(t.Union([t.Number(), t.String()])),
        }),
      })

      /**
       * GET /rooms/public/:id/events?since=<timestamp>
       * Poll for events newer than `since` (millisecond timestamp).
       */
      .get('/:id/events', async ({ params, query, set }) => {
        try {
          const since = Number(query.since) || 0;
          const client = await RedisUtils.getClient();
          const key = eventsKey(params.id);

          // Fetch events with score > since
          const raw = await client.zrangebyscore(key, `(${since}`, '+inf');

          const events = raw.map((r: string) => {
            try { return JSON.parse(r); } catch { return null; }
          }).filter(Boolean);

          return successResponse({ events });
        } catch (error) {
          console.error('Error fetching room events:', error);
          set.status = 500;
          return errorResponse('Failed to fetch events');
        }
      }, {
        params: t.Object({ id: t.String() }),
        query: t.Object({
          since: t.Optional(t.String()),
        }),
      })
  );
