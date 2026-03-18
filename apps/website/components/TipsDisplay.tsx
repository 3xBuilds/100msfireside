'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTipEvent, TipEventMessage } from '@/utils/events';
import { fetchRoomTips } from '@/utils/serverActions';
import { RiLoader5Fill } from 'react-icons/ri';
import { CiMoneyBill } from 'react-icons/ci';
import { IoChevronDown, IoChevronUp } from 'react-icons/io5';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from './UI/Card';
import { useAuthToken } from '@/hooks/useAuthToken';

interface TipsDisplayProps {
  roomId: string;
}

interface TipStatistics {
  totalTipsUSD: number;
  totalTipsByUsers: number;
  tipsByCurrency: {
    ETH: { count: number; totalUSD: number; totalNative: number };
    USDC: { count: number; totalUSD: number; totalNative: number };
    FIRE: { count: number; totalUSD: number; totalNative: number };
  };
  recentTips: Array<{
    id: string;
    tipper: { username: string; pfp_url: string };
    recipients: Array<{ username?: string; pfp_url?: string; role?: string }>;
    amount: { usd: number; currency: string; native: number };
    timestamp: string;
  }>;
}

export default function TipsDisplay({ roomId }: TipsDisplayProps) {
  const { getToken } = useAuthToken();
  const [statistics, setStatistics] = useState<TipStatistics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [lastTipId, setLastTipId] = useState<string>('');

  // Listen for tip events to trigger immediate refetch
  useTipEvent((tipData: TipEventMessage) => {
    console.log('[TipsDisplay] Received tip event:', tipData.roomId);
    console.log('[TipsDisplay] Current roomId:', roomId);
    console.log(roomId === tipData.roomId ? 'Room IDs match' : 'Room IDs do not match');
    console.log(roomId == tipData.roomId ? 'Room IDs match' : 'Room IDs do not match');
    // Only refetch if the tip is for this room
    if (tipData.roomId == roomId) {
      fetchStatistics();
    }
  });

  const fetchStatistics = async () => {
    try {
      const token = await getToken();
      
      const response = await fetchRoomTips(roomId, token);

      console.log('Fetched tip statistics:', response);
      
      if (response.ok && response.data.success) {
        console.log('Fetched tip statistics response:', response);
        setStatistics(response.data.data);
        
        // Track the latest tip for notification purposes
        if (response.data.data.recentTips.length > 0) {
          const latestTip = response.data.data.recentTips[0];
          if (latestTip.id !== lastTipId) {
            setLastTipId(latestTip.id);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching tip statistics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial fetch and fallback polling every 5 minutes for sync
  // Primary updates happen via TIP_RECEIVED events for instant feedback
  useEffect(() => {
    fetchStatistics();
    
    // Long interval polling as fallback (in case events are missed)
    const interval = setInterval(() => {
      fetchStatistics();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [roomId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <RiLoader5Fill className="animate-spin text-fireside-orange" size={24} />
      </div>
    );
  }

  if (!statistics || statistics.totalTipsByUsers === 0) {
    return null;
  }

  const { totalTipsUSD, totalTipsByUsers, tipsByCurrency, recentTips } = statistics;

  return (
    <div className="w-full mt-4 mb-4 relative">
      <Card className="rounded-2xl overflow-visible shadow-none ">
        {/* Header - Always Visible */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full p-3 flex items-center justify-between hover:bg-white/5 transition-colors rounded-2xl"
        >
          <div className="flex items-center gap-3">
            {/* <CiMoneyBill className="text-fireside-orange text-2xl" /> */}
            <div className="text-left">
              <h3 className="text-fireside-orange font-bold text-md">Tips ({totalTipsByUsers})</h3>
              <p className="text-white/70 text-sm">
                ${totalTipsUSD.toFixed(2)}
              </p>
            </div>
          </div>
          <div className="text-fireside-orange">
            {isExpanded ? <IoChevronUp size={12} /> : <IoChevronDown size={12} />}
          </div>
        </button>

        {/* Expanded Content - Floating */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="absolute w-[86vw] backdrop-blur-xl top-full right-0 mt-2 z-50 gradient-orange-bg border border-fireside-orange/30 rounded-2xl shadow-2xl max-h-[500px] bg-neutral-orange/5 overflow-y-auto"
            >
              <div className="p-4 space-y-4">
            {/* Currency Breakdown */}
            <div>
              <h4 className="text-fireside-orange font-semibold mb-2">By Currency</h4>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(tipsByCurrency).map(([currency, data]) => {
                 
                  return (
                    <div key={currency} className="bg-neutral-orange/5 gradient-orange-bg border border-neutral-orange/10 rounded-xl p-2 relative">
                      <div className="flex items-center mb-2 gap-1 mb-1 justify-center">
                        {currency === 'ETH' && (
                          <img src="/ethereum.svg" alt="ETH" className="w-8 h-8" />
                        )}
                        {currency === 'USDC' && (
                          <img src="/usdc.svg" alt="USDC" className="w-8 h-8" />
                        )}
                        {currency === 'FIRE' && (
                          <img src="/fireside-logo.svg" alt="FIRE" className="w-8 h-8" />
                        )}
                        
                      </div>
                      <p className="text-white font-bold text-xs">${data.totalUSD.toFixed(2)}</p>
                      <p className="text-white/60 text-xs">
                        {data.totalNative.toFixed(currency === 'USDC' ? 2 : 4)} {currency}
                      </p>
                      <p className="text-white absolute bg-fireside-orange -top-3 right-0 font-bold rounded-full aspect-square w-4 text-xs text-center mt-2">{data.count}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recent Tips */}
            {recentTips.length > 0 && (
              <div>
                <h4 className="text-fireside-orange font-semibold mb-2">Recent Tips</h4>
                <div className="space-y-2 max-h-32 overflow-y-scroll">
                  {recentTips.map((tip) => {
                    const recipientDisplay = tip.recipients.length > 0
                      ? tip.recipients
                          .map((r) => r.username || r.role || 'Unknown')
                          .join(', ')
                      : 'Unknown';

                    return (
                      <div
                        key={tip.id}
                        className="bg-white/5 rounded-xl p-3 flex items-start gap-3"
                      >
                        <img
                          src={tip.tipper.pfp_url || '/default-avatar.png'}
                          alt={tip.tipper.username}
                          className="w-10 h-10 rounded-full"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm">
                            <span className="font-semibold">{tip.tipper.username}</span> tipped{' '}
                            <span className="font-semibold">{recipientDisplay}</span>
                          </p>
                          <div className='flex items-center justify-between'>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-fireside-orange font-bold text-sm">
                              ${tip.amount.usd.toFixed(2)}
                            </span>
                            <span className="text-white/60 text-xs">
                              ({tip.amount.native.toFixed(tip.amount.currency === 'USDC' ? 2 : 4)}{' '}
                              {tip.amount.currency})
                            </span>
                          </div>
                          <p className="text-white/50 text-xs mt-1">
                            {new Date(tip.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                          </div>
                          
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </div>
  );
}
