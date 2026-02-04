import type { Context } from 'elysia';
import User from '../models/User';
import { xmtpClientManager } from '../services/xmtp';
import { ensureXMTPKey } from '../utils/xmtp-helpers';
import { errorResponse } from '../utils';

/**
 * XMTP middleware to attach XMTP client to context
 * Requires authentication middleware to run first
 * 
 * Expected headers:
 * - x-user-fid: User's Farcaster ID (from auth middleware)
 * - x-wallet-address: User's connected wallet address
 * - x-wallet-signature: Signature for XMTP authentication
 * - x-signature-message: Message that was signed
 */
export async function xmtpMiddleware(context: any) {
  const { headers, set } = context;
  
  const userFid = headers['x-user-fid'] as string;
  const walletAddress = headers['x-wallet-address'] as string;
  const walletSignature = headers['x-wallet-signature'] as string;

  if (!userFid) {
    set.status = 401;
    return errorResponse('Authentication required');
  }

  if (!walletAddress) {
    set.status = 400;
    return errorResponse('Wallet address required');
  }

  if (!walletSignature) {
    set.status = 400;
    return errorResponse('Wallet signature required for XMTP');
  }

  try {
    // Fetch user and ensure they have an encryption key
    const user = await User.findOne({ fid: parseInt(userFid) });
    if (!user) {
      set.status = 404;
      return errorResponse('User not found');
    }

    // Ensure user has XMTP encryption key
    const encryptionKey = await ensureXMTPKey(user);

    // Create or get cached XMTP client
    // We'll use the provided signature directly
    const signMessage = async (message: string) => {
      // This is a simplified approach - in production you'd verify the signature
      // For now, we return the signature provided by the frontend
      return walletSignature;
    };

    const xmtpClient = await xmtpClientManager.getOrCreateClient(
      userFid,
      walletAddress,
      encryptionKey,
      signMessage
    );

    // Attach client to context
    context.xmtpClient = xmtpClient;
    context.user = user;
  } catch (error) {
    console.error('Error in XMTP middleware:', error);
    set.status = 500;
    return errorResponse('Failed to initialize XMTP client');
  }
}
