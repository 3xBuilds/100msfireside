# Global Ads via Webhooks

This backend implements host-triggered global advertising with webhook delivery. Polling and sockets are not used.

## Purchase flow
- POST /api/ads/public/quote { rooms, minutes } → { priceUsd }
- Frontend processes crypto payment and obtains txhashes array
- POST /api/ads/protected/create { title, imageUrl, rooms, minutes, txhashes } with x-user-fid

Pricing: $1/minute × rooms × minutes. The txhashes are stored; no on-chain verification.

## Host session flow
- Host presses Display Ads once in a live room
- POST /api/ads/protected/rooms/:roomId/start { webhookUrl }
- Backend pushes:
  - ads.session.started
  - ads.ad.started for first allocated ad (if inventory)
- Ads auto-rotate by duration until stopped or inventory ends
- Host presses Stop Ads or room ends:
  - POST /api/ads/protected/rooms/:roomId/stop (or /room-ended)
  - Current reservation is canceled; no inventory consumed; ads.session.stopped webhook is sent

## Webhook events
Headers:
- X-Ads-Event: one of events below
- X-Ads-Timestamp: unix seconds
- X-Ads-Signature: sha256=HMAC(timestamp + '.' + body, ADS_WEBHOOK_SECRET)
- Idempotency-Key: eventId

Events and payloads:
- ads.session.started: { roomId, sessionId, startedAt }
- ads.ad.started: { roomId, sessionId, reservationId, adId, title, imageUrl, durationSec, startedAt }
- ads.ad.completed: { roomId, sessionId, reservationId, adId, completedAt }
- ads.session.stopped: { roomId, sessionId, stoppedAt }
- ads.session.idle: { roomId, sessionId, reason: 'no_inventory' }

## Redis keys
- room:{roomId}:ads:state → 'running'|'stopped'
- room:{roomId}:ads:current → JSON of current reservation
- room:{roomId}:ads:lock → scheduler lock
- room:{roomId}:ads:webhook:retry → retry queue (internal)

## Notes
- One session and one reservation per room at a time
- On ad completion, inventory decremented; when zero, ad status → completed
- On stop/room-ended, reservation canceled; inventory not decremented

## Frontend migration
Remove all sponsorship features and calls. Add:
- A webhook endpoint that verifies X-Ads-Signature
- UI for purchase (quote → wallet payment → create)
- Host Display Ads Start/Stop buttons calling start/stop
- UI reacts to ads.ad.started / ads.ad.completed / ads.session.stopped / ads.session.idle
## Fireside Backend Documentation

**Tech stack**: Bun + TypeScript, Elysia (HTTP), MongoDB (Mongoose), Redis (ioredis), AWS S3, 100ms (HMS), Cron jobs

### Overview
- **Purpose**: REST backend for live audio/video rooms with chat, participants, global ads, search, and admin tasks.
- **Entry**: `src/index.ts` starts Elysia, mounts routes under `/api`, enables CORS for `FRONTEND_URL`, and registers cron jobs.
- **Response shape**: All routes return a standard envelope:
  - Success: `{ success: true, data?: any, message?: string }`
  - Error: `{ success: false, error: string, details?: string }` (details only in development)

### Quickstart
1) Prerequisites: Bun, MongoDB, Redis, AWS S3, 100ms account.
2) Install deps:
```bash
bun install
```
3) Configure environment (see Environment Variables).
4) Run dev:
```bash
bun run dev
```
5) Health check: `GET /health`

