"use client";

import { useState, useEffect, useCallback } from 'react';
import { Client, type Signer } from '@xmtp/browser-sdk';
import { useAccount, useSignMessage } from 'wagmi';
import { useGlobalContext } from '@/utils/providers/globalContext';
import { toast } from 'react-toastify';

/**
 * Custom hook to manage XMTP client initialization
 * 
 * Handles:
 * - Client creation with wallet signer
 * - Session-based caching
 * - Automatic initialization on mount
 * - Error handling
 */
export function useXMTPClient() {
  const [client, setClient] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { user } = useGlobalContext();
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const initializeClient = useCallback(async () => {
    if (!user || !address) {
      setIsLoading(false);
      return;
    }

    // Check if user has encryption key
    if (!user.xmtpEncryptionKey) {
      setError('XMTP encryption key not found. Please refresh the page.');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Convert hex encryption key to Uint8Array
      const encryptionKey = hexToBytes(user.xmtpEncryptionKey);

      // Create wallet signer
      const signer: Signer = {
        getAddress: () => address.toLowerCase(),
        signMessage: async (message: string) => {
          try {
            const signature = await signMessageAsync({ message });
            return hexToBytes(signature);
          } catch (err) {
            console.error('Error signing message:', err);
            throw err;
          }
        },
      };

      // Create XMTP client with wallet signer
      const xmtpClient = await Client.create(signer, {
        env: process.env.NEXT_PUBLIC_XMTP_ENV === 'production' ? 'production' : 'dev',
        dbEncryptionKey: encryptionKey,
        appVersion: 'fireside/1.0',
      });

      setClient(xmtpClient);
      console.log('XMTP client initialized:', xmtpClient.inboxId);

      // Initialize client on backend
      try {
        const env = process.env.NEXT_PUBLIC_ENV;
        let token: any = '';
        
        if (env !== 'DEV') {
          const sdk = await import('@farcaster/miniapp-sdk');
          token = (await sdk.default.quickAuth.getToken()).token;
        }

        const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
        
        // Get a signature for XMTP authentication
        const authMessage = `XMTP Authentication for ${address}`;
        const signature = await signMessageAsync({ message: authMessage });

        const response = await fetch(`${URL}/api/rooms/protected/xmtp/init`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            walletAddress: address,
            signature: signature,
            message: authMessage,
          }),
        });

        if (!response.ok) {
          console.error('Failed to initialize XMTP client on backend');
        } else {
          console.log('XMTP client initialized on backend');
        }
      } catch (backendError) {
        console.error('Error initializing XMTP on backend:', backendError);
        // Don't fail client initialization if backend fails
      }

    } catch (err) {
      console.error('Error initializing XMTP client:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize XMTP client');
      toast.error('Failed to initialize chat client');
    } finally {
      setIsLoading(false);
    }
  }, [user, address, signMessageAsync]);

  useEffect(() => {
    initializeClient();
  }, [initializeClient]);

  const reinitialize = useCallback(() => {
    setClient(null);
    setError(null);
    initializeClient();
  }, [initializeClient]);

  return {
    client,
    isLoading,
    error,
    reinitialize,
  };
}

/**
 * Helper function to convert hex string to Uint8Array
 */
function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.slice(i, i + 2), 16);
  }
  return bytes;
}
