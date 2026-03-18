'use client'

import { useState, useRef, useEffect } from 'react';
import { IoIosClose } from 'react-icons/io';
import { FaXTwitter } from 'react-icons/fa6';
import { fetchUserByFid } from '@/utils/serverActions';

interface ViewProfileModalProps {
  peer: any;
  isVisible: boolean;
  onClose: () => void;
}

export default function ViewProfileModal({ peer, isVisible, onClose }: ViewProfileModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Platform icons mapping
  const platformIcons: { [key: string]: React.ReactNode } = {
    'x': <FaXTwitter className="w-4 h-4" />,
    'twitter': <FaXTwitter className="w-4 h-4" />,
  };

  // Platform URL mapping
  const platformUrls: { [key: string]: string } = {
    'x': 'https://x.com/',
    'twitter': 'https://twitter.com/',
  };

  const handleSocialClick = (platform: string, username: string) => {
    const baseUrl = platformUrls[platform.toLowerCase()];
    if (baseUrl) {
      window.open(`${baseUrl}${username}`, '_blank');
    }
  };

  useEffect(() => {
    if (isVisible) {
      setIsOpen(true);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
      
      // Fetch user data when modal opens
      const fetchUserData = async () => {
        try {
          setIsLoading(true);
          setError(null);
          
          // Get FID from peer metadata
          const metadata = peer.metadata ? JSON.parse(peer.metadata) : {};
          const fid = metadata.fid;
          
          if (!fid) {
            setError('User FID not found');
            return;
          }
          
          const response = await fetchUserByFid(fid);
          
          if (response.ok) {
            setUserData(response.data.data.user);
          } else {
            setError('Failed to fetch user data');
          }
        } catch (err) {
          console.error('Error fetching user data:', err);
          setError('Failed to load user profile');
        } finally {
          setIsLoading(false);
        }
      };
      
      fetchUserData();
    } else {
      // Reset data when modal closes
      setUserData(null);
      setError(null);
    }
  }, [isVisible, peer]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscapeKey);
    } else {
      // Restore body scroll when modal is not open
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
      // Restore body scroll when component unmounts
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isVisible) {
    return null;
  }

  // Use fetched user data or fallback to peer info
  const userProfile = userData || {
    username: peer.name || 'Unknown User',
    displayName: peer.name || 'Unknown User',
    pfp_url: null,
    socials: {},
    fid: null,
    bio: null,
    wallet: null,
    hostedRooms: [],
    coHostedRooms: [],
    speakerRooms: [],
    listenerRooms: [],
    topics: [],
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 z-50 overflow-y-auto pb-32">
        <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
          <div
            ref={modalRef}
            className="bg-white/10 border border-white/80 rounded-lg w-full max-w-md transform transition-all duration-200 ease-out relative inline-block align-bottom text-left shadow-xl sm:my-8 sm:align-middle"
            style={{
              opacity: isOpen ? 1 : 0,
              transform: isOpen ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(-10px)',
            }}
          >
          {/* Header with close button */}
          <div className="flex items-center justify-between p-6 border-b border-gray-600">
            <h2 className="text-2xl font-bold text-white">Profile</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-700 rounded-full transition-colors"
            >
              <IoIosClose className="w-6 h-6 text-gray-400 hover:text-white" />
            </button>
          </div>

          {/* Profile Content */}
          <div className="px-4 py-8">
            {/* Loading State */}
            {isLoading && (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
                <p className="text-white mt-4">Loading profile...</p>
              </div>
            )}

            {/* Error State */}
            {error && !isLoading && (
              <div className="text-center py-8">
                <p className="text-red-400 mb-4">{error}</p>
                <button
                  onClick={onClose}
                  className="gradient-fire text-white font-medium py-2 px-4 rounded-md transition-colors"
                >
                  Close
                </button>
              </div>
            )}

            {/* Profile Content - Only show when not loading and no error */}
            {!isLoading && !error && (
              <>
                {/* Profile Picture */}
                <div className="text-center mb-6">
              <div className="w-24 h-24 mx-auto mb-4">
                {userProfile.pfp_url ? (
                  <img 
                    src={userProfile.pfp_url} 
                    alt="Profile" 
                    className="w-24 h-24 rounded-full object-cover border-4 border-white"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-fireside-orange flex items-center justify-center">
                    <span className="text-white text-2xl font-bold">
                      {userProfile.username.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Profile Information */}
            <div className="space-y-4">
              <div className="border-b border-gray-600 pb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Username
                </label>
                <p className="text-white text-lg font-medium">
                  {userProfile.username || 'Not set'}
                </p>
              </div>

              {/* Socials Section */}
              {userProfile.socials && Object.keys(userProfile.socials).length > 0 && (
                <div className="border-b border-gray-600 pb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    Social Media
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(userProfile.socials).map(([platform, username]) => (
                      <button
                        key={platform}
                        onClick={() => handleSocialClick(platform, String(username))}
                        className="flex items-center space-x-2 px-3 py-2 bg-gray-700/50 hover:bg-gray-600/50 border border-gray-600 hover:border-gray-500 rounded-lg transition-all duration-200 group cursor-pointer"
                      >
                        <div className="flex items-center justify-center">
                          {platformIcons[platform.toLowerCase()] || (
                            <span className="text-xs font-medium text-gray-300 uppercase">
                              {platform.charAt(0)}
                            </span>
                          )}
                        </div>
                        <span className="text-sm text-white font-medium group-hover:text-orange-300 transition-colors">
                          @{String(username)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Statistics Section */}
            <div className="mt-8">
              <h2 className="text-xl font-bold text-white mb-4">Statistics</h2>
              <div className="space-y-4">
                <div className="border-b border-gray-600 pb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Total Hosted Rooms
                  </label>
                  <p className="text-white text-lg font-medium">{userProfile?.hostedRooms?.length || 0} </p>
                </div>

                <div className="border-b border-gray-600 pb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Total Audience Engaged
                  </label>
                  <p className="text-white text-lg font-medium">0</p>
                </div>

                <div className="border-b border-gray-600 pb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Max Audience Engaged
                  </label>
                  <p className="text-white text-lg font-medium">0</p>
                </div>

                <div className="">
                  <label className="block text-sm font-medium text-gray-300 mb-0">
                    Total Earnings
                  </label>
                  <label className="block text-xs font-medium text-gray-500 mb-2">
                    Earnings from tips + ads
                  </label>
                  <p className="text-white text-lg font-medium">$0</p>
                </div>
              </div>
            </div>


              </>
            )}
          </div>
        </div>
      </div>
      </div>
    </>
  );
}
