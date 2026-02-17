import { ethers } from "ethers";
import { Types } from "mongoose";
import config from "../../config";
import connectDB from "../../config/database";
import Reward from "../../models/Reward";
import User from "../../models/User";
import Room from "../../models/Room";
import RoomParticipant from "../../models/RoomParticipant";
import { erc20Abi } from "../../utils/contracts/erc20abi";
import { contractAdds, BASE_CHAIN_ID } from "../../utils/contracts/contractAdds";
import { getCachedTokenPrice, calculateTokenAmount } from "../../utils/token-price";
import { RedisUtils } from "../redis/redis-utils";

export interface DailyLoginEligibility {
  eligible: boolean;
  hoursRemaining?: number;
  rewardAmount?: number;
  message?: string;
}

export interface HostingReward {
  baseReward: number;
  milestoneReward: number;
  totalReward: number;
  milestone?: number;
  participantCount: number;
}

export class RewardService {
  private static provider: ethers.JsonRpcProvider;
  private static wallet: ethers.Wallet;
  
  // Circuit breaker state
  private static circuitBreakerOpen = false;
  private static circuitBreakerOpenedAt: Date | null = null;
  private static consecutiveFailures = 0;
  private static readonly CIRCUIT_BREAKER_THRESHOLD = 3;
  private static readonly CIRCUIT_BREAKER_RESET_MS = 60000; // 1 minute
  private static readonly MAX_RETRIES = 2;
  private static readonly RETRY_DELAY_MS = 2000;

  private static initializeWeb3() {
    if (!this.provider) {
      this.provider = new ethers.JsonRpcProvider(
        "https://base-mainnet.g.alchemy.com/v2/CA4eh0FjTxMenSW3QxTpJ7D-vWMSHVjq",
        undefined,
        { staticNetwork: true, batchMaxCount: 1 }
      );
    }
    if (!this.wallet) {
      this.wallet = new ethers.Wallet(
        config.rewardWalletPrivateKey,
        this.provider
      );
      console.log('🎁 Reward wallet initialized:', this.wallet.address);
    }
  }
  
  private static isCircuitBreakerOpen(): boolean {
    if (!this.circuitBreakerOpen) return false;
    
    // Check if circuit breaker should reset
    if (this.circuitBreakerOpenedAt) {
      const elapsed = Date.now() - this.circuitBreakerOpenedAt.getTime();
      if (elapsed >= this.CIRCUIT_BREAKER_RESET_MS) {
        console.log('🔄 Circuit breaker reset after timeout');
        this.circuitBreakerOpen = false;
        this.circuitBreakerOpenedAt = null;
        this.consecutiveFailures = 0;
        return false;
      }
    }
    return true;
  }
  
  private static recordFailure(): void {
    this.consecutiveFailures++;
    if (this.consecutiveFailures >= this.CIRCUIT_BREAKER_THRESHOLD) {
      this.circuitBreakerOpen = true;
      this.circuitBreakerOpenedAt = new Date();
      console.error(`🔴 Circuit breaker OPEN after ${this.consecutiveFailures} consecutive failures`);
    }
  }
  
  private static recordSuccess(): void {
    this.consecutiveFailures = 0;
  }
  
  private static isRateLimitError(error: any): boolean {
    const errorMsg = error?.message || error?.toString() || '';
    return errorMsg.includes('429') || 
           errorMsg.includes('rate limit') || 
           errorMsg.includes('too many requests') ||
           errorMsg.includes('RATE_LIMIT') ||
           error?.code === 429;
  }
  
  private static async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if a user is eligible for daily login reward
   */
  static async checkDailyLoginEligibility(userId: string | Types.ObjectId): Promise<DailyLoginEligibility> {
    try {
      await connectDB();

      const user = await User.findById(userId);
      if (!user) {
        return { eligible: false, message: 'User not found' };
      }

      const now = new Date();
      const lastClaimDate = user.lastLoginRewardClaimDate;

      if (!lastClaimDate) {
        return {
          eligible: true,
          rewardAmount: config.dailyLoginRewardAmount,
          message: 'First time claim available'
        };
      }

      const hoursSinceLastClaim = (now.getTime() - lastClaimDate.getTime()) / (1000 * 60 * 60);

      if (hoursSinceLastClaim >= 24) {
        return {
          eligible: true,
          rewardAmount: config.dailyLoginRewardAmount,
          message: 'Daily reward available'
        };
      }

      const hoursRemaining = Math.ceil(24 - hoursSinceLastClaim);
      return {
        eligible: false,
        hoursRemaining,
        message: `Next reward available in ${hoursRemaining} hours`
      };
    } catch (error) {
      console.error('❌ Error checking login eligibility:', error);
      throw error;
    }
  }

