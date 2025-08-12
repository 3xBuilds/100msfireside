"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { UsersIcon, ClockIcon } from '@heroicons/react/24/outline';
import { useGlobalContext } from '@/utils/providers/globalContext';
import BottomNavigation from '@/components/BottomNavigation';
import { useHMSActions } from '@100mslive/react-sdk';

interface Room {
  id: string;
  roomId: string;
  name: string;
  description: string;
  roomCode: string;
  isLive: boolean;
  participantCount: number;
  maxParticipants: number;
  createdAt: string;
  creator: {
    fid: string;
    username: string;
    displayName: string;
    pfp_url: string;
  } | null;
}

export default function ExplorePage() {
  const { user, token } = useGlobalContext();
  const hmsActions = useHMSActions();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchRooms = async (pageNum: number = 1, append: boolean = false) => {
    try {
      const response = await fetch(`/api/protected/rooms/list?page=${pageNum}&limit=10`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch rooms');
      }

      const data = await response.json();
      
      if (append) {
        setRooms(prev => [...prev, ...data.rooms]);
      } else {
        setRooms(data.rooms);
      }
      
      setHasMore(data.pagination.hasNextPage);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchRooms();
    }
  }, [token]);

  const handleJoinRoom = async (room: Room) => {
    try {
      if (!room.roomCode) {
        alert('Room code not available');
        return;
      }

      const authToken = await hmsActions.getAuthTokenByRoomCode({
        roomCode: room.roomCode,
      });

      await hmsActions.join({
        userName: user?.username || 'Guest',
        authToken,
        metaData: JSON.stringify({
          avatar: user?.pfp_url,
        }),
      });
    } catch (error) {
      console.error('Error joining room:', error);
      alert('Failed to join room');
    }
  };

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchRooms(nextPage, true);
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  if (loading && rooms.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
        </div>
        <BottomNavigation />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Explore Live Rooms</h1>
          <p className="text-gray-600 mt-1">Join conversations happening right now</p>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {rooms.length === 0 && !loading ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <UsersIcon className="h-16 w-16 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No live rooms yet</h3>
            <p className="text-gray-600">Be the first to create a room and start a conversation!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {rooms.map((room) => (
              <div
                key={room.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow"
              >
                {/* Room Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {room.name}
                    </h3>
                    {room.description && (
                      <p className="text-gray-600 text-sm mb-2">{room.description}</p>
                    )}
                  </div>
                  <div className="flex items-center text-green-600 bg-green-50 px-2 py-1 rounded-full text-xs font-medium">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                    LIVE
                  </div>
                </div>

                {/* Creator Info */}
                {room.creator && (
                  <div className="flex items-center mb-3">
                    <Image
                      src={room.creator.pfp_url}
                      alt={room.creator.displayName}
                      width={24}
                      height={24}
                      className="rounded-full mr-2"
                    />
                    <span className="text-sm text-gray-600">
                      by {room.creator.displayName || room.creator.username}
                    </span>
                  </div>
                )}

                {/* Room Stats */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <div className="flex items-center">
                      <UsersIcon className="h-4 w-4 mr-1" />
                      <span>{room.participantCount}</span>
                      {room.maxParticipants && (
                        <span>/{room.maxParticipants}</span>
                      )}
                    </div>
                    <div className="flex items-center">
                      <ClockIcon className="h-4 w-4 mr-1" />
                      <span>{formatTimeAgo(room.createdAt)}</span>
                    </div>
                  </div>

                  {/* Join Button */}
                  <button
                    onClick={() => handleJoinRoom(room)}
                    className="px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-colors"
                  >
                    Join Room
                  </button>
                </div>
              </div>
            ))}

            {/* Load More Button */}
            {hasMore && (
              <div className="text-center py-4">
                <button
                  onClick={loadMore}
                  disabled={loading}
                  className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <BottomNavigation />
    </div>
  );
}
