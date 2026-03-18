import { RedisUtils } from '../services/redis/redis-utils';

const SCHEDULE_KEY = 'webhook:retry:scheduled';
const MAX_ATTEMPTS = 5;

async function tryDeliver(url: string, headers: Record<string, string>, body: string) {
  const res = await fetch(url, { method: 'POST', headers, body });
  if (!res.ok) throw new Error(`Webhook retry failed: ${res.status}`);
}

export async function processWebhookRetries(now: number = Date.now()): Promise<void> {
  const client = await RedisUtils.getClient();
  // Pull up to 50 ready jobs
  const maxScore = now;
  const jobs = await client.zrangebyscore(SCHEDULE_KEY, 0, maxScore, 'LIMIT', 0, 50);

  for (const raw of jobs) {
    try {
      await client.zrem(SCHEDULE_KEY, raw);
      const job = JSON.parse(raw);
      const body = JSON.stringify(job.payload);
      await tryDeliver(job.url, job.headers || {}, body);
    } catch (err) {
      // reschedule with backoff if attempts remain
      try {
        const job = JSON.parse(raw);
        const attempt = (job.attempt || 1) + 1;
        if (attempt <= MAX_ATTEMPTS) {
          const delaySec = Math.min(60, Math.pow(4, attempt - 1)); // 5,20,80->cap60
          const readyAt = Date.now() + delaySec * 1000;
          const next = { ...job, attempt, readyAt };
          await client.zadd(SCHEDULE_KEY, readyAt, JSON.stringify(next));
        }
      } catch {}
    }
  }
}

// Reservation reaper: cancel expired and restore inventory
import AdAssignment from '../models/AdAssignment';
import Advertisement from '../models/Advertisement';

export async function reapExpiredReservations(nowMs: number = Date.now()): Promise<void> {
  const now = new Date(nowMs);
  const expired = await AdAssignment.find({ status: { $in: ['reserved', 'started'] }, expiresAt: { $lt: now } }).limit(100);
  for (const r of expired) {
    try {
      // restore inventory only if not completed
      await Advertisement.updateOne({ _id: r.adId }, { $inc: { roomsRemaining: 1 } });
      r.status = 'canceled';
      r.canceledAt = new Date();
      await r.save();
    } catch {}
  }
}


