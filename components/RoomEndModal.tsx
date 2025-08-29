'use client'

import { useState, useRef, useEffect } from 'react';
import { useHMSActions, useHMSStore, selectLocalPeer } from '@100mslive/react-sdk';
import { useRouter } from 'next/navigation';
import { useGlobalContext } from '@/utils/providers/globalContext';
import sdk from "@farcaster/miniapp-sdk";

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
  const hmsActions = useHMSActions();
  const router = useRouter();
  const { user } = useGlobalContext();
  const localPeer = useHMSStore(selectLocalPeer);

  // Check if local user is host or co-host
  const isHostOrCoHost = localPeer?.roleName === 'host' || localPeer?.roleName === 'co-host';
  const isHost = localPeer?.roleName === 'host';

  const URL = process.env.BACKEND_URL || 'http://localhost:8000';

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

  const handleLeaveRoom = async () => {
    try {
      setError(null);
      setAction('leave');
      setIsLoading(true);
      await hmsActions.leave();
      router.push('/');
    } catch (error) {
      console.error('Error leaving room:', error);
      setError('Failed to leave room. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEndRoomClick = () => {
    setShowEndConfirmation(true);
  };

  const handleEndRoomConfirm = async () => {
    const env = process.env.NEXT_PUBLIC_ENV;
        
        var token: any = "";
        if (env !== "DEV") {
          token = await sdk.quickAuth.getToken();
        };
    try {
      setError(null);
      setAction('end');
      setIsLoading(true);
      
      // Call our API to end the room
      const response = await fetch(`${URL}/api/rooms/protected/${roomId}/end`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userId: user._id }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to end room');
      }

      // Leave the room after ending it
      await hmsActions.leave();
      router.push('/');
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

  if (!isVisible) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          ref={modalRef}
          className="bg-gray-800 border border-gray-600 rounded-xl shadow-2xl w-full max-w-sm mx-4 transform transition-all duration-200 ease-out"
          style={{
            opacity: isOpen ? 1 : 0,
            transform: isOpen ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(-10px)',
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          aria-describedby="modal-description"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-600">
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
          <div className="py-4">
            {isHost && (
              <div className="px-6 mb-4">
                <p className="text-gray-300 text-sm">
                  As the host, you can either leave the room (keeping it open) or end it completely.
                </p>
              </div>
            )}
            
            {/* Error Message */}
            {error && (
              <div className="px-6 mb-4">
                <div className="bg-red-900/50 border border-red-600 rounded-lg p-3">
                  <p className="text-red-300 text-sm">{error}</p>
                </div>
              </div>
            )}

            {/* Confirmation Warning */}
            {showEndConfirmation && (
              <div className="px-6 mb-4">
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
          <div className="px-6 pb-4 space-y-3">
            {/* Leave Room Button */}
            <button
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
            </button>

            {/* End Room Button - Only show for host */}
            {isHost && !showEndConfirmation && (
              <button
                onClick={handleEndRoomClick}
                disabled={isLoading}
                className="w-full px-4 py-3 bg-fireside-orange hover:bg-orange-600 disabled:bg-orange-700 text-white rounded-lg transition-colors flex items-center justify-center space-x-2"
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
                  className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-700 text-white rounded-lg transition-colors flex items-center justify-center space-x-2"
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
                  className="w-full px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
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
                className="w-full px-4 py-3 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-700 text-gray-300 rounded-lg transition-colors"
                aria-label="Cancel leaving the room"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