  /**
   * Claim daily login reward
   */
  static async claimDailyLoginReward(userId: string | Types.ObjectId): Promise<any> {
    const lockKey = `reward:login:${userId}`;
    let lockAcquired = false;

    try {
      await connectDB();

      // Acquire distributed lock to prevent double claims
      lockAcquired = await RedisUtils.acquireLock(lockKey, 30);
      if (!lockAcquired) {
        throw new Error('Another claim is in progress. Please try again.');
      }

      const eligibility = await this.checkDailyLoginEligibility(userId);
      if (!eligibility.eligible) {
        throw new Error(eligibility.message || 'Not eligible for reward');
      }

      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Calculate token amount based on USD value
      let rewardAmount: number;
      try {
        const tokenPrice = await getCachedTokenPrice(contractAdds.fireToken);
        rewardAmount = calculateTokenAmount(config.dailyLoginRewardUSD, tokenPrice);
        console.log(`💰 Daily login reward: $${config.dailyLoginRewardUSD} = ${rewardAmount} FIRE (price: $${tokenPrice})`);
      } catch (priceError) {
        console.warn('⚠️ Failed to fetch token price, using fallback amount:', priceError);
        rewardAmount = config.dailyLoginRewardAmount;
      }

      // Create pending reward record
      const reward = await Reward.create({
        userId: user._id,
        type: 'daily_login',
        amount: rewardAmount,
        currency: 'FIRE',
        status: 'pending',
        metadata: {},
      });

      // Distribute tokens
      const txHash = await this.transferTokens(
        user.wallet,
        rewardAmount
      );

      // Update reward record
      reward.status = 'completed';
      reward.txHash = txHash;
      reward.claimedAt = new Date();
      reward.distributedAt = new Date();
      await reward.save();

      // Update user record
      user.lastLoginRewardClaimDate = new Date();
      user.rewards = user.rewards || {};
      user.rewards.totalEarned = (user.rewards.totalEarned || 0) + rewardAmount;
      user.rewards.lastRewardAt = new Date();
      await user.save();

      console.log(`✅ Daily login reward distributed to ${user.username}: ${rewardAmount} FIRE (tx: ${txHash})`);

      return {
        success: true,
        reward: {
          id: reward._id,
          amount: reward.amount,
          currency: reward.currency,
          txHash: reward.txHash,
          claimedAt: reward.claimedAt,
        }
      };
    } catch (error) {
      console.error('❌ Error claiming daily login reward:', error);
      throw error;
    } finally {
      if (lockAcquired) {
        await RedisUtils.releaseLock(lockKey);
      }
    }
  }

  /**
   * Calculate hosting rewards based on participant count and room duration
   */
  static async calculateHostingRewards(participantCount: number, durationMinutes: number): Promise<HostingReward> {
    let baseReward: number;
    let milestoneReward: number;
    
    try {
      const tokenPrice = await getCachedTokenPrice(contractAdds.fireToken);
      
      // Calculate base reward from USD value
      baseReward = calculateTokenAmount(config.hostRoomBaseRewardUSD, tokenPrice);
      
      // Find highest milestone achieved from USD-based milestones
      const achievedMilestone = config.participantMilestonesUSD
        .filter(m => participantCount >= m.threshold)
        .sort((a, b) => b.threshold - a.threshold)[0];

      milestoneReward = achievedMilestone 
        ? calculateTokenAmount(achievedMilestone.rewardUSD, tokenPrice)
        : 0;
        
      console.log(`💰 Hosting rewards calculated: Base $${config.hostRoomBaseRewardUSD} = ${baseReward} FIRE, Milestone $${achievedMilestone?.rewardUSD || 0} = ${milestoneReward} FIRE (price: $${tokenPrice})`);
      
      return {
        baseReward,
        milestoneReward,
        totalReward: baseReward + milestoneReward,
        milestone: achievedMilestone?.threshold,
        participantCount,
      };
    } catch (priceError) {
      console.warn('⚠️ Failed to fetch token price, using fallback amounts:', priceError);
      
      // Fallback to old token-based calculation
      baseReward = config.hostRoomBaseRewardAmount;
      
      const achievedMilestone = config.participantMilestones
        .filter(m => participantCount >= m.threshold)
        .sort((a, b) => b.threshold - a.threshold)[0];

      milestoneReward = achievedMilestone?.reward || 0;
      
      return {
        baseReward,
        milestoneReward,
        totalReward: baseReward + milestoneReward,
        milestone: achievedMilestone?.threshold,
        participantCount,
      };
    }
  }

