import { RedisUtils } from './redis-utils';

/**
 * Tip record structure stored in Redis
 */
export interface TipRecord {
  id: string;
  roomId: string;
  timestamp: string;
  tipper: {
    userId: string;
    username: string;
    pfp_url: string;
  };
  recipients: Array<{
    userId?: string;
    username?: string;
    pfp_url?: string;
    role?: string;
  }>;
  amount: {
    usd: number;
    currency: string;
    native: number;
  };
}

/**
 * Aggregated tip statistics for a room
 */
export interface TipStatistics {
  totalTipsUSD: number;
  totalTipsByUsers: number;
  tipsByCurrency: {
    ETH: { count: number; totalUSD: number; totalNative: number };
    USDC: { count: number; totalUSD: number; totalNative: number };
    FIRE: { count: number; totalUSD: number; totalNative: number };
  };
  recentTips: TipRecord[];
  allTips: TipRecord[];
}

/**
 * Redis service for managing tip records
 */
export class RedisTippingService {
  private static readonly TTL_DAYS = 7;
  private static readonly TTL = RedisTippingService.TTL_DAYS * 24 * 60 * 60; // 7 days in seconds

  static tipKeys = {
    roomTips: (roomId: string) => `room:${roomId}:tips`,
    tipRecord: (roomId: string, tipId: string) => `room:${roomId}:tip:${tipId}`,
  };

  /**
   * Add a new tip record to Redis
   */
  static async addTipRecord(tipRecord: TipRecord): Promise<void> {
    const client = await RedisUtils.getClient();
    const pipeline = client.pipeline();

    const tipKey = this.tipKeys.tipRecord(tipRecord.roomId, tipRecord.id);
    const roomTipsKey = this.tipKeys.roomTips(tipRecord.roomId);

    // Store individual tip record as JSON
    pipeline.set(tipKey, JSON.stringify(tipRecord), 'EX', this.TTL);

    // Add tip ID to sorted set (score = timestamp for chronological ordering)
    const timestamp = new Date(tipRecord.timestamp).getTime();
    pipeline.zadd(roomTipsKey, timestamp, tipRecord.id);

    // Set expiry on the sorted set
    pipeline.expire(roomTipsKey, this.TTL);

    await RedisUtils.executePipeline(pipeline);
  }

  /**
   * Get recent tips for a room (limit to most recent N tips)
   */
  static async getRecentTips(roomId: string, limit: number = 5): Promise<TipRecord[]> {
    const client = await RedisUtils.getClient();
    const roomTipsKey = this.tipKeys.roomTips(roomId);

    // Get the most recent tip IDs (reverse chronological order)
    const tipIds = await client.zrevrange(roomTipsKey, 0, limit - 1);

    if (tipIds.length === 0) {
      return [];
    }

    // Fetch all tip records in parallel
    const pipeline = client.pipeline();
    tipIds.forEach((tipId: string) => {
      const tipKey = this.tipKeys.tipRecord(roomId, tipId);
      pipeline.get(tipKey);
    });

    const results = await RedisUtils.executePipeline(pipeline);

    // Parse and return tip records
    return results
      .map((result: any) => {
        const jsonString = result[1];
        return jsonString ? RedisUtils.safeJsonParse<TipRecord>(jsonString) : null;
      })
      .filter((tip: TipRecord | null) => tip !== null) as TipRecord[];
  }

  /**
   * Get all tips for a room
   */
  static async getAllTips(roomId: string): Promise<TipRecord[]> {
    const client = await RedisUtils.getClient();
    const roomTipsKey = this.tipKeys.roomTips(roomId);

    // Get all tip IDs (reverse chronological order)
    const tipIds = await client.zrevrange(roomTipsKey, 0, -1);

    if (tipIds.length === 0) {
      return [];
    }

    // Fetch all tip records in parallel
    const pipeline = client.pipeline();
    tipIds.forEach((tipId: string) => {
      const tipKey = this.tipKeys.tipRecord(roomId, tipId);
      pipeline.get(tipKey);
    });

    const results = await RedisUtils.executePipeline(pipeline);

    // Parse and return tip records
    return results
      .map((result: any) => {
        const jsonString = result[1];
        return jsonString ? RedisUtils.safeJsonParse<TipRecord>(jsonString) : null;
      })
      .filter((tip: TipRecord | null) => tip !== null) as TipRecord[];
  }

  /**
   * Get aggregated tip statistics for a room
   */
  static async getTipStatistics(roomId: string): Promise<TipStatistics> {
    const allTips = await this.getAllTips(roomId);
    const recentTips = allTips.slice(0, 5);

    // Initialize statistics
    const stats: TipStatistics = {
      totalTipsUSD: 0,
      totalTipsByUsers: allTips.length,
      tipsByCurrency: {
        ETH: { count: 0, totalUSD: 0, totalNative: 0 },
        USDC: { count: 0, totalUSD: 0, totalNative: 0 },
        FIRE: { count: 0, totalUSD: 0, totalNative: 0 },
      },
      recentTips,
      allTips,
    };

    // Aggregate statistics
    allTips.forEach((tip) => {
      stats.totalTipsUSD += tip.amount.usd;

      const currency = tip.amount.currency as 'ETH' | 'USDC' | 'FIRE';
      if (stats.tipsByCurrency[currency]) {
        stats.tipsByCurrency[currency].count += 1;
        stats.tipsByCurrency[currency].totalUSD += tip.amount.usd;
        stats.tipsByCurrency[currency].totalNative += tip.amount.native;
      }
    });

    return stats;
  }

  /**
   * Delete all tips for a room (cleanup utility)
   */
  static async deleteRoomTips(roomId: string): Promise<void> {
    const client = await RedisUtils.getClient();
    const roomTipsKey = this.tipKeys.roomTips(roomId);

    // Get all tip IDs
    const tipIds = await client.zrange(roomTipsKey, 0, -1);

    if (tipIds.length === 0) {
      return;
    }

    // Delete all tip records
    const pipeline = client.pipeline();
    tipIds.forEach((tipId: string) => {
      const tipKey = this.tipKeys.tipRecord(roomId, tipId);
      pipeline.del(tipKey);
    });

    // Delete the sorted set
    pipeline.del(roomTipsKey);

    await RedisUtils.executePipeline(pipeline);
  }
}
