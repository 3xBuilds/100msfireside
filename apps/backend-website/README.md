# Fireside Backend

A backend service for the Fireside application built with Elysia, MongoDB, and Redis.

## Features

- Room management with real-time participants
- Global advertising via webhooks (host-triggered, auto-rotation)
- 100ms video integration
- Redis-based participant tracking
- RESTful API endpoints

## Prerequisites

- Bun (latest version)
- MongoDB (running locally or remote connection)
- Redis (for participant tracking and queues)
- 100ms account and management token

## Setup

1. **Clone and install dependencies:**
   ```bash
   cd fireside-backend
   bun install
   ```

2. **Environment Configuration:**
   
   Copy `.env.example` to `.env` and fill in your values:
   ```bash
   cp .env.example .env
   ```
   
   Update the following variables:
   - `MONGODB_URI`: Your MongoDB connection string
   - `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`: Your Redis configuration
   - `HUNDRED_MS_MANAGEMENT_TOKEN`: Your 100ms management token
   - `FRONTEND_URL`: Your frontend application URL

3. **Start Redis (if running locally):**
   ```bash
   redis-server
   ```

4. **Start MongoDB (if running locally):**
   ```bash
   mongod
   ```

5. **Run the development server:**
   ```bash
   bun run dev
   ```

## API Endpoints

### Room Routes (`/rooms`)

#### **GET** `/rooms`
Get all enabled rooms
- **Response:** List of rooms with host information

#### **GET** `/rooms/:id`
Get specific room by ID
- **Parameters:** `id` - Room ID
- **Response:** Room details with host and participants

#### **PUT** `/rooms/:id`
Update room settings
- **Parameters:** `id` - Room ID
- **Body:**
  ```json
  {
    "status": "upcoming|ongoing|ended",
    "endTime": "ISO date string",
    "participants": ["participant_id_1", "participant_id_2"],
    "action": "add|remove"
  }
  ```

#### **GET** `/rooms/:id/participants-by-role`
Get participants grouped by role
- **Parameters:** `id` - Room ID
- **Query:** `activeOnly=true` - Only active participants
- **Response:** Participants grouped by role (host, co-host, speaker, listener)

#### **POST** `/rooms/:id/participants-by-role`
Get participants for specific role
- **Body:**
  ```json
  {
    "role": "host|co-host|speaker|listener"
  }
  ```

#### **GET** `/rooms/:id/participants`
Get all room participants
- **Response:** Array of participants with roles and status

#### **POST** `/rooms/:id/participants`
Add participant to room
- **Body:**
  ```json
  {
    "userFid": "user_farcaster_id",
    "role": "listener" // optional, defaults to listener
  }
  ```

#### **PUT** `/rooms/:id/participants`
Update participant role
- **Body:**
  ```json
  {
    "userFid": "user_farcaster_id",
    "newRole": "host|co-host|speaker|listener"
  }
  ```

#### **DELETE** `/rooms/:id/participants`
Remove participant from room
- **Query:** `userFid` - User's Farcaster ID

#### **POST** `/rooms/:id/join`
Join a room
- **Body:**
  ```json
  {
    "userFid": "user_farcaster_id",
    "role": "listener" // optional
  }
  ```

#### **POST** `/rooms/:id/leave`
Leave a room (marks participant as inactive)
- **Body:**
  ```json
  {
    "userFid": "user_farcaster_id"
  }
  ```

#### **POST** `/rooms/:id/end`
End a room (host only)
- **Body:**
  ```json
  {
    "userId": "host_user_id"
  }
  ```

#### **GET** `/rooms/:id/codes`
Get 100ms room codes
- **Response:** Array of room codes for different roles

#### **GET** `/rooms/:id/:fid`
Get user-specific room code
- **Parameters:** 
  - `id` - Room ID
  - `fid` - User's Farcaster ID
- **Response:** Room code for user's role

### Ads Routes (`/ads`)
See docs/Backend.md for webhook-based ads session endpoints.

## Models

### Room Model
```typescript
{
  name: string;
  enabled: boolean;
  description: string;
  host: ObjectId; // Reference to User
  startTime: Date;
  endTime: Date | null;
  ended_at?: Date;
  status: 'upcoming' | 'ongoing' | 'ended';
  roomId: string; // 100ms room ID
  topics: string[];
}
```

### RoomParticipant Model
```typescript
{
  roomId: ObjectId; // Reference to Room
  userId: ObjectId; // Reference to User
  role: 'host' | 'co-host' | 'speaker' | 'listener';
  joinedAt: Date;
  leftAt?: Date;
}
```

### User Model
```typescript
{
  fid: string; // Farcaster ID
  username: string;
  displayName: string;
  pfp_url: string;
  wallet: string;
  bio?: string;
}
```

## Redis Participant Tracking

The system uses Redis to track real-time participant data:
- **Participant Data:** Stored as hash maps per room
- **Role Tracking:** Separate sets for each role per room
- **Status Tracking:** Active/inactive status for participants

## Services

### RedisRoomService
Handles all Redis operations for room participants:
- Add/remove participants
- Update participant roles and status
- Get participants by role or room
- Track active vs inactive participants

### HMSAPI
100ms API integration:
- Get room codes
- End rooms
- Manage video room lifecycle

### X Bot (xBot.ts)
Automatically posts to X (Twitter) when a fireside goes live:
- Triggered on immediate room creation (status: "ongoing")
- Triggered when a scheduled room is started
- Posts room name, host, topics (as hashtags), and join link
- Gracefully skips if X API credentials are not configured

## Development

- **Watch mode:** `bun run dev`
- **Health check:** `GET /health`
- **Error handling:** Comprehensive error responses with development details

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/fireside` |
| `REDIS_HOST` | Redis host | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `REDIS_PASSWORD` | Redis password | `` |
| `HUNDRED_MS_MANAGEMENT_TOKEN` | 100ms API token | Required |
| `PORT` | Server port | `3001` |
| `NODE_ENV` | Environment | `development` |
| `FRONTEND_URL` | Frontend URL for CORS | `http://localhost:3000` |
| `X_CONSUMER_KEY` | X API Consumer Key (API Key) | Optional |
| `X_CONSUMER_SECRET` | X API Consumer Secret | Optional |
| `X_ACCESS_TOKEN` | X Bot Access Token | Optional |
| `X_ACCESS_TOKEN_SECRET` | X Bot Access Token Secret | Optional |

## Migration from Next.js

This backend was converted from Next.js API routes to Elysia. Key changes:

1. **Route Structure:** Next.js file-based routing → Elysia programmatic routing
2. **Request/Response:** `NextRequest/NextResponse` → Elysia's built-in handling
3. **Parameters:** `params` from context → direct destructuring
4. **Query Parameters:** `searchParams` → `query` object
5. **Validation:** Added Elysia's built-in validation with `t` schemas
6. **Error Handling:** Consistent error response format
7. **Database:** Direct MongoDB operations (no Next.js specific utilities)

## Architecture

```
src/
├── config/          # Database configuration
├── models/          # Mongoose schemas
├── routes/          # API route handlers
├── services/        # External service integrations
├── queues/          # Background job processing
└── index.ts         # Application entry point
```