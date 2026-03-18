import { Elysia, t } from 'elysia';
import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';
import User from '../models/User';
import { errorResponse, successResponse } from '../utils';
import { walletAuthMiddleware } from '../middleware/wallet-auth';
import config from '../config';

export const walletUserRoutes = new Elysia({ prefix: '/wallet-users' })
  .guard({
    beforeHandle: walletAuthMiddleware,
  })
  .group('/protected', (app) =>
    app
      // Handle current user creation/retrieval by wallet address
      .post('/handle', async ({ headers, set }) => {
        try {
          const walletAddress = headers['x-user-address'] as string;

          if (!walletAddress) {
            set.status = 500;
            return errorResponse('Authentication middleware did not provide user address');
          }

          let user = await User.findOne({ walletAddress });

          if (!user) {
            // Resolve ENS
            let ensName: string | null = null;
            let ensAvatar: string | null = null;

            try {
              const publicClient = createPublicClient({
                chain: mainnet,
                transport: http(config.ensRpcUrl || undefined),
              });

              ensName = await publicClient.getEnsName({
                address: walletAddress as `0x${string}`,
              });

              if (ensName) {
                ensAvatar = await publicClient.getEnsAvatar({ name: ensName });
              }
            } catch (ensError) {
              console.warn('ENS resolution failed:', ensError);
            }

            const displayName = ensName || `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
            const username = ensName || walletAddress.slice(0, 10).toLowerCase();

            user = await User.create({
              walletAddress,
              wallet: walletAddress,
              username,
              displayName,
              pfp_url: ensAvatar || '',
              ensName: ensName || undefined,
              ensAvatar: ensAvatar || undefined,
            });
          }

          return successResponse({ user }, 'User handled successfully');
        } catch (error) {
          console.error('Error handling wallet user:', error);
          set.status = 500;
          return errorResponse(
            'Internal server error',
            error instanceof Error ? error.message : 'Unknown error'
          );
        }
      }, {
        detail: {
          tags: ['Wallet Users'],
          summary: 'Handle Wallet User Login',
          description: `
Creates or retrieves the authenticated user's profile by wallet address.

**Behavior:**
1. If user exists in database → returns existing user
2. If user doesn't exist → resolves ENS name/avatar and creates user

**Data Resolution:**
- ENS name and avatar from mainnet
- Falls back to truncated wallet address for display name

**Authentication Required:** Yes (Wallet JWT)
          `,
          security: [{ bearerAuth: [] }],
        },
      })

      // Update user profile manually (for users without ENS)
      .patch('/profile', async ({ headers, body, set }) => {
        try {
          const walletAddress = headers['x-user-address'] as string;

          if (!walletAddress) {
            set.status = 500;
            return errorResponse('Authentication middleware did not provide user address');
          }

          const { username, displayName, pfp_url } = body as {
            username?: string;
            displayName?: string;
            pfp_url?: string;
          };

          const updateObj: Record<string, any> = {};
          if (username !== undefined) updateObj.username = username;
          if (displayName !== undefined) updateObj.displayName = displayName;
          if (pfp_url !== undefined) updateObj.pfp_url = pfp_url;

          if (Object.keys(updateObj).length === 0) {
            set.status = 400;
            return errorResponse('No valid fields to update');
          }

          const user = await User.findOneAndUpdate(
            { walletAddress },
            updateObj,
            { new: true, select: 'walletAddress wallet username displayName pfp_url ensName ensAvatar topics socials' }
          );

          if (!user) {
            set.status = 404;
            return errorResponse('User not found');
          }

          return successResponse({ user }, 'Profile updated successfully');
        } catch (error) {
          console.error('Error updating wallet user profile:', error);
          set.status = 500;
          return errorResponse('Failed to update profile');
        }
      }, {
        body: t.Object({
          username: t.Optional(t.String({ description: 'New username' })),
          displayName: t.Optional(t.String({ description: 'New display name' })),
          pfp_url: t.Optional(t.String({ description: 'New profile picture URL' })),
        }),
        detail: {
          tags: ['Wallet Users'],
          summary: 'Update Wallet User Profile',
          description: `
Updates user profile fields manually. Useful for users without ENS names.

**Updatable Fields:**
- username
- displayName  
- pfp_url (profile picture URL)

**Authentication Required:** Yes (Wallet JWT)
          `,
          security: [{ bearerAuth: [] }],
        },
      })

      // Update user topics
      .patch('/topics', async ({ headers, body, set }) => {
        try {
          const walletAddress = headers['x-user-address'] as string;

          if (!walletAddress) {
            set.status = 500;
            return errorResponse('Authentication middleware did not provide user address');
          }

          const { topics } = body;

          if (!Array.isArray(topics)) {
            set.status = 400;
            return errorResponse('Missing topics array');
          }

          const user = await User.findOneAndUpdate(
            { walletAddress },
            { topics },
            { new: true, select: 'walletAddress wallet username displayName pfp_url topics socials' }
          );

          if (!user) {
            set.status = 404;
            return errorResponse('User not found');
          }

          return successResponse({ user }, 'User topics updated successfully');
        } catch (error) {
          console.error('Error updating wallet user topics:', error);
          set.status = 500;
          return errorResponse('Failed to update user topics');
        }
      }, {
        body: t.Object({
          topics: t.Array(t.String(), { description: 'User interest topics' }),
        }),
        detail: {
          tags: ['Wallet Users'],
          summary: 'Update Wallet User Topics',
          description: `
Updates the authenticated user's interest topics.

**Authentication Required:** Yes (Wallet JWT)
          `,
          security: [{ bearerAuth: [] }],
        },
      })

      // Update user data (notification tokens, etc.)
      .patch('/update', async ({ headers, body, set }) => {
        try {
          const walletAddress = headers['x-user-address'] as string;

          if (!walletAddress) {
            set.status = 400;
            return errorResponse('Missing wallet address');
          }

          const token = body?.token;
          const topics = body?.topics;

          const updateObj: Record<string, any> = {};
          if (token !== undefined) updateObj.token = token;
          if (topics !== undefined) {
            if (!Array.isArray(topics)) {
              set.status = 400;
              return errorResponse('Topics must be an array');
            }
            updateObj.topics = topics;
          }

          if (Object.keys(updateObj).length === 0) {
            set.status = 400;
            return errorResponse('No valid fields to update');
          }

          const user = await User.findOneAndUpdate(
            { walletAddress },
            updateObj,
            { new: true, select: 'walletAddress wallet username displayName pfp_url topics token socials' }
          );

          if (!user) {
            set.status = 404;
            return errorResponse('User not found');
          }

          return successResponse({ user }, 'User updated successfully');
        } catch (error) {
          console.error('Error updating wallet user:', error);
          set.status = 500;
          return errorResponse('Failed to update user');
        }
      }, {
        body: t.Optional(
          t.Object({
            topics: t.Optional(t.Array(t.String(), { description: 'User interest topics' })),
            token: t.Optional(t.String({ description: 'Push notification token' })),
          })
        ),
        detail: {
          tags: ['Wallet Users'],
          summary: 'Update Wallet User Data',
          description: `
Updates user data such as notification tokens or topics.

**Authentication Required:** Yes (Wallet JWT)
          `,
          security: [{ bearerAuth: [] }],
        },
      })
  );
