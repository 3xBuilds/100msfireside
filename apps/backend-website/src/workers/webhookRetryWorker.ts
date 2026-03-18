import { RedisUtils } from '../services/redis/redis-utils';
import { enqueueWebhookRetry, sendWebhookRequest, WebhookRetryJob } from '../services/ads/webhookDelivery';

const RETRY_INTERVAL_MS = 5000;
const MAX_JOBS_PER_TICK = 25;

let workerTimer: NodeJS.Timeout | null = null;
let isProcessing = false;

type StoredWebhookJob = WebhookRetryJob & {
  readyAt?: number;
  maxAttempts?: number;
};

async function processDueWebhookJobs() {
  if (isProcessing) return;
  isProcessing = true;

  const lockKey = RedisUtils.adKeys.webhookRetryLock();
  const acquired = await RedisUtils.acquireLock(lockKey, 5);
  if (!acquired) {
    isProcessing = false;
    return;
  }

  try {
    const client = await RedisUtils.getClient();
    const scheduleKey = RedisUtils.adKeys.webhookRetryScheduled();
    const now = Date.now();
    const jobs = await client.zrangebyscore(scheduleKey, 0, now, 'LIMIT', 0, MAX_JOBS_PER_TICK);

    for (const jobString of jobs) {
      await client.zrem(scheduleKey, jobString);

      let job: StoredWebhookJob | null = null;
      try {
        job = JSON.parse(jobString);
      } catch (err) {
        console.error('Invalid webhook retry job payload', err);
        continue;
      }

      if (!job?.url || !job?.event || !job?.payload || !job?.idempotencyKey) {
        console.warn('Skipping malformed webhook retry job', job);
        continue;
      }

      const attempt = job.attempt ?? 1;
      const maxAttempts = job.maxAttempts ?? 8;

      try {
        await sendWebhookRequest(job.url, job.event, job.payload, job.idempotencyKey);
      } catch (err) {
        if (attempt >= maxAttempts) {
          console.error('Dropping webhook job after max attempts', { url: job.url, event: job.event });
          continue;
        }

        await enqueueWebhookRetry({
          url: job.url,
          event: job.event,
          payload: job.payload,
          idempotencyKey: job.idempotencyKey,
          attempt: attempt + 1,
          maxAttempts
        });
      }
    }
  } catch (err) {
    console.error('Failed to process webhook retry jobs', err);
  } finally {
    await RedisUtils.releaseLock(lockKey);
    isProcessing = false;
  }
}

export function startWebhookRetryWorker() {
  if (workerTimer) return;

  workerTimer = setInterval(() => {
    processDueWebhookJobs().catch((err) => {
      console.error('Webhook retry worker encountered an error', err);
    });
  }, RETRY_INTERVAL_MS);

  if (typeof workerTimer.unref === 'function') {
    workerTimer.unref();
  }
}