  /**
   * Distribute hosting rewards after room ends
   */
  static async distributeHostingRewards(roomId: string | Types.ObjectId): Promise<any> {
    try {
      await connectDB();

      const room = await Room.findById(roomId).populate('host');
      if (!room) {
        throw new Error('Room not found');
      }

      // Get participant count
      const participants = await RoomParticipant.find({ roomId: room._id });
      const uniqueParticipants = new Set(participants.map(p => p.userId.toString()));
      const participantCount = uniqueParticipants.size;

      // Calculate room duration
      const startTime = new Date(room.startTime);
      const endTime = room.ended_at || new Date();
      const durationMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);

      const host = room.host as any;
      if (!host || !host.wallet) {
        throw new Error('Host wallet not found');
      }

      // Check if host already received base hosting reward today
      const now = new Date();
      const lastHostingRewardDate = host.lastHostingRewardDate;
      let eligibleForBaseReward = true;
      
      if (lastHostingRewardDate) {
        const hoursSinceLastReward = (now.getTime() - lastHostingRewardDate.getTime()) / (1000 * 60 * 60);
        eligibleForBaseReward = hoursSinceLastReward >= 24;
      }

      // Calculate rewards based on eligibility
      const rewardCalc = await this.calculateHostingRewards(participantCount, durationMinutes);
      
      // Determine actual reward amount
      let actualRewardAmount: number;
      let rewardType: 'host_room' | 'participant_milestone';
      
      if (eligibleForBaseReward) {
        // First room of the day: give base + milestone rewards
        actualRewardAmount = rewardCalc.totalReward;
        rewardType = 'host_room';
        console.log(`✅ Host eligible for full hosting reward (first room today): ${actualRewardAmount} FIRE`);
      } else {
        // Additional room today: only milestone rewards
        actualRewardAmount = rewardCalc.milestoneReward;
        rewardType = 'participant_milestone';
        console.log(`ℹ️ Host already claimed base reward today, only milestone reward: ${actualRewardAmount} FIRE`);
      }

      if (actualRewardAmount === 0) {
        console.log(`ℹ️ No rewards for room ${roomId} (no milestones or already claimed today)`);
        return { 
          success: true, 
          message: eligibleForBaseReward ? 'No milestones achieved' : 'Only milestone rewards available, none achieved',
          rewardCalc: {
            ...rewardCalc,
            actualReward: 0,
            eligibleForBaseReward
          }
        };
      }

      // Create reward record
      const reward = await Reward.create({
        userId: host._id,
        type: rewardType,
        amount: actualRewardAmount,
        currency: 'FIRE',
        status: 'pending',
        metadata: {
          roomId: room._id,
          participantCount,
          roomDuration: durationMinutes,
          milestone: rewardCalc.milestone,
        },
      });

      // Distribute tokens
      const txHash = await this.transferTokens(host.wallet, actualRewardAmount);

      // Update reward record
      reward.status = 'completed';
      reward.txHash = txHash;
      reward.distributedAt = new Date();
      await reward.save();

      // Update user hosting stats
      host.hostingStats = host.hostingStats || {};
      host.hostingStats.totalRoomsHosted = (host.hostingStats.totalRoomsHosted || 0) + 1;
      host.hostingStats.totalParticipantsEngaged = (host.hostingStats.totalParticipantsEngaged || 0) + participantCount;
      host.hostingStats.lastRoomId = room._id;
      
      host.rewards = host.rewards || {};
      host.rewards.totalEarned = (host.rewards.totalEarned || 0) + actualRewardAmount;
      host.rewards.lastRewardAt = new Date();
      
      // Only update lastHostingRewardDate if base reward was given
      if (eligibleForBaseReward) {
        host.lastHostingRewardDate = new Date();
      }
      
      await host.save();

      console.log(`✅ Hosting rewards distributed to ${host.username}: ${actualRewardAmount} FIRE (tx: ${txHash})`);
      console.log(`   Base: ${eligibleForBaseReward ? rewardCalc.baseReward : 0}, Milestone: ${rewardCalc.milestoneReward}, Participants: ${participantCount}`);
      console.log(`   Reward Type: ${rewardType}, Eligible for base: ${eligibleForBaseReward}`);

      return {
        success: true,
        reward: {
          id: reward._id,
          amount: reward.amount,
          currency: reward.currency,
          txHash: reward.txHash,
          distributedAt: reward.distributedAt,
          breakdown: {
            ...rewardCalc,
            actualReward: actualRewardAmount,
            eligibleForBaseReward,
            rewardType
          },
        }
      };
    } catch (error) {
      console.error('❌ Error distributing hosting rewards:', error);
      
      // Try to mark reward as failed if it exists
      const failedReward = await Reward.findOne({ 
        'metadata.roomId': roomId, 
        type: 'host_room',
        status: 'pending' 
      });
      
      if (failedReward) {
        failedReward.status = 'failed';
        failedReward.errorMessage = error instanceof Error ? error.message : String(error);
        await failedReward.save();
      }
      
      throw error;
    }
  }

  /**
   * Get reward history for a user
   */
  static async getRewardHistory(userId: string | Types.ObjectId, limit: number = 50): Promise<any> {
    try {
      await connectDB();

      const rewards = await Reward.find({ userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('metadata.roomId', 'name startTime')
        .lean();

      const user = await User.findById(userId).select('rewards');

      return {
        rewards,
        summary: user?.rewards || { totalEarned: 0, pendingBalance: 0, lastRewardAt: null },
      };
    } catch (error) {
      console.error('❌ Error fetching reward history:', error);
      throw error;
    }
  }

  /**
   * Transfer ERC20 tokens to recipient
   */
  private static async transferTokens(recipientAddress: string, amount: number): Promise<string> {
    // Check circuit breaker first
    if (this.isCircuitBreakerOpen()) {
      throw new Error('Token transfer service temporarily unavailable (circuit breaker open)');
    }
    
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          const delay = this.RETRY_DELAY_MS * Math.pow(2, attempt - 1);
          console.log(`⏳ Retry attempt ${attempt}/${this.MAX_RETRIES} after ${delay}ms delay...`);
          await this.sleep(delay);
        }
        
        this.initializeWeb3();

        const tokenContract = new ethers.Contract(
          contractAdds.fireToken,
          erc20Abi,
          this.wallet
        );

        // Convert amount to wei (FIRE has 18 decimals)
        const amountWei = ethers.parseUnits(amount.toString(), 18);

        console.log(`💸 Transferring ${amount} FIRE to ${recipientAddress}... (attempt ${attempt + 1})`);

        // Get current nonce to prevent nonce issues
        const nonce = await this.wallet.getNonce();
        
        // Execute transfer with explicit nonce and gas settings
        const tx = await tokenContract.transfer(recipientAddress, amountWei, {
          nonce,
          gasLimit: 100000n, // Set explicit gas limit to prevent estimation calls
        });
        console.log('⏳ Transaction sent:', tx.hash);

        // Wait for confirmation with timeout
        const receipt = await Promise.race([
          tx.wait(1), // Wait for 1 confirmation
          this.sleep(60000).then(() => { throw new Error('Transaction confirmation timeout'); })
        ]);
        
        if (!receipt || !receipt.hash) {
          throw new Error('Transaction failed - no receipt');
        }
        
        console.log('✅ Transaction confirmed:', receipt.hash);
        this.recordSuccess();
        return receipt.hash;
        
      } catch (error: any) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`❌ Token transfer attempt ${attempt + 1} failed:`, lastError.message);
        
        // If it's a rate limit error, don't retry - open circuit breaker
        if (this.isRateLimitError(error)) {
          console.error('🚨 Rate limit detected - opening circuit breaker immediately');
          this.consecutiveFailures = this.CIRCUIT_BREAKER_THRESHOLD;
          this.recordFailure();
          throw new Error(`Token transfer failed due to rate limiting: ${lastError.message}`);
        }
        
        // For nonce errors, don't retry with same nonce
        const errorMsg = lastError.message.toLowerCase();
        if (errorMsg.includes('nonce') || errorMsg.includes('replacement transaction')) {
          console.error('🚨 Nonce conflict detected - aborting to prevent duplicate transactions');
          this.recordFailure();
          throw new Error(`Token transfer failed due to nonce conflict: ${lastError.message}`);
        }
      }
    }
    
    // All retries exhausted
    this.recordFailure();
    throw new Error(`Token transfer failed after ${this.MAX_RETRIES + 1} attempts: ${lastError?.message}`);
  }

  /**
   * Check wallet balance
   */
  static async checkWalletBalance(): Promise<{ balance: string; balanceWei: bigint }> {
    try {
      this.initializeWeb3();

      const tokenContract = new ethers.Contract(
        contractAdds.fireToken,
        erc20Abi,
        this.provider
      );

      const balance = await tokenContract.balanceOf(this.wallet.address);
      const balanceFormatted = ethers.formatUnits(balance, 18);

      return {
        balance: balanceFormatted,
        balanceWei: balance,
      };
    } catch (error) {
      console.error('❌ Error checking wallet balance:', error);
      throw error;
    }
  }
}

export default RewardService;
