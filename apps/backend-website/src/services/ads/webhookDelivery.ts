import crypto from 'crypto';
import config from '../../config';
import { RedisUtils } from '../redis/redis-utils';

export interface WebhookRetryJob {
  url: string;
  event: string;
  payload: any;
  idempotencyKey: string;
  attempt?: number;
  maxAttempts?: number;
}

const DEFAULT_MAX_ATTEMPTS = 8;
const BASE_DELAY_SECONDS = 5;
const MAX_DELAY_SECONDS = 300;

function hmacSignature(secret: string, timestamp: string, body: string) {
  const payload = `${timestamp}.${body}`;
  return `sha256=${crypto.createHmac('sha256', secret).update(payload).digest('hex')}`;
}

export async function sendWebhookRequest(url: string, event: string, payload: any, idempotencyKey: string) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const body = JSON.stringify(payload);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Ads-Event': event,
    'X-Ads-Timestamp': timestamp,
    'Idempotency-Key': idempotencyKey
  };

  headers['X-Ads-Signature'] = hmacSignature(config.adsWebhookSecret, timestamp, body);

  const res = await fetch(url, { method: 'POST', headers, body });
  if (!res.ok) {
    throw new Error(`Webhook delivery failed: ${res.status}`);
  }
}

export async function enqueueWebhookRetry(job: WebhookRetryJob) {
  const scheduleKey = RedisUtils.adKeys.webhookRetryScheduled();
  const attempt = job.attempt ?? 1;
  const maxAttempts = job.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const delaySeconds = Math.min(MAX_DELAY_SECONDS, Math.pow(2, attempt - 1) * BASE_DELAY_SECONDS);
  const readyAt = Date.now() + delaySeconds * 1000;

  const jobRecord = {
    ...job,
    attempt,
    maxAttempts,
    readyAt
  };

  const client = await RedisUtils.getClient();
  await client.zadd(scheduleKey, readyAt, JSON.stringify(jobRecord));
}

export { hmacSignature, DEFAULT_MAX_ATTEMPTS };



