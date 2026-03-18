import { Elysia, t } from 'elysia';
import { successResponse, errorResponse } from '../../utils';
import User from '../../models/User';
import Room from '../../models/Room';
import { userSearchRoutes } from './users';
import { roomSearchRoutes } from './rooms';
import { formatGlobalResults, validateSearchQuery, parsePagination, buildTextSearchQuery, ensureDBConnection } from '../../utils/search-utility';
import { GlobalSearchResponseSchema, ErrorResponse } from '../../schemas/documentation';

export const searchRoutes = new Elysia({ prefix: '/search' })
  .use(userSearchRoutes)
  .use(roomSearchRoutes)
  
  // Global search endpoint
  .get('/', async ({ query, set }) => {
    try {
      await ensureDBConnection();
      const { q, limit = 20, offset = 0, sort = 'relevance' } = query;
      
      const validationError = validateSearchQuery(q);
      if (validationError) {
        set.status = 400;
        return errorResponse(validationError);
      }

      const searchTerm = q.trim();
      const { limitNum, offsetNum } = parsePagination(limit, offset);

      const userSearchQuery = buildTextSearchQuery(searchTerm, ['username', 'displayName', 'bio', 'topics']);
      const roomSearchQuery = buildTextSearchQuery(searchTerm, ['name', 'description', 'topics']);

      const userSearch = User.find(userSearchQuery).select('fid username displayName pfp_url bio topics');
      const roomSearch = Room.find(roomSearchQuery)
        .select('roomId name description topics host status startTime endTime enabled')
        .populate('host', 'fid username displayName pfp_url');

      // Apply sorting
      let roomResults: any[], userResults: any[];
      
      if (sort === 'recent') {
        roomSearch.sort({ createdAt: -1 });
        userSearch.sort({ createdAt: -1 });
        
        const [users, rooms] = await Promise.all([
          userSearch.skip(offsetNum).limit(limitNum).exec(),
          roomSearch.skip(offsetNum).limit(limitNum).exec()
        ]);
        
        userResults = users;
        roomResults = rooms;
      } else if (sort === 'popular') {
        // For popular sorting, need to use aggregation for rooms
        const roomPipeline: any[] = [
          { $match: roomSearchQuery },
          {
            $lookup: {
              from: 'roomparticipants',
              localField: '_id',
              foreignField: 'roomId',
              as: 'participants'
            }
          },
          {
            $addFields: {
              participantCount: { $size: '$participants' }
            }
          },
          { $sort: { participantCount: -1, createdAt: -1 } },
          {
            $lookup: {
              from: 'users',
              localField: 'host',
              foreignField: '_id',
              as: 'host',
              pipeline: [
                { $project: { fid: 1, username: 1, displayName: 1, pfp_url: 1 } }
              ]
            }
          },
          { $unwind: '$host' },
          { $skip: offsetNum },
          { $limit: limitNum }
        ];
        
        const [users, rooms] = await Promise.all([
          userSearch.sort({ createdAt: -1 }).skip(offsetNum).limit(limitNum).exec(),
          Room.aggregate(roomPipeline)
        ]);
        
        userResults = users;
        roomResults = rooms;
      } else {
        // Default relevance sorting
        const [users, rooms] = await Promise.all([
          userSearch.skip(offsetNum).limit(limitNum).exec(),
          roomSearch.skip(offsetNum).limit(limitNum).exec()
        ]);
        
        userResults = users;
        roomResults = rooms;
      }

      const results = {
        ...formatGlobalResults(userResults, roomResults),
        pagination: {
          limit: limitNum,
          offset: offsetNum,
          total: {
            users: userResults.length,
            rooms: roomResults.length
          }
        }
      };

      return successResponse(results, 'Search completed successfully');
    } catch (error: any) {
      console.error('Search error:', error);
      set.status = 500;
      return errorResponse('Search failed');
    }
  }, {
    query: t.Object({
      q: t.String({ minLength: 1, description: 'Search query string' }),
      limit: t.Optional(t.String({ description: 'Results limit per type (default: 20, max: 100)' })),
      offset: t.Optional(t.String({ description: 'Results offset for pagination (default: 0)' })),
      sort: t.Optional(t.String({ description: 'Sort order: relevance (default), recent, popular' }))
    }),
    response: {
      200: GlobalSearchResponseSchema,
      400: ErrorResponse,
      500: ErrorResponse
    },
    detail: {
      tags: ['Search'],
      summary: 'Global Search',
      description: `
Searches across both users and rooms simultaneously.

**Search Fields:**
- **Users:** username, displayName, bio, topics
- **Rooms:** name, description, topics

**Sort Options:**
- \`relevance\` (default): Best matches first
- \`recent\`: Newest first (by creation date)
- \`popular\`: Most participants first (rooms only)

**Pagination:**
- \`limit\`: Max results per type (default: 20, max: 100)
- \`offset\`: Skip results for pagination

**Response:**
Returns separate arrays for users and rooms with pagination info for each.

**Note:** This is a public endpoint and does not require authentication.
      `
    }
  });
