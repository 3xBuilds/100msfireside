import { Elysia, t } from 'elysia';
import { manualTriggers } from '../cron';
import { RoomCleanupService } from '../cron/room-cleanup';
import { adminAuthMiddleware } from '../middleware/admin-auth';
import { AdminCleanupResponseSchema } from '../schemas/documentation';

/**
 * Admin Routes for Room Management
 * 
 * Provides admin endpoints for manual room cleanup and monitoring
 * All routes require admin authentication
 */
export const adminRoutes = new Elysia({ prefix: '/admin' })
    .guard({
        beforeHandle: adminAuthMiddleware
    })

    .post('/room-cleanup/trigger', async () => {
        try {
            await manualTriggers.triggerRoomCleanup();
            return {
                success: true,
                message: 'Room cleanup triggered successfully'
            };
        } catch (error) {
            console.error('Error triggering cleanup:', error);
            return {
                success: false,
                error: 'Failed to trigger cleanup',
                details: error instanceof Error ? error.message : String(error)
            };
        }
    }, {
        response: {
            200: AdminCleanupResponseSchema,
            401: AdminCleanupResponseSchema,
            500: AdminCleanupResponseSchema
        },
        detail: {
            tags: ['Admin'],
            summary: 'Trigger Room Cleanup',
            description: `
Manually triggers the room cleanup process.

**Actions Performed:**
- Identifies stale/orphaned rooms
- Cleans up ended rooms without proper termination
- Releases resources from inactive sessions

**Use Case:**
Emergency cleanup or manual maintenance when automated cron isn't sufficient.

**Authorization:** Requires admin authentication (separate from user auth)

**Warning:** This is an administrative operation that affects multiple rooms.
            `,
            security: [{ bearerAuth: [] }]
        }
    });