### Docker
Build and run container (envs required; see Dockerfile args):
```bash
docker build -t fireside-backend \
  --build-arg PORT=8000 \
  --build-arg NODE_ENV=production \
  --build-arg FRONTEND_URL=http://localhost:3000 \
  --build-arg MONGODB_URI=mongodb://host:27017/fireside \
  --build-arg REDIS_URL=redis://host:6379 \
  --build-arg AWS_ACCESS_KEY_ID=xxx \
  --build-arg AWS_SECRET_ACCESS_KEY=xxx \
  --build-arg AWS_REGION=us-east-1 \
  --build-arg S3_BUCKET_NAME=fireside-assets \
  --build-arg HUNDRED_MS_MANAGEMENT_TOKEN=xxx \
  --build-arg HUNDRED_MS_TEMPLATE_ID=xxx \
  .

docker run --rm -p 8000:8000 \
  -e PORT=8000 \
  -e NODE_ENV=production \
  -e FRONTEND_URL=http://localhost:3000 \
  -e MONGODB_URI=mongodb://host:27017/fireside \
  -e REDIS_URL=redis://host:6379 \
  -e AWS_ACCESS_KEY_ID=xxx \
  -e AWS_SECRET_ACCESS_KEY=xxx \
  -e AWS_REGION=us-east-1 \
  -e S3_BUCKET_NAME=fireside-assets \
  -e HUNDRED_MS_MANAGEMENT_TOKEN=xxx \
  -e HUNDRED_MS_TEMPLATE_ID=xxx \
  fireside-backend
```

### Base URL and Auth
- **Base URL**: All business routes are under `/api` (e.g. `/api/rooms`).
- **Auth**: Farcaster JWT via `Authorization: Bearer <jwt>`; middleware verifies with `DEV_JWT_DOMAIN` (dev) or request host. On success, middleware injects `x-user-fid` header for downstream handlers.
- **Admin**: `Authorization: Bearer <ADMIN_TOKEN>`.

### Environment Variables

Required/important:
- **Server**: `PORT` (default 8000), `NODE_ENV` (development|production), `FRONTEND_URL`
- **DB**: `MONGODB_URI` (DB name forced to `fireside-prod`), `REDIS_URL`
- **Auth**: `DEV_HEADER` (dev-only bearer token), `DEV_JWT_DOMAIN` (dev JWT verify domain), `ADMIN_TOKEN`
- **100ms**: `HUNDRED_MS_MANAGEMENT_TOKEN`, `HUNDRED_MS_TEMPLATE_ID`
- **Neynar**: `NEYNAR_API_KEY` (optional; used for user enrichment)
- **AWS/S3**: `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME`
- **Ads/Webhooks**: `ADS_WEBHOOK_SECRET` (used to sign all outgoing webhooks)
- (Optional) Queues: `REDIS_QUEUE_URL`

### Architecture
```
src/
  config/        Database, Redis, env config
  models/        Mongoose schemas (User, Room, RoomParticipant, Advertisement, AdAssignment)
  routes/        Elysia route modules (rooms, ads, users, search, admin)
  services/      Integrations (100ms) and Redis services (participants, chat)
  schemas/       Elysia validation schemas and TypeScript types
  utils/         Response helpers, validation and search utilities
  cron/          Scheduled jobs (room cleanup, webhook retry)
  index.ts       App bootstrap
```

### Data Models (MongoDB)
- **User**: `fid, username, displayName, wallet, pfp_url, bio?, topics[], token?, socials{}`
- **Room**: `name, enabled, description?, host(ref User), startTime, endTime?, ended_at?, status(upcoming|ongoing|ended), roomId(HMS), interested[], topics[]`
- **Advertisement**: `title, imageUrl, minutesPerRoom, totalRooms, roomsRemaining, status, txHashes`
- **AdAssignment**: `adId(ref Advertisement), roomId(ref Room), durationSec, status, reservedAt, completedAt?, canceledAt?, expiresAt, webhookUrl, webhookSecret?, sessionId`
- **RoomParticipant**: `roomId(ref Room), userId(ref User), role(host|co-host|speaker|listener), joinedAt, leftAt?` (unique index on `(roomId, userId)`)
- **Sponsorship**: `sponsorshipId, roomId(ref Room), sponsorId(ref User), imageUrl, duration, status(approved|active|completed), approvedAt?, startTime?, endTime?`

