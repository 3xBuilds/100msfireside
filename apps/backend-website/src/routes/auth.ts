// import { Elysia } from 'elysia';
// import { createClient } from '@farcaster/quick-auth';
// import { errorResponse, successResponse } from '../utils';
// import config from '../config';

// export const authRoutes = new Elysia({ prefix: '/auth' })
//   // JWT verification and user info extraction
//   .get('/me', async ({ headers, set }) => {
//     try {
//       const client = createClient();
//       const authorization = headers.authorization || config.devHeader;

//       if (!authorization) {
//         set.status = 401;
//         return errorResponse('Unauthorized', 'Missing Authorization header');
//       }

//       const token = authorization.split(' ')[1];
//       if (!token) {
//         set.status = 401;
//         return errorResponse('Unauthorized', 'Invalid Authorization format');
//       }

//       const hostname = config.hostname;
//       if (!hostname) {
//         set.status = 500;
//         return errorResponse('Server configuration error', 'HOSTNAME not configured');
//       }

//       const payload = await client.verifyJwt({
//         token,
//         domain: hostname,
//       });

//       console.log("JWT payload:", payload);

//       const fidParam = payload.sub;
//       if (!fidParam) {
//         set.status = 401;
//         return errorResponse('Unauthorized', 'Missing fid in token');
//       }

//       const fid = Number(fidParam);
//       if (Number.isNaN(fid)) {
//         set.status = 401;
//         return errorResponse('Unauthorized', 'Invalid fid in token');
//       }

//       return successResponse({ user: fid }, 'Authentication successful');
//     } catch (error) {
//       console.error('JWT verification error:', error);
//       set.status = 401;
//       return errorResponse(
//         'Unauthorized',
//         error instanceof Error ? error.message : 'Token verification failed'
//       );
//     }
//   });
