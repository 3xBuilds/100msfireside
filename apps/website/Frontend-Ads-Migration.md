# Frontend Migration: Global Ads via Webhooks

This document explains how to remove legacy sponsorship UX and integrate the new global advertising system using webhooks.

## Remove legacy sponsorship
- Delete Sponsorship pages/views, modals, and API clients.
- Remove `sponsorshipEnabled` usage from room create/update forms and any search filters.
- Remove calls to `/api/sponsorships/*`.

## Purchase flow (UI)
1) Quote price
- POST `/api/ads/public/quote` with `{ rooms, minutes }` → `{ priceUsd }`.
2) Wallet payment
- Process payment in the wallet; obtain `txHash` from success.
3) Create advertisement
- POST `/api/ads/protected/create` with `{ title, imageUrl, rooms, minutes, txHash }` and auth header `Authorization: Bearer <quick-auth token>`.
- On success, show confirmation.

## Host flow (single press)
- On a live room page (host only), add a "Display Ads" button:
  - POST `/api/ads/protected/rooms/:roomId/start` with body `{ webhookUrl }`.
  - After this, the backend pushes webhooks to `webhookUrl` and auto-rotates ads until stopped or inventory ends.
- Add a "Stop Ads" button:
  - POST `/api/ads/protected/rooms/:roomId/stop`.
- On room end, also call:
  - POST `/api/ads/protected/rooms/:roomId/room-ended`.

## Late joiners (seeing the current ad)
- Maintain a small cache per `roomId` on your server for the current ad with `startedAt` and `durationSec`.
- When a user joins a room, perform a one-time fetch to:
  - `GET /api/ads/protected/sessions/:roomId` → returns `{ state: 'running'|'stopped', current?: { reservationId, adId, title, imageUrl, durationSec, startedAt, sessionId } }`.
- If `current` exists, compute remaining time and display the ad:
```ts
function remainingMs(current: { durationSec: number; startedAt: string }) {
  const end = new Date(current.startedAt).getTime() + current.durationSec * 1000;
  return Math.max(0, end - Date.now());
}
```
- Optionally broadcast the cached current ad to new clients via your own realtime channel.

## Webhook server endpoint (frontend or middleware API)
- Create an HTTP endpoint that is publicly reachable; e.g. `POST /api/webhooks/ads`.
- Validate headers on every request:
  - `X-Ads-Event`: string (see events below)
  - `X-Ads-Timestamp`: unix seconds
  - `X-Ads-Signature`: `sha256=HMAC_SHA256(timestamp + '.' + body, ADS_WEBHOOK_SECRET)`
  - `Idempotency-Key`: use to dedupe event processing
- Recommended routing: use a lightweight serverless route or Next.js API route. Ensure it returns 2xx quickly (<500ms).

### Signature validation (TypeScript example)
```ts
import crypto from 'crypto';

function safeTimingEqual(a: string, b: string) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export function verifyAdsWebhook(signatureHeader: string, timestamp: string, body: string, envSecret: string) {
  const expected = 'sha256=' + crypto.createHmac('sha256', envSecret).update(`${timestamp}.${body}`).digest('hex');
  return safeTimingEqual(expected, signatureHeader || '');
}
```

### Events to handle
- `ads.session.started`: `{ roomId, sessionId, startedAt }`
- `ads.ad.started`: `{ roomId, sessionId, reservationId, adId, title, imageUrl, durationSec, startedAt }`
- `ads.ad.completed`: `{ roomId, sessionId, reservationId, adId, completedAt }`
- `ads.session.stopped`: `{ roomId, sessionId, stoppedAt }`
- `ads.session.idle`: `{ roomId, sessionId, reason: 'no_inventory' }`

### UI state updates
- On `ads.ad.started`:
  - Render the ad (title + image).
  - Start a local countdown with `durationSec` purely for UX.
- On `ads.ad.completed`:
  - Hide the ad if no new `ads.ad.started` arrives within ~1s.
  - Also clear the cached `current` ad for that `roomId`.
- On `ads.session.stopped`:
  - Immediately hide the ad; mark session inactive.
- On `ads.session.idle`:
  - Hide the ad; show a small note ("No ads available").

### Idempotency and retries
- Use `Idempotency-Key` to dedupe processing (store last N keys for a few minutes).
- The backend retries failed webhooks with exponential backoff. Your endpoint must be idempotent and safe to receive duplicates.

## Minimal host UI wiring (pseudo)
```ts
async function startAds(roomId: string, webhookUrl: string, webhookSecret: string) {
  await fetch(`/api/ads/protected/rooms/${roomId}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ webhookUrl, webhookSecret })
  });
}

async function stopAds(roomId: string) {
  await fetch(`/api/ads/protected/rooms/${roomId}/stop`, { method: 'POST' });
}

async function onRoomEnded(roomId: string) {
  await fetch(`/api/ads/protected/rooms/${roomId}/room-ended`, { method: 'POST' });
}
```

## Security recommendations
- Keep `ADS_WEBHOOK_SECRET` server-side only; never expose it to the browser.
- Rate-limit the webhook endpoint and log failed validations.
- Validate `X-Ads-Timestamp` is recent (e.g., within 5 minutes) to mitigate replay.

## Testing
- Use a public tunnel (e.g., ngrok) to receive webhooks locally.
- Verify signature failures return non-2xx to trigger backend retries.
- Test stop-mid-ad: start → stop within a few seconds and verify no inventory decrement.

## Removal checklist
- [ ] Delete sponsorship components/routes/state
- [ ] Remove sponsorship API calls
- [ ] Update room forms (no sponsorshipEnabled)
- [ ] Add purchase UI and ads session controls
- [ ] Implement webhook endpoint and UI event handling

