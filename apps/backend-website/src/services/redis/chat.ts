import type { ChatMessage } from '../../schemas';
import { RedisUtils } from './redis-utils';

/**
 * Redis Chat Service
 * 
 * Optimized chat message operations with function overloading and improved performance.
 * 
 * Key Structure:
 * - room:{roomId}:messages -> Sorted set of messageIds by timestamp
 * - message:{messageId} -> Hash of message data
 */
export class RedisChatService {
    /**
     * Store a chat message
     */
    static async storeMessage(roomId: string, user: any, message: string, replyToId?: string): Promise<ChatMessage> {
        const messageId = `${Date.now()}_${user.fid}`;
        const timestamp = new Date().toISOString();
        
        const chatMessage: ChatMessage = {
            id: messageId,
            roomId,
            userId: user.fid,
            username: user.username,
            displayName: user.displayName,
            pfp_url: user.pfp_url,
            message: message.trim(),
            timestamp,
        };

        // If replying to a message, fetch and attach reply metadata
        if (replyToId) {
            const client = await RedisUtils.getClient();
            const replyToMessage = await client.hgetall(RedisUtils.messageKeys.message(replyToId));
            
            if (replyToMessage && replyToMessage.id) {
                chatMessage.replyTo = {
                    messageId: replyToMessage.id,
                    message: replyToMessage.message.substring(0, 100), // Truncate to 100 chars
                    username: replyToMessage.username || 'Unknown',
                    pfp_url: replyToMessage.pfp_url || ''
                };
            }
        }

        const client = await RedisUtils.getClient();
        const pipeline = client.pipeline();
        
        // Prepare message data for Redis hash storage
        // Redis hashes don't support nested objects, so stringify replyTo if present
        const messageDataForRedis: any = { ...chatMessage };
        if (chatMessage.replyTo) {
            messageDataForRedis.replyTo = JSON.stringify(chatMessage.replyTo);
        }
        
        // Store message data and add to sorted set
        pipeline.hmset(RedisUtils.messageKeys.message(messageId), messageDataForRedis);
        pipeline.zadd(RedisUtils.roomKeys.messages(roomId), Date.now(), messageId);
        pipeline.expire(RedisUtils.messageKeys.message(messageId), RedisUtils.TTL);
        pipeline.expire(RedisUtils.roomKeys.messages(roomId), RedisUtils.TTL);
        
        await RedisUtils.executePipeline(pipeline);
        return chatMessage;
    }

    /**
     * Get messages - overloaded for flexible retrieval
     */
    // Get latest messages with default limit
    static async getMessages(roomId: string): Promise<ChatMessage[]>;
    // Get messages with pagination
    static async getMessages(roomId: string, limit: number, offset: number): Promise<ChatMessage[]>;
    // Get messages after timestamp
    static async getMessages(roomId: string, afterTimestamp: number, limit?: number): Promise<ChatMessage[]>;
    // Get messages with count (returns both messages and total count)
    static async getMessages(roomId: string, withCount: 'withCount'): Promise<{ messages: ChatMessage[], totalCount: number }>;
    // Get messages with pagination and count
    static async getMessages(roomId: string, withCount: 'withCount', limit: number, offset: number): Promise<{ messages: ChatMessage[], totalCount: number }>;
    
    static async getMessages(
        roomId: string,
        limitOrTimestampOrCount?: number | 'withCount',
        offsetOrLimit?: number,
        limitForTimestamp?: number
    ): Promise<ChatMessage[] | { messages: ChatMessage[], totalCount: number }> {
        const client = await RedisUtils.getClient();
        
        // Handle different overloads
        if (limitOrTimestampOrCount === 'withCount') {
            const limit = offsetOrLimit || 50;
            const offset = limitForTimestamp || 0;
            
            const [messageIds, totalCount] = await Promise.all([
                client.zrevrange(RedisUtils.roomKeys.messages(roomId), offset, offset + limit - 1),
                client.zcard(RedisUtils.roomKeys.messages(roomId))
            ]);
            
            const messages = await this.fetchMessagesFromIds(messageIds);
            return { messages: messages.reverse(), totalCount };
        }
        
        // After timestamp query
        if (typeof limitOrTimestampOrCount === 'number' && limitOrTimestampOrCount > Date.now() - 365 * 24 * 60 * 60 * 1000) {
            const limit = offsetOrLimit || 50;
            const messageIds = await client.zrangebyscore(
                RedisUtils.roomKeys.messages(roomId),
                limitOrTimestampOrCount + 1,
                '+inf',
                'LIMIT', 0, limit
            );
            
            return this.fetchMessagesFromIds(messageIds);
        }
        
        // Pagination query
        const limit = typeof limitOrTimestampOrCount === 'number' ? limitOrTimestampOrCount : 50;
        const offset = offsetOrLimit || 0;
        
        const messageIds = await client.zrevrange(
            RedisUtils.roomKeys.messages(roomId),
            offset,
            offset + limit - 1
        );
        
        const messages = await this.fetchMessagesFromIds(messageIds);
        return messages.reverse();
    }

