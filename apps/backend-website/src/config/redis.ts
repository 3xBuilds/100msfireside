import Redis from 'ioredis';
import config from './index';

class RedisService {
    private client: Redis;

    constructor() {
        this.client = new Redis(config.redisUrl, {
            enableReadyCheck: false,
            maxRetriesPerRequest: null,
            lazyConnect: true,
        });

        this.client.on('error', (error) => {
            console.error('Redis connection error:', error);
        });

        this.client.on('connect', () => {
            console.log('Connected to Redis');
        });
    }

    async getClient(): Promise<Redis> {
        return this.client;
    }

    async setJSON<T>(key: string, value: T, ttl?: number): Promise<void> {
        const data = JSON.stringify(value);
        if (ttl) {
            await this.client.setex(key, ttl, data);
        } else {
            await this.client.set(key, data);
        }
    }

    async getJSON<T>(key: string): Promise<T | null> {
        const data = await this.client.get(key);
        if (!data) return null;

        try {
            return JSON.parse(data);
        } catch (error) {
            console.error('Error parsing JSON from Redis:', error);
            return null;
        }
    }

    async expire(key: string, seconds: number): Promise<void> {
        await this.client.expire(key, seconds);
    }

    async del(key: string): Promise<void> {
        await this.client.del(key);
    }
}

export const redis = new RedisService();
