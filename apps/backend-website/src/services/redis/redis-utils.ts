import { redis } from '../../config/redis';

/**
 * Shared Redis utilities and constants
 */
export class RedisUtils {
    static readonly TTL = 86400;

    static async getClient() {
        return redis.getClient();
    }

    static async executePipeline(pipeline: any): Promise<any[]> {
        try {
            const results = await pipeline.exec();
            return results || [];
        } catch (error) {
            console.error('Redis pipeline execution failed:', error);
            throw error;
        }
    }

    static safeJsonParse<T>(jsonString: string, fallback?: T): T | null {
        try {
            return JSON.parse(jsonString);
        } catch (error) {
            console.error('Failed to parse JSON:', error);
            return fallback ?? null;
        }
    }

    static roomKeys = {
        participants: (roomId: string) => `room:${roomId}:participants`,
        roles: (roomId: string) => `room:${roomId}:roles`,
        status: (roomId: string) => `room:${roomId}:status`,
        messages: (roomId: string) => `room:${roomId}:messages`
    };

    static messageKeys = {
        message: (messageId: string) => `message:${messageId}`
    };

    static adKeys = {
        ad: (adId: string) => `ad:${adId}`,
        roomAdsState: (roomId: string) => `room:${roomId}:ads:state`,
        roomAdCurrent: (roomId: string) => `room:${roomId}:ads:current`,
        roomAdLock: (roomId: string) => `room:${roomId}:ads:lock`,
        roomAdsStartLock: (roomId: string) => `room:${roomId}:ads:start-lock`,
        webhookRetryQueue: (roomId: string) => `room:${roomId}:ads:webhook:retry`,
        webhookRetryScheduled: () => `ads:webhook:retry:scheduled`,
        webhookRetryLock: () => `ads:webhook:retry:lock`
    };
    
    /**
     * Gets the TTL (time to live) of a key in seconds
     * @param key The Redis key to get TTL for
     * @returns TTL in seconds, -2 if key does not exist, -1 if key exists but has no expiry
     */
    static async getKeyTTL(key: string): Promise<number> {
        const client = await this.getClient();
        return client.ttl(key);
    }

    static async acquireLock(key: string, ttlSec: number): Promise<boolean> {
        const client = await this.getClient();
        const acquired = await client.setnx(key, '1');
        if (acquired) {
            await client.expire(key, ttlSec);
            return true;
        }
        return false;
    }

    static async releaseLock(key: string): Promise<void> {
        const client = await this.getClient();
        await client.del(key);
    }
}
