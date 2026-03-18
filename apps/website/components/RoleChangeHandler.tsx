'use client'

import { useEffect, useRef } from 'react';
import { useAgoraContext } from '@/contexts/AgoraContext';
import { useParams } from 'next/navigation';
import { fetchAPI } from '@/utils/serverActions';
import { getAuthToken } from '@/utils/auth';

export default function RoleChangeHandler() {
  const params = useParams();
  const roomId = params.id as string;
  const { localPeer, changeRole, renewToken, onCustomEvent } = useAgoraContext();
  const isChangingRole = useRef(false);
  const lastRole = useRef<string | null>(null);
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

  // Handle token expiry — fetch a fresh token and renew without disconnecting
  useEffect(() => {
    const unsubscribe = onCustomEvent('TOKEN_EXPIRING', async () => {
      const authToken = getAuthToken() || "";

      try {
        const response = await fetchAPI(
          `${URL}/api/rooms/protected/${roomId}/my-code`,
          { authToken }
        );

        if (response.ok && response.data.success) {
          await renewToken(response.data.data.token);
        }
      } catch (error) {
        console.error('[RoleChangeHandler] Failed to renew token:', error);
      }
    });

    return unsubscribe;
  }, [renewToken, onCustomEvent, roomId, URL]);

  // Handle role change — use Agora-native role switching (no leave/rejoin needed)
  useEffect(() => {
    const unsubscribe = onCustomEvent('ROLE_UPDATED', async (data: { targetFid: string; newRole: string }) => {
      if (!localPeer?.metadata) return;
      
      try {
        const metadata = JSON.parse(localPeer.metadata);
        
        // Only handle role changes for the local user
        if (String(metadata.fid) !== String(data.targetFid)) return;
        
        const newRole = data.newRole;

        // Prevent concurrent role changes and duplicate processing
        if (isChangingRole.current || lastRole.current === newRole || !newRole) {
          return;
        }

        // Validate role
        const validRoles = ['host', 'co-host', 'speaker', 'listener'];
        if (!validRoles.includes(newRole)) {
          console.warn(`[RoleChangeHandler] Unknown role: ${newRole}, skipping`);
          return;
        }

        lastRole.current = newRole;
        isChangingRole.current = true;

        try {
          window.dispatchEvent(new CustomEvent('role_change_event', {
            detail: { type: 'role_change_start', newRole }
          }));
          
          const authToken = getAuthToken() || "";

          // Fetch a new token with privileges matching the new role
          const response = await fetchAPI(
            `${URL}/api/rooms/protected/${roomId}/my-code`,
            { authToken }
          );

          if (!response.ok || !response.data.success) {
            throw new Error(response.data.error || 'Failed to fetch new token');
          }

          const { role, token: agoraToken } = response.data.data;

          // Switch role in-channel: renewToken + setClientRole + audio track management
          await changeRole(
            role,
            agoraToken,
            JSON.stringify({
              avatar: metadata.avatar || '',
              role: role,
              fid: metadata.fid || '',
              wallet: metadata.wallet || '0x1ce256752fBa067675F09291d12A1f069f34f5e8',
            })
          );
          
          window.dispatchEvent(new CustomEvent('role_change_event', {
            detail: { type: 'role_change_complete', newRole: role }
          }));
        } catch (error) {
          console.error('[RoleChangeHandler] Error changing role:', error);
          
          window.dispatchEvent(new CustomEvent('role_change_event', {
            detail: { type: 'role_change_failed', error: error instanceof Error ? error.message : 'Unknown error' }
          }));
        } finally {
          isChangingRole.current = false;
        }
      } catch (e) {
        console.error('[RoleChangeHandler] Error parsing metadata:', e);
      }
    });

    return unsubscribe;
  }, [localPeer, changeRole, onCustomEvent, roomId, URL]);

  return null;
}