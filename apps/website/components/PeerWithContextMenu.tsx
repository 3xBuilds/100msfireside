'use client'

import { useState, useRef } from 'react';
import { useAgoraContext } from '@/contexts/AgoraContext';
import Peer from './Peer';
import UserContextMenu from './UserContextMenu';
import ViewProfileModal from './ViewProfileModal';

interface PeerWithContextMenuProps {
  peer: any;
}

export default function PeerWithContextMenu({ peer }: PeerWithContextMenuProps) {
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const { localPeer } = useAgoraContext();
  const peerRef = useRef<HTMLDivElement>(null);

  // Check if local user is host or co-host
  const isHostOrCoHost = localPeer?.roleName === 'host' || localPeer?.roleName === 'co-host';
  
  // Check if this is the local user
  const isLocalUser = peer.id === localPeer?.id;
  
  // Check if target peer is a host (to prevent co-hosts from accessing host's context menu)
  const isTargetPeerHost = peer.roleName === 'host';
  
  // Check if local user is co-host trying to access host's menu (not allowed)
  const isCoHostTryingToAccessHost = localPeer?.roleName === 'co-host' && isTargetPeerHost;

  const handlePeerClick = (event: React.MouseEvent) => {
    // Don't show menu for local user
    if (isLocalUser) return;

    event.preventDefault();
    event.stopPropagation();
    setShowContextMenu(true);
  };

  const handleContextMenuClose = () => {
    setShowContextMenu(false);
  };

  const handleViewProfile = () => {
    setShowProfileModal(true);
  };

  const handleProfileModalClose = () => {
    setShowProfileModal(false);
  };

  return (
    <div ref={peerRef} className="relative z-10">
      <div className='relative' onClick={handlePeerClick}>
        <Peer peer={peer} />
      </div>

      {!isLocalUser && (
        <UserContextMenu
          peer={peer}
          isVisible={showContextMenu}
          onClose={handleContextMenuClose}
          onViewProfile={handleViewProfile}
          position={{ x: 0, y: 0 }} // Not used anymore but keeping for compatibility
        />
      )}

      {/* <ViewProfileModal
        peer={peer}
        isVisible={showProfileModal}
        onClose={handleProfileModalClose}
      /> */}
    </div>

  );
}