    /**
     * Helper method to fetch messages from IDs
     */
    private static async fetchMessagesFromIds(messageIds: string[]): Promise<ChatMessage[]> {
        if (messageIds.length === 0) return [];
        
        const client = await RedisUtils.getClient();
        const pipeline = client.pipeline();
        messageIds.forEach(id => pipeline.hgetall(RedisUtils.messageKeys.message(id)));
        
        const results = await RedisUtils.executePipeline(pipeline);
        const messages: ChatMessage[] = [];

        results?.forEach((result) => {
            if (result && result[1]) {
                const messageData = result[1] as Record<string, string>;
                if (messageData.id) {
                    // Parse replyTo if it exists (stored as JSON string)
                    const parsedMessage: any = { ...messageData };
                    if (messageData.replyTo && typeof messageData.replyTo === 'string') {
                        try {
                            parsedMessage.replyTo = JSON.parse(messageData.replyTo);
                        } catch (e) {
                            // If parsing fails, remove replyTo to avoid errors
                            delete parsedMessage.replyTo;
                        }
                    }
                    // Convert isBot string to boolean
                    if (parsedMessage.isBot === 'true') {
                        parsedMessage.isBot = true;
                    } else if (parsedMessage.isBot === 'false') {
                        parsedMessage.isBot = false;
                    }
                    // Parse transactions if present (stored as JSON string)
                    if (messageData.transactions && typeof messageData.transactions === 'string') {
                        try {
                            parsedMessage.transactions = JSON.parse(messageData.transactions);
                        } catch (e) {
                            delete parsedMessage.transactions;
                        }
                    }
                    messages.push(parsedMessage as ChatMessage);
                }
            }
        });

        return messages;
    }

    /**
     * Get message count for a room
     */
    static async getMessageCount(roomId: string): Promise<number> {
        const client = await RedisUtils.getClient();
        return await client.zcard(RedisUtils.roomKeys.messages(roomId));
    }

    /**
     * Delete messages - overloaded for flexible deletion
     */
    // Delete all messages in a room
    static async deleteMessages(roomId: string): Promise<void>;
    // Delete a specific message
    static async deleteMessages(roomId: string, messageId: string): Promise<boolean>;
    
    static async deleteMessages(roomId: string, messageId?: string): Promise<void | boolean> {
        const client = await RedisUtils.getClient();
        
        if (messageId) {
            // Delete specific message
            const pipeline = client.pipeline();
            pipeline.zrem(RedisUtils.roomKeys.messages(roomId), messageId);
            pipeline.del(RedisUtils.messageKeys.message(messageId));
            
            const results = await RedisUtils.executePipeline(pipeline);
            return results?.[0]?.[1] === 1;
        } else {
            // Delete all room messages
            const messageIds = await client.zrange(RedisUtils.roomKeys.messages(roomId), 0, -1);
            
            if (messageIds.length > 0) {
                const pipeline = client.pipeline();
                messageIds.forEach(id => pipeline.del(RedisUtils.messageKeys.message(id)));
                pipeline.del(RedisUtils.roomKeys.messages(roomId));
                await RedisUtils.executePipeline(pipeline);
            } else {
                await client.del(RedisUtils.roomKeys.messages(roomId));
            }
        }
    }

