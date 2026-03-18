import { Elysia, t } from 'elysia';
import { authMiddleware } from '../middleware/auth';
import User from '../models/User';
import { errorResponse, successResponse } from '../utils';
import { GetAdsPreferenceResponseSchema, ErrorResponse } from '../schemas/documentation';

export const profileRoutes = new Elysia({ prefix: '/profile' })
  .guard({
    beforeHandle: authMiddleware
  })
  .group('/ads-preference', (app) =>
    app
      .get('/', async ({ headers, set }) => {
        try {
          const userFid = headers['x-user-privyid'] as string;
          if (!userFid) {
            set.status = 401;
            return errorResponse('User authentication required');
          }

          const user = await User.findOne({ privyId: userFid }).select('autoAdsEnabled');
          if (!user) {
            set.status = 404;
            return errorResponse('User not found');
          }

          return successResponse({ autoAdsEnabled: Boolean((user as any).autoAdsEnabled) });
        } catch (err) {
          console.error('[profile] failed to load ads preference', err);
          set.status = 500;
          return errorResponse('Failed to load ads preference');
        }
      }, {
        response: {
          200: GetAdsPreferenceResponseSchema,
          401: ErrorResponse,
          404: ErrorResponse,
          500: ErrorResponse
        },
        detail: {
          tags: ['Profile'],
          summary: 'Get Ads Preference',
          description: `
Retrieves the user's ads preference setting.

**Returns:**
- \`autoAdsEnabled\`: Boolean indicating if ads are automatically enabled for new rooms

**Use Case:**
Check user's default ads setting before creating a room.

**Authentication Required:** Yes (Farcaster JWT)
          `,
          security: [{ bearerAuth: [] }]
        }
      })
      .put('/', async ({ headers, body, set }) => {
        try {
          const userFid = headers['x-user-privyid'] as string;
          if (!userFid) {
            set.status = 401;
            return errorResponse('User authentication required');
          }

          const { autoAdsEnabled } = body as { autoAdsEnabled: boolean };
          if (typeof autoAdsEnabled !== 'boolean') {
            set.status = 400;
            return errorResponse('autoAdsEnabled must be a boolean');
          }

          const user = await User.findOneAndUpdate(
            { privyId: userFid },
            { autoAdsEnabled },
            { new: true, select: 'autoAdsEnabled' }
          );

          if (!user) {
            set.status = 404;
            return errorResponse('User not found');
          }

          return successResponse({ autoAdsEnabled: user.autoAdsEnabled });
        } catch (err) {
          console.error('[profile] failed to update ads preference', err);
          set.status = 500;
          return errorResponse('Failed to update ads preference');
        }
      }, {
        body: t.Object({
          autoAdsEnabled: t.Boolean({ description: 'Whether to auto-enable ads for new rooms' })
        }),
        response: {
          200: GetAdsPreferenceResponseSchema,
          400: ErrorResponse,
          401: ErrorResponse,
          404: ErrorResponse,
          500: ErrorResponse
        },
        detail: {
          tags: ['Profile'],
          summary: 'Update Ads Preference',
          description: `
Updates the user's default ads preference for new rooms.

**Setting:**
- \`autoAdsEnabled: true\`: New rooms will have ads enabled by default
- \`autoAdsEnabled: false\`: New rooms will have ads disabled by default

**Impact:**
When creating a room without specifying \`adsEnabled\`, this preference is used.

**Authentication Required:** Yes (Farcaster JWT)
          `,
          security: [{ bearerAuth: [] }]
        }
      })
  );
