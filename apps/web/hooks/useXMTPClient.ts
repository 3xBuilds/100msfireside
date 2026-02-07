"use client";

import { useState, useCallback } from 'react';
import { useGlobalContext } from '@/utils/providers/globalContext';
import { toast } from 'react-toastify';

/**
 * Custom hook to initialize XMTP on backend
 * 
 * Handles:
 * - Backend XMTP client initialization via API
 * - Error handling
 * - Loading states
 */
export function useXMTPClient() {
  const [initialized, setInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inboxId, setInboxId] = useState<string | null>(null);
  
  const { user } = useGlobalContext();

  const initializeClient = useCallback(async () => {
    if (!user || initialized) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const env = process.env.NEXT_PUBLIC_ENV;
      let token: any = '';
      
      if (env !== 'DEV') {
        const sdk = await import('@farcaster/miniapp-sdk');
        token = (await sdk.default.quickAuth.getToken()).token;
      }

      const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

      const response = await fetch(`${URL}/api/rooms/protected/xmtp/init`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to initialize XMTP on backend');
      }

      const data = await response.json();
      
      if (data.success) {
        setInitialized(true);
        setInboxId(data.data.inboxId);
        console.log('[XMTP] Client initialized on backend:', data.data.inboxId);
      } else {
        throw new Error(data.error || 'Failed to initialize XMTP');
      }

    } catch (err) {
      console.error('Error initializing XMTP:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize XMTP');
      toast.error('Failed to initialize chat');
    } finally {
      setIsLoading(false);
    }
  }, [user, initialized]);

  const reinitialize = useCallback(() => {
    setInitialized(false);
    setInboxId(null);
    setError(null);
    initializeClient();
  }, [initializeClient]);

  return {
    initialized,
    inboxId,
    isLoading,
    error,
    initializeClient,
    reinitialize,
  };
}
