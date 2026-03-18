'use client'

import { useState, useEffect, useRef } from 'react';
import { useAgoraContext } from '@/contexts/AgoraContext';
import { toast } from 'react-toastify';
import { useAuthToken } from '@/hooks/useAuthToken';
import Modal from '@/components/UI/Modal';
import { transferHostRole, fetchAPI, updateParticipantRole } from '@/utils/serverActions';
import { useTipEvent } from '@/utils/events';
import { createPortal } from 'react-dom';
import Image from 'next/image';

interface AvatarContextMenuProps {
  peer: any;
  isVisible: boolean;
  onClose: () => void;
  onOpenTipDrawer?: () => void;
}

export default function AvatarContextMenu({ peer, isVisible, onClose, onOpenTipDrawer }: AvatarContextMenuProps) {
  const { localPeer, sendCustomEvent } = useAgoraContext();
  const { getToken } = useAuthToken();
  const menuRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Role-based permissions (no HMS permissions store)
  const isHostOrCoHost = localPeer?.roleName === 'host' || localPeer?.roleName === 'co-host';
  const canRemoteMute = isHostOrCoHost;
  const canRemovePeer = localPeer?.roleName === 'host';
  const isPeerAudioEnabled = !!peer?.audioTrack;

  const isLocalUser = peer?.id === localPeer?.id;
  const isTargetPeerHost = peer?.roleName === 'host';
  const isCoHostTryingToAccessHost = localPeer?.roleName === 'co-host' && isTargetPeerHost;

  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

  useTipEvent((msg) => {
    // Check if the local peer is one of the recipients
    const isRecipient = msg.recipients.some(
      recipient => recipient.username === localPeer?.name
    );
    if (isRecipient) {
      toast.success(`${msg.tipper.username} tipped you $${msg.amount.usd} in ${msg.amount.currency}! 🎉`);
    }
  });

  useEffect(() => {
    if (isVisible && !isCoHostTryingToAccessHost && !isLocalUser) {
      setIsOpen(true);
      document.body.style.overflow = 'hidden';
    } else {
      setIsOpen(false);
      document.body.style.overflow = 'unset';
    }
  }, [isVisible, isCoHostTryingToAccessHost, isLocalUser]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const handleRoleChange = async (newRole: string) => {
    const env = process.env.NEXT_PUBLIC_ENV;
        
    var token: any = "";
    if (env !== "DEV") {
      token = await getToken();
    };
    
    try {
      setIsLoading(true);
      
      const metadata = peer.metadata ? JSON.parse(peer.metadata) : null;
      const userFid = metadata?.fid;
      
      if (userFid) {
        const pathParts = window.location.pathname.split('/');
        const roomId = pathParts[pathParts.length - 1];

        // Update role via backend API
        await updateParticipantRole(roomId, String(userFid), newRole, token);

        // Send ROLE_UPDATED custom event so the target peer re-joins with the new role
        sendCustomEvent('ROLE_UPDATED', { targetFid: String(userFid), newRole });
      }
      
      onClose();
    } catch (error) {
      console.error('Error changing role:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleTransferHost = async () => {
    if (!localPeer) {
      console.error('Local peer not found');
      return;
    }
    
    try {
      setIsLoading(true);
      const pathParts = window.location.pathname.split('/');
      const roomId = pathParts[pathParts.length - 1];
      
      const peerMetadata = peer.metadata ? JSON.parse(peer.metadata) : null;
      const peerFid = peerMetadata?.fid;
      
      let localFid = null;
      if (localPeer.metadata) {
        const localMetadata = JSON.parse(localPeer.metadata);
        localFid = localMetadata?.fid;
      }
      
      if (!peerFid || !localFid) {
        console.error('Missing user FIDs, cannot transfer host role');
        return;
      }
      
      const promoteResponse = await transferHostRole(roomId, peerFid, 'host');
      
      if (!promoteResponse.ok) {
        console.error('Failed to promote user to host');
        throw new Error('Failed to promote user to host');
      }
      
      const demoteResponse = await transferHostRole(roomId, localFid, 'co-host');
      
      if (!demoteResponse.ok) {
        console.error('Failed to demote current host to co-host');
      }
      
      // Send role change events via Agora custom events
      sendCustomEvent('ROLE_UPDATED', { targetFid: String(peerFid), newRole: 'host' });
      sendCustomEvent('ROLE_UPDATED', { targetFid: String(localFid), newRole: 'co-host' });
      
      onClose();
    } catch (error) {
      console.error('Error transferring host role:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMuteToggle = async () => {
    if (!canRemoteMute) return;
    // Remote mute via custom event - target peer will handle locally
    const metadata = peer.metadata ? JSON.parse(peer.metadata) : null;
    const peerFid = metadata?.fid;
    if (peerFid) {
      sendCustomEvent('REMOTE_MUTE', { targetFid: String(peerFid), mute: isPeerAudioEnabled });
    }
    onClose();
  };

  const handleRemoveUser = async () => {
    if (!canRemovePeer) {
      console.log('Cannot remove peer - insufficient permissions');
      toast.error('You do not have permission to remove users');
      return;
    }
    try {
      const env = process.env.NEXT_PUBLIC_ENV;
      let token: any = "";
      if (env !== "DEV") {
        token = await getToken();
      }
      
      const pathParts = window.location.pathname.split('/');
      const roomId = pathParts[pathParts.length - 1];
      const metadata = peer.metadata ? JSON.parse(peer.metadata) : null;
      const peerFid = metadata?.fid;
      
      if (peerFid) {
        await fetchAPI(
          `${URL}/api/rooms/protected/${roomId}/leave`,
          {
            method: "POST",
            body: { userFid: peerFid, kicked: true },
            authToken: token,
          }
        );
        // Notify the peer to leave
        sendCustomEvent('PEER_REMOVED', { targetFid: String(peerFid), reason: 'Host removed you from the room!' });
      }
      
      toast.success(`${peer.name} has been removed from the room`);
      onClose();
    } catch (err) {
      console.error('Remove peer failed:', err);
      toast.error('Failed to remove user from room');
    }
  };

  const handleViewProfile = async () => {
    try {
      const metadata = peer.metadata ? JSON.parse(peer.metadata) : null;
      const userFid = metadata?.fid;
      
      if (userFid) {
        window.open(`/user/${userFid}`, '_blank');
        onClose();
      } else {
        console.error('User FID not found in peer metadata');
      }
    } catch (error) {
      console.error('Error viewing profile:', error);
    }
  };

  if (isLocalUser) {
    return null;
  }

  const currentRole = peer?.roleName;
  const isMuted = !isPeerAudioEnabled;
  const canManageRoles = isHostOrCoHost && !isCoHostTryingToAccessHost;

  const modalContent = (
    <Modal
      isOpen={isVisible}
      onClose={onClose}
      className="bg-[#000000] gradient-yellow-bg rounded-xl shadow-2xl border-white/5 p-0"
      showCloseButton={false}
    >
      <div className="p-4 border-b border-gray-700/50">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full overflow-hidden border border-gray-700">
            {peer.metadata ? (
              <Image 
                unoptimized 
                src={JSON.parse(peer.metadata).avatar} 
                alt={`${peer.name}'s avatar`} 
                width={48} 
                height={48} 
                className="rounded-full w-full h-full" 
              />
            ) : (
              <span className="text-white text-lg font-medium">
                {peer.name?.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex-1">
            <h3 className="text-white font-medium text-lg">{peer.name}</h3>
            <p className="text-gray-400 text-sm capitalize">{currentRole}</p>
          </div>
        </div>
      </div>

      <div className="p-2">
        <button
          onClick={handleViewProfile}
          className="w-full text-left px-4 py-3 text-white hover:bg-gray-800/50 rounded-lg transition-colors flex items-center gap-2"
        >
          <span>View Profile</span>
        </button>

        {canManageRoles && (
          <>
            {currentRole === 'listener' && (
              <button
                onClick={() => handleRoleChange('speaker')}
                disabled={isLoading}
                className="w-full text-left px-4 py-3 text-white hover:bg-gray-800/50 rounded-lg transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Promoting...' : 'Promote to Speaker'}
              </button>
            )}
            
            {currentRole === 'speaker' && (
              <>
                <button
                  onClick={() => handleRoleChange('co-host')}
                  disabled={isLoading}
                  className="w-full text-left px-4 py-3 text-white hover:bg-gray-800/50 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isLoading ? 'Promoting...' : 'Promote to Co-host'}
                </button>
                <button
                  onClick={() => handleRoleChange('listener')}
                  disabled={isLoading}
                  className="w-full text-left px-4 py-3 text-white hover:bg-gray-800/50 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isLoading ? 'Demoting...' : 'Demote to Listener'}
                </button>
              </>
            )}
            
            {currentRole === 'co-host' && localPeer?.roleName === 'host' && (
              <>
                <button
                  onClick={handleTransferHost}
                  disabled={isLoading}
                  className="w-full text-left px-4 py-3 text-white hover:bg-gray-800/50 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isLoading ? 'Transferring...' : 'Transfer Host Role'}
                </button>
                <button
                  onClick={() => handleRoleChange('speaker')}
                  disabled={isLoading}
                  className="w-full text-left px-4 py-3 text-white hover:bg-gray-800/50 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isLoading ? 'Demoting...' : 'Demote to Speaker'}
                </button>
              </>
            )}
            
            {canRemoteMute && peer.audioTrack && currentRole !== 'listener' && (
              <button
                onClick={handleMuteToggle}
                className="w-full text-left px-4 py-3 text-white hover:bg-gray-800/50 rounded-lg transition-colors"
              >
                {isMuted ? 'Unmute' : 'Mute'}
              </button>
            )}
            
            {canRemovePeer && (
              <button
                onClick={handleRemoveUser}
                className="w-full text-left px-4 py-3 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                Remove from Room
              </button>
            )}
          </>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation();
            if (onOpenTipDrawer) {
              onOpenTipDrawer();
            }
          }}
          className="w-full text-left px-4 py-3 text-white hover:bg-gray-800/50 rounded-lg transition-colors flex items-center gap-2"
        >
          <span>Send Tip</span>
        </button>
      </div>
    </Modal>
  );

  return typeof window !== 'undefined' ? createPortal(modalContent, document.body) : null;
}