### Redis Data
- Participants per room: `room:{roomId}:participants` (hash), `room:{roomId}:roles` (hash), `room:{roomId}:status` (hash)
- Chat per room: `room:{roomId}:messages` (sorted set), `message:{messageId}` (hash)
- Sponsorships: `sponsorship:{id}` (hash), `sponsorships:pending` (set), `room:{roomId}:sponsorships` (set), `livesponsorship:{id}` (hash), `room:{roomId}:liveSponsorships` (set)

### Response Helpers
- `successResponse(data?, message?, dataKey='data')`
- `errorResponse(message, details?)` (adds details only in development)

## Routes

All routes below are prefixed with `/api` unless noted. Groups use nested prefixes:
- Public: `/public/...`
- Protected (requires `Authorization`): `/protected/...`

### Health
- **GET** `/health` → `{ status, timestamp, uptime }`

### Rooms
Prefix: `/rooms`

Public
- **GET** `/rooms/public/` → List enabled rooms with live strength (from HMS peers).
- **GET** `/rooms/public/:id` → Room by MongoDB `_id` with historical participants.
- **POST** `/rooms/public/bulk` body `{ ids: string[] }` → Multiple rooms by `_id`.
- **GET** `/rooms/public/:id/recordings` → HMS recording assets for room.
- **POST** `/rooms/public/by-topics` body `{ topics: string[] }` → Filter by topics.

Protected
- **POST** `/rooms/protected/` body `{ name, description?, startTime, topics[] }` → Create room. If `startTime` in past, creates HMS room and codes.
- **GET** `/rooms/protected/upcoming` → Upcoming rooms for current user.
- **POST** `/rooms/protected/start/:roomId` → Host-only: create HMS room + codes for existing scheduled room, notify Farcaster, set status `ongoing`.
- **PUT** `/rooms/protected/:id` body supports: `status, endTime, participants + action(add|remove), interested` → Host-only updates.

Participants
- Public
  - **GET** `/rooms/public/:id/participants` query `role?=host|co-host|speaker|listener`, `activeOnly?=true|false`, `groupByRole?=true|false`
  - **GET** `/rooms/public/:id/participants-live` → Current live peers from HMS
- Protected
  - **POST** `/rooms/protected/:id/participants` body `{ userFid, role? }` → Host-only add
  - **PUT** `/rooms/protected/:id/participants` body `{ userFid, newRole }` → Host-only update
  - **DELETE** `/rooms/protected/:id/participants?userFid=<fid>` → Host-only remove
  - **POST** `/rooms/protected/:id/join` → Authenticated user joins (listener by default)
  - **POST** `/rooms/protected/:id/leave` → Authenticated user leaves (mark inactive)
  - **POST** `/rooms/protected/:id/end` → Host-only end flow; persists participant records and marks room ended

Integrations (100ms)
- Public
  - **GET** `/rooms/public/:id/codes` → All HMS room codes
- Protected
  - **GET** `/rooms/protected/:id/my-code` → Code for current user’s inferred role (host or redis role, else listener)

Chat
- Public
  - **GET** `/rooms/public/:id/messages` query `limit(<=100), offset` → Paginated recent messages
- Protected
  - **POST** `/rooms/protected/:id/messages` body `{ message }` → Only if user is a participant
  - **DELETE** `/rooms/protected/:id/messages` → Host-only deletes all room messages

### Ads
Prefix: `/ads`
- Public
  - **POST** `/ads/public/quote` body `{ rooms, minutes }` → `{ priceUsd }`
- Protected
  - **POST** `/ads/protected/create` body `{ title, imageUrl, rooms, minutes, txhashes }`
  - **GET** `/ads/protected/active` → Active ads
  - **POST** `/ads/protected/rooms/:roomId/start` body `{ webhookUrl, webhookSecret? }`
  - **POST** `/ads/protected/rooms/:roomId/stop`
  - **POST** `/ads/protected/rooms/:roomId/room-ended`
 - **GET** `/ads/protected/sessions/:roomId` → Returns session state and the current ad payload from Redis. Frontend can call this once on room join so late joiners render the in-progress ad.
