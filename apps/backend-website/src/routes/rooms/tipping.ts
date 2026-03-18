import { Elysia, t } from 'elysia';
import { authMiddleware } from '../../middleware/auth';
import { RedisTippingService, TipRecord } from '../../services/redis/tippingDetails';
import { successResponse, errorResponse } from '../../utils';
import { nanoid } from 'nanoid';

/**
 * Request schema for saving a tip record
 */
const SaveTipRecordSchema = t.Object({
  tipper: t.Object({
    userId: t.String(),
    username: t.String(),
    pfp_url: t.String(),
  }),
  recipients: t.Array(
    t.Object({
      userId: t.Optional(t.String()),
      username: t.Optional(t.String()),
      pfp_url: t.Optional(t.String()),
      role: t.Optional(t.String()),
    })
  ),
  amount: t.Object({
    usd: t.Number(),
    currency: t.String(),
    native: t.Number(),
  }),
});

/**
 * Response schema for tip statistics
 */
const TipStatisticsResponseSchema = t.Object({
  success: t.Boolean(),
  data: t.Object({
    totalTipsUSD: t.Number(),
    totalTipsByUsers: t.Number(),
    tipsByCurrency: t.Object({
      ETH: t.Object({
        count: t.Number(),
        totalUSD: t.Number(),
        totalNative: t.Number(),
      }),
      USDC: t.Object({
        count: t.Number(),
        totalUSD: t.Number(),
        totalNative: t.Number(),
      }),
      FIRE: t.Object({
        count: t.Number(),
        totalUSD: t.Number(),
        totalNative: t.Number(),
      }),
    }),
    recentTips: t.Array(t.Any()),
    allTips: t.Array(t.Any()),
  }),
});

/**
 * Tipping routes for managing tip records
 */
export const tippingRoutes = new Elysia()
  .guard({
    beforeHandle: authMiddleware,
  })
  .group('/protected', (app) =>
    app
      /**
       * POST /:id/tips
       * Save a new tip record to Redis
       */
      .post(
        '/:id/tips',
        async ({ params, body, headers, set }) => {
          try {
            const { id: roomId } = params;
            const tipData = body as any;
            const userFid = headers['x-user-privyid'] as string;

            if (!userFid) {
              set.status = 401;
              return errorResponse('Authentication required');
            }

            // Create tip record
            const tipRecord: TipRecord = {
              id: nanoid(),
              roomId,
              timestamp: new Date().toISOString(),
              tipper: tipData.tipper,
              recipients: tipData.recipients,
              amount: tipData.amount,
            };

            // Save to Redis
            await RedisTippingService.addTipRecord(tipRecord);

            return successResponse({ tipId: tipRecord.id });
          } catch (error) {
            console.error('Error saving tip record:', error);
            set.status = 500;
            return errorResponse(
              error instanceof Error ? error.message : 'Failed to save tip record'
            );
          }
        },
        {
          body: SaveTipRecordSchema,
          detail: {
            tags: ['Rooms - Tipping'],
            summary: 'Save a tip record',
            description: 'Save a new tip record to Redis for a specific room',
            security: [{ bearerAuth: [] }],
          },
        }
      )
      /**
       * GET /:id/tips
       * Retrieve tip statistics and history for a room
       */
      .get(
        '/:id/tips',
        async ({ params, headers, set }) => {
          try {
            const { id: roomId } = params;
            const userFid = headers['x-user-privyid'] as string;

            if (!userFid) {
              set.status = 401;
              return errorResponse('Authentication required');
            }

            // Fetch tip statistics
            const statistics = await RedisTippingService.getTipStatistics(roomId);

            return successResponse(statistics);
          } catch (error) {
            console.error('Error fetching tip statistics:', error);
            set.status = 500;
            return errorResponse(
              error instanceof Error ? error.message : 'Failed to fetch tip statistics'
            );
          }
        },
        {
          response: {
            200: TipStatisticsResponseSchema,
          },
          detail: {
            tags: ['Rooms - Tipping'],
            summary: 'Get tip statistics',
            description: 'Retrieve aggregated tip statistics and history for a specific room',
            security: [{ bearerAuth: [] }],
          },
        }
      )
  );
