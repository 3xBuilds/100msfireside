"use client";

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { getAuthToken } from "@/utils/auth";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from './UI/drawer';
import Button from './UI/Button';
import { checkLoginEligibility, claimLoginReward } from '@/utils/serverActions';
import { contractAdds } from '@/utils/contract/contractAdds';

const fetchTokenPrice = async (contractAddress: string): Promise<number> => {
  try {
    const apiUrl = `https://api.dexscreener.com/tokens/v1/base/${contractAddress}`;
    const response = await fetch(apiUrl);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const usableResponse = await response.json();
    
    if (!usableResponse || !Array.isArray(usableResponse) || usableResponse.length === 0) {
      throw new Error('No price data available for this token');
    }

    const priceUsd = Number(usableResponse[0].priceUsd);
    
    if (isNaN(priceUsd)) {
      throw new Error('Invalid price data received');
    }

    return priceUsd;
  } catch (error) {
    console.error("Error fetching token price:", error);
    throw error;
  }
};

interface EligibilityData {
  eligible: boolean;
  rewardAmount?: number;
  hoursRemaining?: number;
  message?: string;
}

interface RewardData {
  id: string;
  amount: number;
  currency: string;
  txHash: string;
  claimedAt: string;
}

export function RewardClaimDrawer() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [eligibility, setEligibility] = useState<EligibilityData | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState(false);
  const [rewardData, setRewardData] = useState<RewardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [calculatedFireAmount, setCalculatedFireAmount] = useState<number | null>(null);

  const checkEligibility = async () => {
    try {
      console.log('[RewardClaimDrawer] Checking eligibility...');
      setIsChecking(true);
      const token = getAuthToken();
      const response = await checkLoginEligibility(token);

      console.log('[RewardClaimDrawer] Response status:', response.status);

      if (!response.ok) {
        console.error('[RewardClaimDrawer] Failed to check eligibility:', response.status);
        setIsChecking(false);
        return;
      }

      const result = response.data;
      console.log('[RewardClaimDrawer] Eligibility result:', result);
      
      if (result.success && result.data) {
        setEligibility(result.data);
        console.log('[RewardClaimDrawer] Eligibility data:', result.data);
        
        // Fetch FIRE token price and calculate actual amount for $0.01
        if (result.data.eligible) {
          try {
            const firePrice = await fetchTokenPrice(contractAdds.fireToken);
            const fireAmount = 0.01 / firePrice; // $0.01 worth of FIRE
            setCalculatedFireAmount(fireAmount);
            console.log('[RewardClaimDrawer] FIRE price:', firePrice, 'Amount:', fireAmount);
          } catch (priceError) {
            console.error('[RewardClaimDrawer] Error fetching FIRE price:', priceError);
          }
        }
        
        // Auto-open drawer if eligible
        if (result.data.eligible) {
          console.log('[RewardClaimDrawer] Opening drawer - user is eligible!');
          setIsOpen(true);
        } else {
          console.log('[RewardClaimDrawer] User not eligible:', result.data.message);
        }
      }
      setIsChecking(false);
    } catch (err) {
      console.error('[RewardClaimDrawer] Error checking eligibility:', err);
      setIsChecking(false);
    }
  };

  useEffect(() => {
    // Only check eligibility if on home page
    if (pathname !== '/') {
      setIsOpen(false);
      return;
    }

    // Check eligibility when component mounts
    checkEligibility();

    // Optionally check periodically (every 5 minutes)
    const interval = setInterval(checkEligibility, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [pathname]);

  const handleClaim = async () => {
    setIsClaiming(true);
    setError(null);

    try {
      const token = getAuthToken();
      const response = await claimLoginReward(token);

      const result = response.data;

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to claim reward');
      }

      setRewardData(result.data.reward);
      setClaimSuccess(true);
      
      // Update eligibility to mark as claimed
      setEligibility({
        eligible: false,
        message: 'Reward claimed! Come back in 24 hours.',
      });

      // Close drawer after 3 seconds
      setTimeout(() => {
        setIsOpen(false);
        setClaimSuccess(false);
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to claim reward');
    } finally {
      setIsClaiming(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setClaimSuccess(false);
    setError(null);
  };

  // Render the drawer (will show when isOpen is true)
  return (
    <Drawer open={isOpen} onOpenChange={setIsOpen}>
      <DrawerContent className="max-w-md mx-auto gradient-yellow-bg bg-black/95">
        <DrawerHeader>
          <DrawerTitle className="text-2xl font-bold text-center text-white">
            {claimSuccess ? '🎉 Reward Claimed!' : '🎁 Daily Login Reward'}
          </DrawerTitle>
          <DrawerDescription className="text-center mt-2">
            {claimSuccess 
              ? `You've earned ${rewardData?.amount} ${rewardData?.currency} tokens!`
              : eligibility?.eligible 
                ? `Claim your daily reward of ${calculatedFireAmount ? calculatedFireAmount.toFixed(2) : '...'} FIRE tokens ($0.01)`
                : eligibility?.message || 'Check back later for your next reward'
            }
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-6 py-4">
          {claimSuccess && rewardData ? (
            <div className="space-y-3">
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                <p className="text-center text-green-400 font-semibold">
                  {rewardData.amount} {rewardData.currency}
                </p>
                <p className="text-center text-sm text-gray-400 mt-1">
                  Transferred to your wallet
                </p>
              </div>
              {rewardData.txHash && (
                <a
                  href={`https://basescan.org/tx/${rewardData.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center text-sm text-blue-400 hover:text-blue-300 underline"
                >
                  View transaction ↗
                </a>
              )}
            </div>
          ) : eligibility?.eligible ? (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-lg p-6 text-center">
                <p className="text-4xl font-bold text-yellow-400">
                  {calculatedFireAmount ? calculatedFireAmount.toFixed(2) : '...'}
                </p>
                <p className="text-sm text-gray-300 mt-1">FIRE Tokens ($0.01)</p>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                  <p className="text-sm text-red-400 text-center">{error}</p>
                </div>
              )}

              <Button
                onClick={handleClaim}
                disabled={isClaiming}
                className="w-full bg-gradient-to-r from-neutral-yellow to-neutral-orange text-white font-semibold py-3 px-6 rounded-lg hover:from-yellow-600 hover:to-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isClaiming ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Claiming...
                  </span>
                ) : (
                  'Claim Reward'
                )}
              </Button>
            </div>
          ) : (
            <div className="bg-gray-500/10 border border-gray-500/30 rounded-lg p-6 text-center">
              <p className="text-gray-400">
                {eligibility?.hoursRemaining 
                  ? `Next reward available in ${eligibility.hoursRemaining} hours`
                  : eligibility?.message || 'Loading...'
                }
              </p>
            </div>
          )}
        </div>

        {/* <DrawerFooter>
          <DrawerClose asChild>
            <button
              onClick={handleClose}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              {claimSuccess ? 'Close' : 'Maybe Later'}
            </button>
          </DrawerClose>
        </DrawerFooter> */}
      </DrawerContent>
    </Drawer>
  );
}

export default RewardClaimDrawer;