- **PATCH** `/status/:sponsorshipId` body `{ status: approved|declined }` → Host-only approval/decline (Redis)
- **GET** `/pending/:roomId` → Host-only list pending for room (from Redis)
- **GET** `/approved/:roomId` → Host-only list approved (from MongoDB)
- **DELETE** `/:sponsorshipId/withdraw` → Sponsor withdraws pending request
- **GET** `/user/all` → Sponsor’s history from MongoDB
- **POST** `/:sponsorshipId/activate` → Sponsor activates approved sponsorship; enqueues live with TTL/queueing in Redis
- **GET** `/live/:roomId` → All live sponsorships with `isActive`, `timeToStart`, and remaining times

### Users
Prefix: `/users`

Public
- **GET** `/users/public/:fid` → Basic user data by FID
- **GET** `/users/public/username/:username` → User profile + hosted rooms

Protected
- **POST** `/users/protected/handle` → Idempotent ensure/create current user via Neynar; stores socials and wallet
- **PATCH** `/users/protected/topics` body `{ topics: string[] }` → Update topics
- **PATCH** `/users/protected/update?query=profile` → Refresh profile from Neynar (preserves wallet)
- **PATCH** `/users/protected/update` body `{ topics?, token? }` → Partial updates

### Search
Prefix: `/search`
- **GET** `/search` query `{ q, limit?, offset?, sort?=relevance|recent|popular }` → Global search across users and rooms
- **GET** `/search/users` query `{ q, limit?, offset?, sort?, isVerified?, fids? }`
- **GET** `/search/rooms` query supports filters:
  - `q, limit?, offset?, sort?=relevance|recent|popular|upcoming`
  - `status=upcoming,ongoing,ended`, `enabled=true|false`, `hostFid`
  - `startTimeFrom, startTimeTo` (ISO)
  - `minParticipants, maxParticipants` (uses aggregation on `RoomParticipant`)

### Admin
Prefix: `/admin` (requires `ADMIN_TOKEN`)
- **POST** `/admin/room-cleanup/trigger` → Manually trigger room cleanup job

## Cron Jobs
- `room-cleanup` runs every 15 minutes (UTC) to end and disable ongoing rooms which have been empty for >5 minutes per HMS peers. Also clears Redis participant state.

## External Integrations
- **100ms (HMS)**: Room lifecycle, codes, peers, recording assets. Requires `HUNDRED_MS_MANAGEMENT_TOKEN` and `HUNDRED_MS_TEMPLATE_ID`.
- **AWS S3**: Sponsorship images. Requires `AWS_*` and `S3_BUCKET_NAME`.
- **Neynar**: Farcaster user enrichment for `/users/protected/handle` and profile refresh.
- **Farcaster**: Frame notifications on room start.

## Authentication
- Provide `Authorization: Bearer <jwt>` from Farcaster Quick Auth. The middleware verifies JWT and sets `x-user-fid` for route handlers.
- Dev mode can use `DEV_HEADER` and `DEV_JWT_DOMAIN` to ease local testing.
- Admin endpoints require `Authorization: Bearer <ADMIN_TOKEN>`.

## Error Handling
- Global handler returns `{ success: false, error }` and development-only `details`.
- 404s return `{ success: false, error: 'Route not found' }`.

## Notes and Conventions
- IDs in route params for rooms are Mongo `_id` unless explicitly documented as HMS `roomId` (some integration endpoints use HMS `roomId` internally).
- Participant and chat data is optimized via Redis; authoritative persistence for participation snapshots occurs on room end.
- Rate limiting is not implemented at the framework level; deploy behind an API gateway if needed.


