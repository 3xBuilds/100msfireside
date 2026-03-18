'use client'

import { useState, useRef, useEffect } from 'react';
import { useAgoraContext } from '@/contexts/AgoraContext';
import { useRoomEndedEvent } from '@/utils/events';
import { useRouter } from 'next/navigation';
import { useGlobalContext } from '@/utils/providers/globalContext';
import { useRewardContext } from '@/contexts/RewardContext';
import { getAuthToken } from "@/utils/auth";
import Modal from '@/components/UI/Modal';
import { endProtectedRoom } from '@/utils/serverActions';

interface RoomEndModalProps {
  isVisible: boolean;
  onClose: () => void;
  roomId: string;
}

export default function RoomEndModal({ isVisible, onClose, roomId }: RoomEndModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [action, setAction] = useState<'leave' | 'end' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showEndConfirmation, setShowEndConfirmation] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const { localPeer } = useAgoraContext();
  const router = useRouter();
  const { user } = useGlobalContext();
  const { setRewardData } = useRewardContext();

   // Use the utility function for room ended events
   const { endRoomReward } = useRoomEndedEvent();

  // Check if local user is host or co-host
  const isHostOrCoHost = localPeer?.roleName === 'host' || localPeer?.roleName === 'co-host';
  const isHost = localPeer?.roleName === 'host';

  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

  useEffect(() => {
    if (isVisible) {
      setIsOpen(true);
      setError(null); // Clear any previous errors
      setShowEndConfirmation(false); // Reset confirmation state
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
      
      // Focus the first button for accessibility
      setTimeout(() => {
        const firstButton = modalRef.current?.querySelector('button');
        if (firstButton) {
          (firstButton as HTMLElement).focus();
        }
      }, 100);
    }
  }, [isVisible]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
      if (event.key === 'Enter' && showEndConfirmation) {
        handleEndRoomConfirm();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      // Restore body scroll when modal closes
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose, showEndConfirmation]);


  const handleEndRoomClick = () => {
    setShowEndConfirmation(true);
  };

  const handleEndRoomConfirm = async () => {
    const token = getAuthToken() || "";
    const authHeader = token ? `Bearer ${token}` : 'Bearer dev';
    
    try {
      setError(null);
      setAction('end');
      setIsLoading(true);

      // Broadcast ENDED_REWARD event BEFORE ending the room so participants
      // still have an active Agora connection and can receive the event via polling.
      endRoomReward('Room has been ended by the host.');

      // Wait for at least one poll cycle (polling is every 1.5s) so remote
      // participants pick up the event before the backend kills the Agora channel.
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Call our API to end the room
      const response = await endProtectedRoom(roomId, user._id, token);

      if (!response.ok) {
        throw new Error(response.data.error || 'Failed to end room');
      }
      
      // Extract reward data if available
      const rewardData = response.data?.data?.rewards?.breakdown;

      console.log("ROOM ENDED REWARDS", JSON.stringify( response.data.data.rewards))
      
      // Set reward data for host's RoomEndScreen
      setRewardData(rewardData);
      onClose();
      try {
        await fetch(`/api/ads/controls/room-ended/${roomId}`, {
          method: 'POST',
          headers: {
            Authorization: authHeader,
          },
        });
      } catch (e) {
        console.warn('Failed to notify ads room-ended', e);
      }
      
    } catch (error) {
      console.error('Error ending room:', error);
      setError(error instanceof Error ? error.message : 'Failed to end room. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelEnd = () => {
    setShowEndConfirmation(false);
    setError(null);
  };

  // Don't render anything if modal isn't visible
  if (!isVisible) return null;

  return (
    <Modal isOpen={isVisible} onClose={onClose} className="gradient-red-bg bg-black border-white/5 max-w-sm">
      {/* Header */}
      <div className="mb-4 border-b border-gray-600 pb-4">
        <div className="text-center">
          <h3 id="modal-title" className="text-white font-semibold text-lg">
            {showEndConfirmation ? 'End Room Confirmation' : 'Leave Room'}
          </h3>
          <p id="modal-description" className="text-gray-400 text-sm mt-1">
            {showEndConfirmation 
              ? 'This action cannot be undone. The room will be permanently disabled.'
              : isHost 
                ? 'Choose what you want to do with this room'
                : 'Are you sure you want to leave?'
            }
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="mb-4">
        {isHost && (
          <div className="mb-4">
            <p className="text-gray-300 text-sm">
              As the host, you can either leave the room (keeping it open) or end it completely.
            </p>
          </div>
        )}
        
        {/* Error Message */}
        {error && (
          <div className="mb-4">
            <div className="bg-red-900/50 border border-red-600 rounded-lg p-3">
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Confirmation Warning */}
        {showEndConfirmation && (
          <div className="mb-4">
            <div className="bg-orange-900/30 border border-orange-600/50 rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <p className="text-orange-300 text-sm font-medium">
                  Warning: This will permanently disable the room for all participants.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="space-y-3">
        {/* Leave Room Button */}
        {/* <button
          onClick={handleLeaveRoom}
          disabled={isLoading}
          className="w-full px-4 py-3 bg-fireside-blue hover:bg-blue-600 disabled:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center space-x-2"
          aria-label="Leave room and keep it open"
        >
          {isLoading && action === 'leave' ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          )}
          <span>Leave Room</span>
        </button> */}

        {/* End Room Button - Only show for host */}
        {isHost && !showEndConfirmation && (
          <button
            onClick={handleEndRoomClick}
            disabled={isLoading}
            className="w-full px-4 py-3 bg-neutral-red hover:bg-orange-600 disabled:bg-orange-700 text-white rounded-lg transition-colors flex items-center justify-center space-x-2"
            aria-label="End room permanently"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span>End Room</span>
          </button>
        )}

        {/* End Room Confirmation Buttons */}
        {isHost && showEndConfirmation && (
          <>
            <button
              onClick={handleEndRoomConfirm}
              disabled={isLoading}
              className="w-full px-4 py-3 bg-neutral-red hover:bg-red-700 disabled:bg-red-700 text-white rounded-lg transition-colors flex items-center justify-center space-x-2"
              aria-label="Confirm ending the room permanently"
            >
              {isLoading && action === 'end' ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              )}
              <span>Yes, End Room</span>
            </button>
            <button
              onClick={handleCancelEnd}
              disabled={isLoading}
              className="w-full px-4 py-3 bg-white/10 text-white rounded-lg transition-colors"
              aria-label="Cancel ending the room"
            >
              Cancel
            </button>
          </>
        )}

        {/* Cancel Button - Only show when not in end confirmation */}
        {!showEndConfirmation && (
          <button
            onClick={onClose}
            disabled={isLoading}
            className="w-full px-4 py-3 bg-white/10 disabled:bg-white/20 text-gray-300 rounded-lg transition-colors"
            aria-label="Cancel leaving the room"
          >
            Cancel
          </button>
        )}
      </div>
    </Modal>
  );
}
