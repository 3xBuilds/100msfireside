import { Elysia, t } from 'elysia';
import { redis } from '../config/redis';
import * as jose from 'jose';
import { parseSiweMessage, validateSiweMessage } from 'viem/siwe';
import { createPublicClient, http, verifyMessage } from 'viem';
import { mainnet } from 'viem/chains';
import config from '../config';
import { errorResponse, successResponse } from '../utils';

const NONCE_TTL = 300; // 5 minutes
const JWT_EXPIRY = '7d';

function generateNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  const randomValues = crypto.getRandomValues(new Uint8Array(16));
  for (const val of randomValues) {
    nonce += chars[val % chars.length];
  }
  return nonce;
}

export const walletAuthRoutes = new Elysia({ prefix: '/wallet-auth' })
  // GET /api/wallet-auth/nonce — generate a random nonce, store in Redis
  .get('/nonce', async ({ set }) => {
    try {
      const nonce = generateNonce();
      // Store nonce in Redis with TTL
      await redis.setJSON(`siwe:nonce:${nonce}`, { created: Date.now() }, NONCE_TTL);
      return successResponse({ nonce });
    } catch (error) {
      console.error('Error generating nonce:', error);
      set.status = 500;
      return errorResponse('Failed to generate nonce');
    }
  }, {
    detail: {
      tags: ['Wallet Auth'],
      summary: 'Get SIWE Nonce',
      description: 'Generates a random nonce for SIWE (Sign-In With Ethereum) authentication. Nonce expires after 5 minutes.',
    }
  })

  // POST /api/wallet-auth/verify — verify SIWE message + signature, return JWT
  .post('/verify', async ({ body, set }) => {
    try {
      const { message, signature } = body;

      // Parse the SIWE message
      const siweMessage = parseSiweMessage(message);
      
      if (!siweMessage.nonce || !siweMessage.address) {
        set.status = 400;
        return errorResponse('Invalid SIWE message: missing nonce or address');
      }

      // Check nonce exists in Redis (prevents replay attacks)
      const storedNonce = await redis.getJSON<{ created: number }>(`siwe:nonce:${siweMessage.nonce}`);
      if (!storedNonce) {
        set.status = 400;
        return errorResponse('Invalid or expired nonce');
      }

      // Delete nonce immediately (one-time use)
      await redis.del(`siwe:nonce:${siweMessage.nonce}`);

      // Verify the signature matches the message
      const isValid = await verifyMessage({
        address: siweMessage.address as `0x${string}`,
        message,
        signature: signature as `0x${string}`,
      });

      if (!isValid) {
        set.status = 401;
        return errorResponse('Invalid signature');
      }

      const walletAddress = siweMessage.address.toLowerCase();

      // Create or find user
      const User = (await import('../models/User')).default;
      let user = await User.findOne({ walletAddress });

      if (!user) {
        // Resolve ENS name and avatar if available
        let ensName: string | null = null;
        let ensAvatar: string | null = null;
        
        try {
          const publicClient = createPublicClient({
            chain: mainnet,
            transport: http(config.ensRpcUrl || undefined),
          });

          ensName = await publicClient.getEnsName({
            address: siweMessage.address as `0x${string}`,
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

      // Sign JWT with wallet address as subject
      const secret = new TextEncoder().encode(config.jwtSecret);
      const token = await new jose.SignJWT({ 
        walletAddress,
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(walletAddress)
        .setIssuedAt()
        .setExpirationTime(JWT_EXPIRY)
        .setIssuer('fireside')
        .sign(secret);

      return successResponse({ token, user }, 'Authentication successful');
    } catch (error) {
      console.error('Error verifying SIWE message:', error);
      set.status = 500;
      return errorResponse('Failed to verify authentication');
    }
  }, {
    body: t.Object({
      message: t.String({ description: 'The SIWE message that was signed' }),
      signature: t.String({ description: 'The signature of the SIWE message' }),
    }),
    detail: {
      tags: ['Wallet Auth'],
      summary: 'Verify SIWE Signature',
      description: `
Verifies a Sign-In With Ethereum (SIWE) message and signature.

**Flow:**
1. Client connects wallet via RainbowKit
2. Client requests nonce from GET /nonce
3. Client constructs SIWE message with nonce and signs it
4. Client sends message + signature to this endpoint
5. Server verifies signature, creates/fetches user, returns JWT

**Returns:**
- JWT token for subsequent authenticated requests
- User profile data

**JWT Token:**
- Algorithm: HS256
- Subject: wallet address (lowercase)
- Expiry: 7 days
      `,
    }
  })

  // POST /api/wallet-auth/logout — stateless JWT, this is a no-op
  .post('/logout', async () => {
    return successResponse(null, 'Logged out successfully');
  }, {
    detail: {
      tags: ['Wallet Auth'],
      summary: 'Logout',
      description: 'Logout endpoint. Since JWTs are stateless, the client should discard the token.',
    }
  });
