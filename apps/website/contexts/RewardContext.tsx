'use client'

import { createContext, useContext, useState, ReactNode } from 'react';

interface RewardData {
  totalReward: number;
  baseReward: number;
  milestoneReward: number;
  milestone?: number;
  participantCount: number;
}

interface RewardContextType {
  rewardData: RewardData | null;
  setRewardData: (data: RewardData | null) => void;
  clearRewardData: () => void;
}

const RewardContext = createContext<RewardContextType | undefined>(undefined);

export function RewardProvider({ children }: { children: ReactNode }) {
  const [rewardData, setRewardData] = useState<RewardData | null>(null);

  const clearRewardData = () => {
    setRewardData(null);
  };

  return (
    <RewardContext.Provider value={{ rewardData, setRewardData, clearRewardData }}>
      {children}
    </RewardContext.Provider>
  );
}

export function useRewardContext() {
  const context = useContext(RewardContext);
  if (context === undefined) {
    throw new Error('useRewardContext must be used within a RewardProvider');
  }
  return context;
}