    /**
     * Store a bot message (e.g., from Bankr AI)
     */
    static async storeBotMessage(
        roomId: string, 
        botUser: { fid: string; username: string; displayName: string; pfp_url: string },
        message: string,
        status: 'pending' | 'completed' | 'failed' = 'completed',
        replyToId?: string,
        threadId?: string
    ): Promise<ChatMessage> {
        const messageId = `${Date.now()}_${botUser.fid}`;
        const timestamp = new Date().toISOString();
        
        const chatMessage: ChatMessage = {
            id: messageId,
            roomId,
            userId: botUser.fid,
            username: botUser.username,
            displayName: botUser.displayName,
            pfp_url: botUser.pfp_url,
            message: message.trim(),
            timestamp,
            isBot: true,
            status,
            threadId
        };

        // If replying to a message, fetch and attach reply metadata
        if (replyToId) {
            const client = await RedisUtils.getClient();
            const replyToMessage = await client.hgetall(RedisUtils.messageKeys.message(replyToId));
            
            if (replyToMessage && replyToMessage.id) {
                chatMessage.replyTo = {
                    messageId: replyToMessage.id,
                    message: replyToMessage.message.substring(0, 100),
                    username: replyToMessage.username || 'Unknown',
                    pfp_url: replyToMessage.pfp_url || ''
                };
            }
        }

        const client = await RedisUtils.getClient();
        const pipeline = client.pipeline();
        
        // Prepare message data for Redis hash storage
        const messageDataForRedis: any = { ...chatMessage };
        if (chatMessage.replyTo) {
            messageDataForRedis.replyTo = JSON.stringify(chatMessage.replyTo);
        }
        
        // Store message data and add to sorted set
        pipeline.hmset(RedisUtils.messageKeys.message(messageId), messageDataForRedis);
        pipeline.zadd(RedisUtils.roomKeys.messages(roomId), Date.now(), messageId);
        pipeline.expire(RedisUtils.messageKeys.message(messageId), RedisUtils.TTL);
        pipeline.expire(RedisUtils.roomKeys.messages(roomId), RedisUtils.TTL);
        
        await RedisUtils.executePipeline(pipeline);
        return chatMessage;
    }

    /**
     * Update an existing message (e.g., update placeholder bot message with actual response)
     */
    static async updateMessage(
        messageId: string, 
        updates: { 
            message?: string; 
            status?: 'pending' | 'completed' | 'failed'; 
            threadId?: string;
            transactions?: any[];
            prompterFid?: string;
        }
    ): Promise<boolean> {
        const client = await RedisUtils.getClient();
        
        // Check if message exists
        const exists = await client.exists(RedisUtils.messageKeys.message(messageId));
        if (!exists) {
            return false;
        }

        // Update the specified fields
        const updateData: Record<string, string> = {};
        if (updates.message !== undefined) {
            updateData.message = updates.message;
        }
        if (updates.status !== undefined) {
            updateData.status = updates.status;
        }
        if (updates.threadId !== undefined) {
            updateData.threadId = updates.threadId;
        }
        if (updates.transactions !== undefined) {
            updateData.transactions = JSON.stringify(updates.transactions);
        }
        if (updates.prompterFid !== undefined) {
            updateData.prompterFid = updates.prompterFid;
        }

        if (Object.keys(updateData).length === 0) {
            return true; // Nothing to update
        }

        await client.hmset(RedisUtils.messageKeys.message(messageId), updateData);
        return true;
    }

    /**
     * Get a single message by ID
     */
    static async getMessage(messageId: string): Promise<ChatMessage | null> {
        const client = await RedisUtils.getClient();
        const messageData = await client.hgetall(RedisUtils.messageKeys.message(messageId));
        
        if (!messageData || !messageData.id) {
            return null;
        }

        const parsedMessage: any = { ...messageData };
        if (messageData.replyTo && typeof messageData.replyTo === 'string') {
            try {
                parsedMessage.replyTo = JSON.parse(messageData.replyTo);
            } catch (e) {
                delete parsedMessage.replyTo;
            }
        }
        
        // Convert isBot string to boolean
        if (parsedMessage.isBot === 'true') {
            parsedMessage.isBot = true;
        } else if (parsedMessage.isBot === 'false') {
            parsedMessage.isBot = false;
        }
        
        // Parse transactions if present (stored as JSON string)
        if (messageData.transactions && typeof messageData.transactions === 'string') {
            try {
                parsedMessage.transactions = JSON.parse(messageData.transactions);
            } catch (e) {
                delete parsedMessage.transactions;
            }
        }

        return parsedMessage as ChatMessage;
    }
}
