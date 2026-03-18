import { Elysia, t } from 'elysia';
import { authMiddleware } from '../middleware/auth';
import { errorResponse, successResponse } from '../utils';
import { RewardService } from '../services/rewards/RewardService';
import User from '../models/User';
import '../config/database';

export const rewardRoutes = new Elysia({ prefix: '/rewards' })
  .guard({
    beforeHandle: authMiddleware
  })
  .group('/protected', (app) =>
    app
      
      // Check daily login reward eligibility
      .get('/check-login-eligibility', async ({ headers, set }) => {
        try {
          const userFid = headers['x-user-privyid'] as string;
          if (!userFid) {
            set.status = 401;
            return errorResponse('Unauthorized');
          }

          const user = await User.findOne({ privyId: userFid });
          if (!user) {
            set.status = 404;
            return errorResponse('User not found');
          }

          const eligibility = await RewardService.checkDailyLoginEligibility(user._id);

          return successResponse({
            eligible: eligibility.eligible,
            rewardAmount: eligibility.rewardAmount,
            hoursRemaining: eligibility.hoursRemaining,
            message: eligibility.message,
          });
        } catch (error) {
          console.error('Error checking login eligibility:', error);
          set.status = 500;
          return errorResponse(
            error instanceof Error ? error.message : 'Failed to check eligibility'
          );
        }
      })

      // Claim daily login reward
      .post('/claim-login', async ({ headers, set }) => {
        try {
          const userFid = headers['x-user-privyid'] as string;
          if (!userFid) {
            set.status = 401;
            return errorResponse('Unauthorized');
          }

          const user = await User.findOne({ privyId: userFid });
          if (!user) {
            set.status = 404;
            return errorResponse('User not found');
          }

          const result = await RewardService.claimDailyLoginReward(user._id);

          return successResponse({
            message: 'Daily login reward claimed successfully',
            reward: result.reward,
          });
        } catch (error) {
          console.error('Error claiming login reward:', error);
          set.status = 400;
          return errorResponse(
            error instanceof Error ? error.message : 'Failed to claim reward'
          );
        }
      })

      // Get reward history
      .get('/history', async ({ headers, query, set }) => {
        try {
          const userFid = headers['x-user-privyid'] as string;
          if (!userFid) {
            set.status = 401;
            return errorResponse('Unauthorized');
          }

          const user = await User.findOne({ privyId: userFid });
          if (!user) {
            set.status = 404;
            return errorResponse('User not found');
          }

          const limit = query.limit ? parseInt(query.limit as string) : 50;
          const result = await RewardService.getRewardHistory(user._id, limit);

          return successResponse({
            rewards: result.rewards,
            summary: result.summary,
          });
        } catch (error) {
          console.error('Error fetching reward history:', error);
          set.status = 500;
          return errorResponse(
            error instanceof Error ? error.message : 'Failed to fetch reward history'
          );
        }
      })

      // Get wallet balance (admin/debug)
      .get('/wallet-balance', async ({ headers, set }) => {
        try {
          const userFid = headers['x-user-privyid'] as string;
          if (!userFid) {
            set.status = 401;
            return errorResponse('Unauthorized');
          }

          const balance = await RewardService.checkWalletBalance();

          return successResponse({
            balance: balance.balance,
            balanceWei: balance.balanceWei.toString(),
          });
        } catch (error) {
          console.error('Error checking wallet balance:', error);
          set.status = 500;
          return errorResponse(
            error instanceof Error ? error.message : 'Failed to check wallet balance'
          );
        }
      })
  );

export default rewardRoutes;
