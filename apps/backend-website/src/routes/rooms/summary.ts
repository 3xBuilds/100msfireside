import { Elysia, t } from 'elysia';
import Room from '../../models/Room';
import { RedisRoomStatisticsService } from '../../services/redis';
import { RedisTippingService } from '../../services/redis/tippingDetails';
import { successResponse, errorResponse } from '../../utils';

/**
 * Response schema for room summary
 */
const RoomSummaryResponseSchema = t.Object({
  success: t.Boolean(),
  data: t.Object({
    room: t.Object({
      name: t.String({ description: 'Room name' }),
      host: t.Object({
        name: t.String({ description: 'Host display name' }),
        username: t.String({ description: 'Host username' }),
        image: t.String({ description: 'Host profile picture URL' }),
        fid: t.String({ description: 'Host Farcaster ID' }),
      }),
    }),
    statistics: t.Object({
      maxSpeakers: t.Number({ description: 'Peak number of speakers (including host and co-hosts)' }),
      maxListeners: t.Number({ description: 'Peak number of listeners' }),
      totalTipsUSD: t.Number({ description: 'Total tips in USD' }),
    }),
  }),
});

/**
 * Room summary routes for aggregated room statistics
 */
export const summaryRoutes = new Elysia()
  .group('/public', (app) =>
    app
      /**
       * GET /:id/summary
       * Get comprehensive room summary including room details and statistics
       */
      .get(
        '/:id/summary',
        async ({ params, set }) => {
          try {
            const { id: roomId } = params;

            // Fetch room details with host information
            const room = await Room.findById(roomId)
              .populate('host', 'fid username displayName pfp_url')
              .lean();

            if (!room) {
              set.status = 404;
              return errorResponse('Room not found');
            }

            // Fetch tip statistics
            const tipStats = await RedisTippingService.getTipStatistics(room.roomId);

            // Fetch peak participant counts
            const peakStats = await RedisRoomStatisticsService.getRoomStatistics(room.roomId);

            // Build response
            const summary = {
              room: {
                name: room.name,
                host: {
                  name: (room.host as any).displayName || (room.host as any).username,
                  username: (room.host as any).username,
                  image: (room.host as any).pfp_url || '',
                  fid: (room.host as any).fid?.toString() || '',
                },
              },
              statistics: {
                maxSpeakers: peakStats.maxSpeakers,
                maxListeners: peakStats.maxListeners,
                totalTipsUSD: tipStats.totalTipsUSD,
              },
            };

            return successResponse(summary);
          } catch (error) {
            console.error('Error fetching room summary:', error);
            set.status = 500;
            return errorResponse(
              error instanceof Error ? error.message : 'Failed to fetch room summary'
            );
          }
        },
        {
          params: t.Object({
            id: t.String({ description: 'MongoDB ObjectId of the room' }),
          }),
          response: {
            200: RoomSummaryResponseSchema,
            404: t.Object({
              success: t.Literal(false),
              error: t.String(),
            }),
            500: t.Object({
              success: t.Literal(false),
              error: t.String(),
            }),
          },
          detail: {
            tags: ['Rooms - Summary'],
            summary: 'Get Room Summary',
            description: `
Retrieve comprehensive room summary including:
- Room name
- Host information (name, username, profile picture)
- Peak statistics (max speakers, max listeners)
- Total tips in USD

**Public Endpoint:** No authentication required

**Use Case:** Display room statistics on the room end screen

**Note:** Statistics are tracked in real-time during the room session and may return 0 if Redis data has expired.
            `,
          },
        }
      )
  );
