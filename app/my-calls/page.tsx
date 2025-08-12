"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { CalendarIcon, UsersIcon, ClockIcon } from '@heroicons/react/24/outline';
import { useGlobalContext } from '@/utils/providers/globalContext';
import BottomNavigation from '@/components/BottomNavigation';

interface MyCall {
  id: string;
  roomId: string;
  name: string;
  description: string;
  isLive: boolean;
  participantCount: number;
  maxParticipants: number;
  createdAt: string;
  roomCode?: string;
}

export default function MyCallsPage() {
  const { user, token } = useGlobalContext();
  const [calls, setCalls] = useState<MyCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'live' | 'past'>('live');

  const fetchMyCalls = async () => {
    try {
      // For now, we'll fetch all rooms created by this user
      // You might want to create a specific endpoint for user's calls
      const response = await fetch(`/api/protected/rooms/list?createdBy=${user?.fid}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch calls');
      }

      const data = await response.json();
      setCalls(data.rooms || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.fid && token) {
      fetchMyCalls();
    }
  }, [user, token]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (startDate: string) => {
    const start = new Date(startDate);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - start.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ${diffInMinutes % 60}m`;
    return `${Math.floor(diffInMinutes / 1440)}d`;
  };

  const liveCalls = calls.filter(call => call.isLive);
  const pastCalls = calls.filter(call => !call.isLive);
  const currentCalls = activeTab === 'live' ? liveCalls : pastCalls;

  if (loading) {
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
          <h1 className="text-2xl font-bold text-gray-900">My Calls</h1>
          <p className="text-gray-600 mt-1">Your room history and active sessions</p>
        </div>

        {/* Tabs */}
        <div className="px-4">
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveTab('live')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'live'
                  ? 'border-orange-600 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Live ({liveCalls.length})
            </button>
            <button
              onClick={() => setActiveTab('past')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'past'
                  ? 'border-orange-600 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Past ({pastCalls.length})
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {currentCalls.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              {activeTab === 'live' ? (
                <UsersIcon className="h-16 w-16 mx-auto" />
              ) : (
                <CalendarIcon className="h-16 w-16 mx-auto" />
              )}
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {activeTab === 'live' ? 'No live rooms' : 'No past calls'}
            </h3>
            <p className="text-gray-600">
              {activeTab === 'live' 
                ? 'Create a room to start hosting conversations!'
                : 'Your call history will appear here once you create rooms.'
              }
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {currentCalls.map((call) => (
              <div
                key={call.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-4"
              >
                {/* Call Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {call.name}
                    </h3>
                    {call.description && (
                      <p className="text-gray-600 text-sm mb-2">{call.description}</p>
                    )}
                  </div>
                  {call.isLive && (
                    <div className="flex items-center text-green-600 bg-green-50 px-2 py-1 rounded-full text-xs font-medium">
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                      LIVE
                    </div>
                  )}
                </div>

                {/* Call Stats */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <div className="flex items-center">
                      <UsersIcon className="h-4 w-4 mr-1" />
                      <span>{call.participantCount}</span>
                      {call.maxParticipants && (
                        <span>/{call.maxParticipants}</span>
                      )}
                    </div>
                    <div className="flex items-center">
                      <CalendarIcon className="h-4 w-4 mr-1" />
                      <span>{formatDate(call.createdAt)}</span>
                    </div>
                    {call.isLive && (
                      <div className="flex items-center">
                        <ClockIcon className="h-4 w-4 mr-1" />
                        <span>{formatDuration(call.createdAt)}</span>
                      </div>
                    )}
                  </div>

                  {/* Action Button */}
                  {call.isLive && call.roomCode && (
                    <button className="px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-colors">
                      Rejoin
                    </button>
                  )}
                </div>

                {/* Room Code for Live Calls */}
                {call.isLive && call.roomCode && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Room Code:</span>
                      <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">
                        {call.roomCode}
                      </code>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNavigation />
    </div>
  );
}
