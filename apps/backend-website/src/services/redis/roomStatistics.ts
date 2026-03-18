import { RedisUtils } from './redis-utils';
import { RedisRoomParticipantsService } from './room-participants';

/**
 * Room statistics structure
 */
export interface RoomStatistics {
  maxSpeakers: number;
  maxListeners: number;
  lastUpdated: string;
}

/**
 * Redis service for tracking room statistics (peak participant counts)
 */
export class RedisRoomStatisticsService {
  private static readonly TTL_DAYS = 1;
  private static readonly TTL = RedisRoomStatisticsService.TTL_DAYS * 24 * 60 * 60; // 24 hours in seconds

  static statsKeys = {
    maxSpeakers: (roomId: string) => `room:${roomId}:stats:max_speakers`,
    maxListeners: (roomId: string) => `room:${roomId}:stats:max_listeners`,
    lastUpdated: (roomId: string) => `room:${roomId}:stats:last_updated`,
  };

  /**
   * Update peak participant counts based on current room state
   * This should be called whenever participants join, leave, or change roles
   */
  static async updatePeakCounts(roomId: string): Promise<void> {
    try {
      const client = await RedisUtils.getClient();
      
      // Get current participant counts grouped by role
      const currentCounts = await RedisRoomParticipantsService.getParticipantCount(roomId, 'grouped') as Record<string, number>;
      
      // Calculate current speakers (host + co-host + speaker roles)
      const currentSpeakers = 
        (currentCounts['host'] || 0) + 
        (currentCounts['co-host'] || 0) + 
        (currentCounts['speaker'] || 0);
      
      // Calculate current listeners
      const currentListeners = currentCounts['listener'] || 0;

      const pipeline = client.pipeline();

      // Update max speakers if current is higher
      const maxSpeakersKey = this.statsKeys.maxSpeakers(roomId);
      const currentMaxSpeakers = await client.get(maxSpeakersKey);
      const maxSpeakers = currentMaxSpeakers ? parseInt(currentMaxSpeakers, 10) : 0;
      
      if (currentSpeakers > maxSpeakers) {
        pipeline.set(maxSpeakersKey, currentSpeakers.toString(), 'EX', this.TTL);
      }

      // Update max listeners if current is higher
      const maxListenersKey = this.statsKeys.maxListeners(roomId);
      const currentMaxListeners = await client.get(maxListenersKey);
      const maxListeners = currentMaxListeners ? parseInt(currentMaxListeners, 10) : 0;
      
      if (currentListeners > maxListeners) {
        pipeline.set(maxListenersKey, currentListeners.toString(), 'EX', this.TTL);
      }

      // Update last updated timestamp
      const lastUpdatedKey = this.statsKeys.lastUpdated(roomId);
      pipeline.set(lastUpdatedKey, new Date().toISOString(), 'EX', this.TTL);

      await RedisUtils.executePipeline(pipeline);
    } catch (error) {
      console.error('[RedisRoomStatisticsService] Error updating peak counts:', error);
      // Don't throw - this is a non-critical operation
    }
  }

  /**
   * Get room statistics (peak counts)
   */
  static async getRoomStatistics(roomId: string): Promise<RoomStatistics> {
    try {
      const client = await RedisUtils.getClient();
      const pipeline = client.pipeline();

      const maxSpeakersKey = this.statsKeys.maxSpeakers(roomId);
      const maxListenersKey = this.statsKeys.maxListeners(roomId);
      const lastUpdatedKey = this.statsKeys.lastUpdated(roomId);

      pipeline.get(maxSpeakersKey);
      pipeline.get(maxListenersKey);
      pipeline.get(lastUpdatedKey);

      const results = await RedisUtils.executePipeline(pipeline);

      const maxSpeakers = results[0][1] ? parseInt(results[0][1], 10) : 0;
      const maxListeners = results[1][1] ? parseInt(results[1][1], 10) : 0;
      const lastUpdated = results[2][1] || new Date().toISOString();

      return {
        maxSpeakers,
        maxListeners,
        lastUpdated,
      };
    } catch (error) {
      console.error('[RedisRoomStatisticsService] Error getting room statistics:', error);
      // Return default values on error
      return {
        maxSpeakers: 0,
        maxListeners: 0,
        lastUpdated: new Date().toISOString(),
      };
    }
  }

  /**
   * Delete room statistics (cleanup utility)
   */
  static async deleteRoomStatistics(roomId: string): Promise<void> {
    try {
      const client = await RedisUtils.getClient();
      const pipeline = client.pipeline();

      pipeline.del(this.statsKeys.maxSpeakers(roomId));
      pipeline.del(this.statsKeys.maxListeners(roomId));
      pipeline.del(this.statsKeys.lastUpdated(roomId));

      await RedisUtils.executePipeline(pipeline);
    } catch (error) {
      console.error('[RedisRoomStatisticsService] Error deleting room statistics:', error);
    }
  }

  /**
   * Initialize peak counts for a new room (optional helper)
   * Sets initial values to 0 to ensure keys exist
   */
  static async initializeRoomStatistics(roomId: string): Promise<void> {
    try {
      const client = await RedisUtils.getClient();
      const pipeline = client.pipeline();

      pipeline.set(this.statsKeys.maxSpeakers(roomId), '0', 'EX', this.TTL);
      pipeline.set(this.statsKeys.maxListeners(roomId), '0', 'EX', this.TTL);
      pipeline.set(this.statsKeys.lastUpdated(roomId), new Date().toISOString(), 'EX', this.TTL);

      await RedisUtils.executePipeline(pipeline);
    } catch (error) {
      console.error('[RedisRoomStatisticsService] Error initializing room statistics:', error);
    }
  }
}
