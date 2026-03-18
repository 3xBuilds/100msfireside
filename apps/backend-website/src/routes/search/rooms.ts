import { Elysia, t } from 'elysia';
import { successResponse, errorResponse } from '../../utils';
import Room from '../../models/Room';
import { buildRoomSearchQuery, applyRoomSorting, formatRoomResults, validateSearchQuery, parsePagination, ensureDBConnection } from '../../utils/search-utility';
import { SearchRoomsResponseSchema, ErrorResponse } from '../../schemas/documentation';

export const roomSearchRoutes = new Elysia({ prefix: '/rooms' })
  .get('/', async ({ query, set }) => {
    try {
      await ensureDBConnection();
      const { 
        q, 
        limit = 20, 
        offset = 0, 
        sort = 'relevance', 
        status, 
        enabled, 
        hostFid,
        startTimeFrom,
        startTimeTo,
        minParticipants,
        maxParticipants
      } = query;
      
      const validationError = validateSearchQuery(q);
      if (validationError) {
        set.status = 400;
        return errorResponse(validationError);
      }

      const searchTerm = q.trim();
      const { limitNum, offsetNum } = parsePagination(limit, offset);
      
      const searchQuery = await buildRoomSearchQuery(searchTerm, {
        status, enabled, hostFid, 
        startTimeFrom, startTimeTo, minParticipants, maxParticipants
      });

      if (searchQuery === null) {
        return successResponse({
          rooms: [],
          pagination: { limit: limitNum, offset: offsetNum, total: 0 }
        }, 'Room search completed successfully');
      }

      let rooms, total;

      // Handle aggregation vs regular query
      if (searchQuery.isAggregation) {
        let pipeline = searchQuery.pipeline;
        
        // Apply sorting if not already applied
        const sortedQuery = await applyRoomSorting(searchQuery, sort as string);
        if (sortedQuery.isAggregation) {
          pipeline = sortedQuery.pipeline;
        }
        
        // Add population for host
        pipeline.push({
          $lookup: {
            from: 'users',
            localField: 'host',
            foreignField: '_id',
            as: 'host',
            pipeline: [
              { $project: { fid: 1, username: 1, displayName: 1, pfp_url: 1 } }
            ]
          }
        });
        
        pipeline.push({ $unwind: '$host' });
        
        // Get total count
        const countPipeline = [...pipeline, { $count: 'total' }];
        const countResult = await Room.aggregate(countPipeline);
        total = countResult[0]?.total || 0;
        
        // Add pagination
        pipeline.push({ $skip: offsetNum });
        pipeline.push({ $limit: limitNum });
        
        rooms = await Room.aggregate(pipeline);
      } else {
        // Regular query
        let roomQuery = Room.find(searchQuery)
          .select('roomId name description topics host status startTime endTime enabled')
          .populate('host', 'fid username displayName pfp_url');

        const sortedQuery = await applyRoomSorting(roomQuery, sort as string);
        
        if (sortedQuery.isAggregation) {
          // Sorting converted to aggregation
          let pipeline = sortedQuery.pipeline;
          
          // Add population for host
          pipeline.push({
            $lookup: {
              from: 'users',
              localField: 'host',
              foreignField: '_id',
              as: 'host',
              pipeline: [
                { $project: { fid: 1, username: 1, displayName: 1, pfp_url: 1 } }
              ]
            }
          });
          
          pipeline.push({ $unwind: '$host' });
          
          // Get total count
          const countPipeline = [...pipeline, { $count: 'total' }];
          const countResult = await Room.aggregate(countPipeline);
          total = countResult[0]?.total || 0;
          
          // Add pagination
          pipeline.push({ $skip: offsetNum });
          pipeline.push({ $limit: limitNum });
          
          rooms = await Room.aggregate(pipeline);
        } else {
          // Regular query execution
          rooms = await sortedQuery.skip(offsetNum).limit(limitNum).exec();
          total = await Room.countDocuments(searchQuery);
        }
      }

      const results = {
        rooms: formatRoomResults(rooms),
        pagination: {
          limit: limitNum,
          offset: offsetNum,
          total
        }
      };

      return successResponse(results, 'Room search completed successfully');
    } catch (error: any) {
      console.error('Room search error:', error);
      set.status = 500;
      return errorResponse('Room search failed');
    }
  }, {
    query: t.Object({
      q: t.String({ minLength: 1, description: 'Search query string' }),
      limit: t.Optional(t.String({ description: 'Results limit (default: 20, max: 100)' })),
      offset: t.Optional(t.String({ description: 'Results offset for pagination (default: 0)' })),
      sort: t.Optional(t.String({ description: 'Sort order: relevance (default), recent, popular, upcoming' })),
      status: t.Optional(t.String({ description: 'Filter by status: upcoming, ongoing, ended (comma-separated for multiple)' })),
      enabled: t.Optional(t.String({ description: 'Filter by enabled status: true or false' })),
      hostFid: t.Optional(t.String({ description: 'Filter by host Farcaster ID' })),
      startTimeFrom: t.Optional(t.String({ description: 'Filter rooms starting after this ISO date' })),
      startTimeTo: t.Optional(t.String({ description: 'Filter rooms starting before this ISO date' })),
      minParticipants: t.Optional(t.String({ description: 'Filter rooms with at least this many participants' })),
      maxParticipants: t.Optional(t.String({ description: 'Filter rooms with at most this many participants' }))
    }),
    response: {
      200: SearchRoomsResponseSchema,
      400: ErrorResponse,
      500: ErrorResponse
    },
    detail: {
      tags: ['Search'],
      summary: 'Search Rooms',
      description: `
Searches for rooms with advanced filtering options.

**Search Fields:**
- Room name
- Room description
- Topic tags

**Sort Options:**
- \`relevance\` (default): Best text matches first
- \`recent\`: Newest rooms first
- \`popular\`: Most participants first
- \`upcoming\`: Soonest start time first

**Filters:**
- \`status\`: Filter by room status (can be comma-separated: "upcoming,ongoing")
- \`enabled\`: Filter by active/inactive rooms
- \`hostFid\`: Find rooms by a specific host
- \`startTimeFrom/To\`: Date range for start time
- \`minParticipants/maxParticipants\`: Participant count range

**Pagination:**
Standard limit/offset pagination with total count.

**Note:** This is a public endpoint and does not require authentication.
      `
    }
  });
