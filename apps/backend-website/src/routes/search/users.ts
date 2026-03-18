import { Elysia, t } from 'elysia';
import { successResponse, errorResponse } from '../../utils';
import User from '../../models/User';
import { buildUserSearchQuery, applyUserSorting, formatUserResults, validateSearchQuery, parsePagination, ensureDBConnection } from '../../utils/search-utility';
import { SearchUsersResponseSchema, ErrorResponse } from '../../schemas/documentation';

export const userSearchRoutes = new Elysia({ prefix: '/users' })
  .get('/', async ({ query, set }) => {
    try {
      await ensureDBConnection();
      const { q, limit = 20, offset = 0, sort = 'relevance', isVerified, fids } = query;
      
      const validationError = validateSearchQuery(q);
      if (validationError) {
        set.status = 400;
        return errorResponse(validationError);
      }

      const searchTerm = q.trim();
      const { limitNum, offsetNum } = parsePagination(limit, offset);
      
      const searchQuery = buildUserSearchQuery(searchTerm, { isVerified, fids });
      
      let userQuery = User.find(searchQuery)
        .select('fid username displayName pfp_url bio topics isVerified');

      const sortedUsers = await applyUserSorting(userQuery, sort as string);
      
      // If applyUserSorting returned an array (for popular sort), handle differently
      let users, total;
      if (Array.isArray(sortedUsers)) {
        // For popular sort, we already have the users array
        const startIndex = offsetNum;
        const endIndex = offsetNum + limitNum;
        users = sortedUsers.slice(startIndex, endIndex);
        total = sortedUsers.length;
      } else {
        // For other sorts, we have a query object
        users = await sortedUsers.skip(offsetNum).limit(limitNum).exec();
        total = await User.countDocuments(searchQuery);
      }

      const results = {
        users: formatUserResults(users),
        pagination: {
          limit: limitNum,
          offset: offsetNum,
          total
        }
      };

      return successResponse(results, 'User search completed successfully');
    } catch (error: any) {
      console.error('User search error:', error);
      set.status = 500;
      return errorResponse('User search failed');
    }
  }, {
    query: t.Object({
      q: t.String({ minLength: 1, description: 'Search query string' }),
      limit: t.Optional(t.String({ description: 'Results limit (default: 20, max: 100)' })),
      offset: t.Optional(t.String({ description: 'Results offset for pagination (default: 0)' })),
      sort: t.Optional(t.String({ description: 'Sort order: relevance (default), recent, popular' })),
      isVerified: t.Optional(t.String({ description: 'Filter by verified status: true or false' })),
      fids: t.Optional(t.String({ description: 'Comma-separated list of FIDs to filter results' }))
    }),
    response: {
      200: SearchUsersResponseSchema,
      400: ErrorResponse,
      500: ErrorResponse
    },
    detail: {
      tags: ['Search'],
      summary: 'Search Users',
      description: `
Searches for users with filtering options.

**Search Fields:**
- Username
- Display name
- Bio
- Topics/interests

**Sort Options:**
- \`relevance\` (default): Best text matches first
- \`recent\`: Recently created accounts first
- \`popular\`: Users with most hosted rooms first

**Filters:**
- \`isVerified\`: Filter by verification status
- \`fids\`: Limit search to specific FIDs (comma-separated)

**Pagination:**
Standard limit/offset pagination with total count.

**Note:** This is a public endpoint and does not require authentication.
      `
    }
  });
