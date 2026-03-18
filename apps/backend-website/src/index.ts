import { Elysia, t } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import connectDB from './config/database';
import config from './config';
import { adsRoutes, restoreRoomAdRotations } from './routes/ads/index';
import { roomRoutes } from './routes/rooms';
import { userRoutes } from './routes/users';
import { searchRoutes } from './routes/search';
import { adminRoutes } from './routes/admin';
import { profileRoutes } from './routes/profile';
import { rewardRoutes } from './routes/rewards';
// import { authRoutes } from './routes/auth';
// import { sponsorshipWorker } from './queues/sponsorshipQueue';
import { roomCleanupCron, adPayoutCron } from './cron';
import { startWebhookRetryWorker } from './workers/webhookRetryWorker';
import { websocketRoutes } from './routes/websocket';
import { wsManager } from './services/websocket/manager';

const app = new Elysia();

// Request logger - MUST be before any plugins to catch all requests
app.onRequest(({ request }) => {
  const log = `📥 [${new Date().toISOString()}] ${request.method} ${new URL(request.url).pathname}`;
  console.log(log);
});

// After handle logger to confirm request processing
app.onAfterHandle(({ request }) => {
  console.log(`📤 [${new Date().toISOString()}] Handled: ${request.method} ${new URL(request.url).pathname}`);
});

// Swagger/Scalar Documentation
app.use(swagger({
  documentation: {
    info: {
      title: 'Fireside API',
      version: '1.0.50',
      description: `
# Fireside Backend API

Fireside is a real-time audio room platform built on Farcaster. This API provides endpoints for managing rooms, participants, chat, advertisements, and user profiles.

## Authentication

Most endpoints require authentication via Farcaster. Include the following header in your requests:
- \`Authorization: Bearer <jwt_token>\` - JWT token from Farcaster authentication

The server extracts the user's FID (Farcaster ID) from the token and uses it for authorization.

## Rate Limiting

API requests are subject to rate limiting. Please implement appropriate backoff strategies.

## Response Format

All responses follow a standard format:
\`\`\`json
{
  "success": true|false,
  "data": { ... },
  "message": "Optional message",
  "error": "Error message if success is false"
}
\`\`\`
      `,
      contact: {
        name: 'Fireside Support',
        url: 'https://fireside.app',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: config.isDevelopment ? `http://localhost:${config.port}` : 'https://fireside-backend-production.up.railway.app',
        description: config.isDevelopment ? 'Development Server' : 'Production Server'
      }
    ],
    tags: [
      { name: 'Health', description: 'API health check endpoints' },
      { name: 'Rooms', description: 'Room management - create, update, list rooms' },
      { name: 'Participants', description: 'Manage room participants - join, leave, update roles' },
      { name: 'Chat', description: 'Room chat messaging' },
      { name: 'Users', description: 'User management and profile operations' },
      { name: 'Profile', description: 'User profile and preferences' },
      { name: 'Search', description: 'Search for rooms and users' },
      { name: 'Ads', description: 'Advertisement management and session control' },
      { name: 'Rewards', description: 'Reward system - daily login, hosting, and milestone rewards' },
      { name: 'Admin', description: 'Administrative operations (requires admin auth)' }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Farcaster JWT authentication token'
        }
      }
    },
    security: [{ bearerAuth: [] }]
  },
  path: '/docs',
  exclude: ['/docs', '/docs/json'],
  scalarConfig: {
    spec: {
      url: '/docs/json'
    },
    theme: 'purple',
    layout: 'modern',
    hiddenClients: true,
    searchHotKey: 'k',
    metaData: {
      title: 'Fireside API Documentation',
      description: 'Interactive API documentation for the Fireside backend'
    }
  }
}));

app.use(cors({
  origin: config.frontendUrl,
  credentials: true,
}));

// Add cron jobs
app.use(roomCleanupCron);
app.use(adPayoutCron);

// WebSocket routes (at root level, not under /api)
app.use(websocketRoutes);

app.get('/health', () => ({
  status: 'ok',
  timestamp: new Date().toISOString(),
  uptime: process.uptime(),
}), {
  detail: {
    tags: ['Health'],
    summary: 'Health Check',
    description: 'Returns the current health status of the API server including uptime information.',
    responses: {
      200: {
        description: 'Server is healthy',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                status: { type: 'string', example: 'ok' },
                timestamp: { type: 'string', format: 'date-time', example: '2024-01-15T10:30:00.000Z' },
                uptime: { type: 'number', description: 'Server uptime in seconds', example: 3600.5 }
              }
            }
          }
        }
      }
    }
  }
});

app.group('/api', (app) =>
  app
    .use(adsRoutes)
    .use(roomRoutes)
    .use(userRoutes)
    .use(searchRoutes)
    .use(adminRoutes)
    .use(profileRoutes)
    .use(rewardRoutes)
    // .use(authRoutes)
);

app.onError(({ error, code }) => {
  console.error('Server error:', error);

  if (code === 'NOT_FOUND') {
    return { success: false, error: 'Route not found' };
  }

  return {
    success: false,
    error: 'Internal server error',
    ...(config.isDevelopment && { details: error instanceof Error ? error.message : String(error) })
  };
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...');

  // await sponsorshipWorker.close();

  await app.stop();

  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...');

  // await sponsorshipWorker.close();

  await app.stop();

  process.exit(0);
});

const PORT = config.port;

// Simple startup - connect to DB and start server immediately
(async () => {
  try {
    console.log('🔌 Connecting to database...');
    await connectDB();
    console.log('✅ Database connected successfully');

    console.log('♻️ Restoring pending ad rotations...');
    await restoreRoomAdRotations();
    console.log('✅ Ad rotations restored');

    console.log('📬 Starting webhook retry worker...');
    startWebhookRetryWorker();
    
    console.log(`🚀 Starting server on port ${PORT}...`);
    
    app.listen({
      port: PORT,
      hostname: '0.0.0.0'
    }, () => {
      console.log(`✅ Backend server running on http://localhost:${PORT}`);
      console.log(`📋 Health check: http://localhost:${PORT}/health`);
    });

    // Initialize WebSocket manager with Bun server for pub/sub broadcasting
    wsManager.setServer(app.server);
    
  } catch (error: any) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
})();

// export default app;
