import { cron } from '@elysiajs/cron';
import { RoomCleanupService } from './room-cleanup';
import { processWebhookRetries, reapExpiredReservations } from './webhook-retry';
import { adPayoutCron, manualAdPayoutTriggers, processUnpaidRooms } from './ad-payout';

/**
 * Room Cleanup Cron Job
 * Runs every 15 minutes to check for empty rooms and delete those empty for 24+ hours
 */
export const roomCleanupCron = cron({
  name: 'room-cleanup',
  pattern: '*/15 * * * *', // Every 15 minutes
  timezone: 'UTC',
  run: async () => {
    console.log('🕐 Room cleanup cron job triggered at:', new Date().toISOString());
    await RoomCleanupService.cleanupEmptyRooms();
  }
});

/**
 * Webhook Retry Processor
 * Runs every minute to deliver scheduled webhook retries
 */
export const webhookRetryCron = cron({
  name: 'webhook-retry',
  pattern: '*/1 * * * *', // Every minute
  timezone: 'UTC',
  run: async () => {
    try {
      await processWebhookRetries();
      await reapExpiredReservations();
    } catch (e) {
      console.error('Webhook retry cron error:', e);
    }
  }
});

// Re-export ad payout cron
export { adPayoutCron };

/**
 * Manual trigger functions for testing and admin purposes
 */
export const manualTriggers = {
  /**
   * Manually trigger room cleanup
   */
  triggerRoomCleanup: async () => {
    console.log('🔧 Manual room cleanup triggered');
    await RoomCleanupService.cleanupEmptyRooms();
  },

  /**
   * Manually trigger ad payout processing for all unpaid rooms
   */
  triggerAdPayout: async () => {
    console.log('🔧 Manual ad payout triggered');
    return processUnpaidRooms();
  },

  /**
   * Ad payout utilities
   */
  adPayout: manualAdPayoutTriggers
};
