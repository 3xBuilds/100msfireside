"use client";

import React, { useEffect, useState } from 'react';
import { Loader } from './Loader';

const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

interface RewardSummary {
  totalEarned: number;
  pendingBalance: number;
  lastRewardAt: string | null;
}

interface Reward {
  _id: string;
  type: 'daily_login' | 'host_room' | 'participant_milestone';
  amount: number;
  currency: string;
  status: string;
  txHash?: string;
  claimedAt?: string;
  distributedAt?: string;
  createdAt: string;
  metadata?: {
    roomId?: any;
    participantCount?: number;
    milestone?: number;
    roomDuration?: number;
  };
}

interface RewardHistoryData {
  rewards: Reward[];
  summary: RewardSummary;
}

const REWARD_TYPE_LABELS: Record<string, string> = {
  daily_login: '📅 Daily Login',
  host_room: '🎤 Hosting Room',
  participant_milestone: '🎯 Milestone Achievement',
};

const REWARD_TYPE_COLORS: Record<string, string> = {
  daily_login: 'from-blue-500/20 to-cyan-500/20 border-blue-500/30',
  host_room: 'from-purple-500/20 to-pink-500/20 border-purple-500/30',
  participant_milestone: 'from-green-500/20 to-emerald-500/20 border-green-500/30',
};

export function RewardsHistory() {
  const [data, setData] = useState<RewardHistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRewardHistory();
  }, []);

  const fetchRewardHistory = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${URL}/api/rewards/protected/history`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch reward history');
      }

      const result = await response.json();
      if (result.success && result.data) {
        setData(result.data);
      } else {
        throw new Error(result.error || 'Failed to load rewards');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rewards');
    } finally {
      setLoading(false);
    }
  };

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

  const getRewardDetails = (reward: Reward) => {
    const details: string[] = [];
    
    if (reward.metadata?.participantCount) {
      details.push(`${reward.metadata.participantCount} participants`);
    }
    
    if (reward.metadata?.milestone) {
      details.push(`${reward.metadata.milestone}+ milestone`);
    }
    
    if (reward.metadata?.roomDuration) {
      const minutes = Math.round(reward.metadata.roomDuration);
      details.push(`${minutes} min duration`);
    }
    
    return details.join(' • ');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 text-center">
        <p className="text-red-400">{error}</p>
        <button
          onClick={fetchRewardHistory}
          className="mt-4 bg-red-500/20 hover:bg-red-500/30 text-red-300 px-4 py-2 rounded-lg transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-lg p-6">
          <p className="text-sm text-gray-400 mb-1">Total Earned</p>
          <p className="text-3xl font-bold text-yellow-400">
            {data.summary.totalEarned.toFixed(2)}
          </p>
          <p className="text-xs text-gray-500 mt-1">FIRE Tokens</p>
        </div>

        <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/30 rounded-lg p-6">
          <p className="text-sm text-gray-400 mb-1">Pending Balance</p>
          <p className="text-3xl font-bold text-blue-400">
            {data.summary.pendingBalance.toFixed(2)}
          </p>
          <p className="text-xs text-gray-500 mt-1">FIRE Tokens</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-lg p-6">
          <p className="text-sm text-gray-400 mb-1">Total Rewards</p>
          <p className="text-3xl font-bold text-purple-400">
            {data.rewards.length}
          </p>
          <p className="text-xs text-gray-500 mt-1">Rewards Received</p>
        </div>
      </div>

      {/* Reward History List */}
      <div className="space-y-3">
        <h3 className="text-xl font-semibold mb-4">Reward History</h3>
        
        {data.rewards.length === 0 ? (
          <div className="bg-gray-500/10 border border-gray-500/30 rounded-lg p-8 text-center">
            <p className="text-gray-400">No rewards yet. Start earning by logging in daily and hosting rooms!</p>
          </div>
        ) : (
          data.rewards.map((reward) => (
            <div
              key={reward._id}
              className={`bg-gradient-to-r ${REWARD_TYPE_COLORS[reward.type] || 'from-gray-500/10 to-gray-600/10 border-gray-500/30'} border rounded-lg p-4`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold">
                      {REWARD_TYPE_LABELS[reward.type] || reward.type}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        reward.status === 'completed'
                          ? 'bg-green-500/20 text-green-400'
                          : reward.status === 'pending'
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}
                    >
                      {reward.status}
                    </span>
                  </div>
                  
                  <p className="text-sm text-gray-400 mb-2">
                    {formatDate(reward.distributedAt || reward.claimedAt || reward.createdAt)}
                  </p>
                  
                  {getRewardDetails(reward) && (
                    <p className="text-xs text-gray-500">{getRewardDetails(reward)}</p>
                  )}
                  
                  {reward.txHash && (
                    <a
                      href={`https://basescan.org/tx/${reward.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block mt-2 text-xs text-blue-400 hover:text-blue-300 underline"
                    >
                      View on Basescan ↗
                    </a>
                  )}
                </div>
                
                <div className="text-right">
                  <p className="text-2xl font-bold text-white">
                    +{reward.amount}
                  </p>
                  <p className="text-xs text-gray-400">{reward.currency}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default RewardsHistory;
