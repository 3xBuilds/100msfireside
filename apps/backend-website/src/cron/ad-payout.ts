import { cron } from '@elysiajs/cron';
import connectDB from '../config/database';
import Room from '../models/Room';
import AdPayout from '../models/AdPayout';
import AdView from '../models/AdView';
import { adRevDistribute } from '../services/ads/adRevDistribute';

/**
 * Ad Payout Cron Job
 * Runs daily at 11:30 PM UTC to process payouts for all rooms that haven't been paid out
 */
export const adPayoutCron = cron({
  name: 'ad-payout',
  pattern: '30 23 * * *', // 11:30 PM UTC daily
  timezone: 'UTC',
  run: async () => {
    console.log('💰 [ad-payout] Cron started:', new Date().toISOString());
    await processUnpaidRooms();
  }
});

/**
 * Processes all rooms that:
 * 1. Have ended (status === 'ended' OR ended_at is set)
 * 2. Had ads enabled
 * 3. Don't have a completed/pending payout yet
 */
export async function processUnpaidRooms(): Promise<{
  processed: number;
  successful: number;
  skipped: number;
  failed: number;
  details: Array<{ roomId: string; status: string; message?: string }>;
}> {
  await connectDB();

  const results = {
    processed: 0,
    successful: 0,
    skipped: 0,
    failed: 0,
    details: [] as Array<{ roomId: string; status: string; message?: string }>
  };

  try {
    // Find rooms that have ended and had ads enabled
    const endedRooms = await Room.find({
      $or: [
        { status: 'ended' },
        { ended_at: { $ne: null } }
      ],
      adsEnabled: { $ne: false }
    }).select('_id');

    if (endedRooms.length === 0) {
      console.log('📊 [ad-payout] No ended rooms with ads enabled found');
      return results;
    }

    // Get rooms that already have completed or pending payouts
    const existingPayouts = await AdPayout.find({
      room: { $in: endedRooms.map((r: any) => r._id) },
      status: { $in: ['completed', 'pending'] }
    }).select('room');

    const paidRoomIds = new Set(existingPayouts.map((p: any) => p.room.toString()));
    const unpaidRooms = endedRooms.filter((r: any) => !paidRoomIds.has(r._id.toString()));

    console.log(`📊 [ad-payout] Found ${unpaidRooms.length} rooms needing payout (${endedRooms.length} total ended, ${existingPayouts.length} already paid)`);

    if (unpaidRooms.length === 0) {
      console.log('✅ [ad-payout] All eligible rooms already have payouts');
      return results;
    }

    // Process rooms sequentially (wallet nonce management requires this)
    for (const room of unpaidRooms) {
      const roomId = room._id.toString();
      results.processed++;

      // Check if room actually has ad views
      const viewCount = await AdView.countDocuments({ roomId });
      if (viewCount === 0) {
        console.log(`⏭️ [ad-payout] Skipping room ${roomId} - no ad views`);
        results.skipped++;
        results.details.push({ roomId, status: 'skipped', message: 'No ad views' });
        continue;
      }

      try {
        console.log(`💸 [ad-payout] Processing payout for room ${roomId} (${viewCount} views)`);
        const result = await adRevDistribute({ roomId });
        
        if (result.success) {
          console.log(`✅ [ad-payout] Room ${roomId} payout completed (source: ${result.source})`);
          results.successful++;
          results.details.push({ roomId, status: 'completed', message: result.message });
        } else {
          console.log(`⏭️ [ad-payout] Room ${roomId} payout skipped: ${result.message}`);
          results.skipped++;
          results.details.push({ roomId, status: result.source || 'skipped', message: result.message });
        }

        // Add delay between rooms to avoid rate limits on 0x API and blockchain
        await new Promise(resolve => setTimeout(resolve, 5000));
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error(`❌ [ad-payout] Payout failed for room ${roomId}:`, errorMessage);
        results.failed++;
        results.details.push({ roomId, status: 'failed', message: errorMessage });
        
        // Continue to next room - failed rooms will be manually handled
      }
    }

    console.log(`💰 [ad-payout] Cron completed - Processed: ${results.processed}, Successful: ${results.successful}, Skipped: ${results.skipped}, Failed: ${results.failed}`);
    return results;
  } catch (err) {
    console.error('❌ [ad-payout] Critical error in cron job:', err);
    throw err;
  }
}

/**
 * Manual trigger functions for testing and admin purposes
 */
export const manualAdPayoutTriggers = {
  /**
   * Manually trigger processing of all unpaid rooms
   */
  processAllUnpaid: processUnpaidRooms,

  /**
   * Manually trigger payout for a specific room
   */
  processRoom: async (roomId: string, triggeredByFid?: string, triggeredByUserId?: string) => {
    return adRevDistribute({ roomId, triggeredByFid, triggeredByUserId });
  }
};

