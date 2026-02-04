"use client";

import { useState, useEffect } from 'react';
import type { Client, Conversation } from '@xmtp/browser-sdk';

/**
 * Custom hook to manage XMTP conversation for a room
 * 
 * Handles:
 * - Fetching conversation by room ID
 * - Syncing conversation
 * - Error handling
 */
export function useXMTPConversation(client: Client | null, roomId: string | null) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!client || !roomId) {
      setIsLoading(false);
      return;
    }

    async function fetchConversation() {
      try {
        setIsLoading(true);
        setError(null);

        // Get group ID from backend
        const env = process.env.NEXT_PUBLIC_ENV;
        let token: any = '';
        
        if (env !== 'DEV') {
          const sdk = await import('@farcaster/miniapp-sdk');
          token = (await sdk.default.quickAuth.getToken()).token;
        }

        const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
        
        const response = await fetch(`${URL}/api/rooms/public/${roomId}/xmtp-group`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch XMTP group ID');
        }

        const data = await response.json();
        const groupId = data.data?.groupId;

        if (!groupId) {
          // No XMTP group exists for this room yet
          setConversation(null);
          setIsLoading(false);
          return;
        }

        // Get conversation from client
        const conv = await client!.conversations.getConversationById(groupId);
        
        if (conv) {
          // Sync to get latest state
          await conv.sync();
          setConversation(conv);
        }

      } catch (err) {
        console.error('Error fetching XMTP conversation:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch conversation');
      } finally {
        setIsLoading(false);
      }
    }

    fetchConversation();
  }, [client, roomId]);

  return {
    conversation,
    isLoading,
    error,
  };
}
