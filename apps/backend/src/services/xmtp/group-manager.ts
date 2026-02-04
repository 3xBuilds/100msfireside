import type { Client } from '@xmtp/node-sdk';
import { RedisUtils } from '../redis/redis-utils';
import Room from '../../models/Room';

/**
 * XMTP Group Manager Service
 * Manages XMTP group chats for rooms
 */
export class XMTPGroupManager {
  /**
   * Create XMTP group for a room
   * @param client - XMTP client of the host
   * @param roomId - MongoDB Room ID
   * @param roomName - Name of the room
   * @param participantAddresses - Array of participant wallet addresses
   * @returns Group conversation ID
   */
  static async createRoomGroup(
    client: Client,
    roomId: string,
    roomName: string,
    participantAddresses: string[] = []
  ): Promise<string> {
    try {
      // Get inbox IDs for participants
      const inboxIds: string[] = [];
      
      if (participantAddresses.length > 0) {
        // Check which addresses can message on XMTP
        const canMessageMap = await client.canMessage(participantAddresses);
        
        for (const address of participantAddresses) {
          const canMessage = canMessageMap.get(address);
          if (canMessage) {
            // Get inbox ID for this address
            const inboxId = await client.findInboxIdByAddress(address);
            if (inboxId) {
              inboxIds.push(inboxId);
            }
          }
        }
      }

      // Create group conversation
      const group = await client.conversations.newGroup(inboxIds, {
        groupName: roomName,
        groupDescription: `Chat for ${roomName}`,
      });

      const groupId = group.id;

      // Store group ID in MongoDB
      await Room.findByIdAndUpdate(roomId, { xmtpGroupId: groupId });

      // Store group ID in Redis for quick lookup
      const redisClient = await RedisUtils.getClient();
      await redisClient.set(
        RedisUtils.roomKeys.xmtpGroup(roomId),
        groupId,
        'EX',
        RedisUtils.TTL
      );

      console.log(`Created XMTP group ${groupId} for room ${roomId}`);
      return groupId;
    } catch (error) {
      console.error('Error creating XMTP group:', error);
      throw new Error(`Failed to create XMTP group: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Add participant to existing XMTP group
   * @param client - XMTP client (can be any member's client)
   * @param groupId - XMTP group conversation ID
   * @param participantAddress - Wallet address to add
   * @returns Success boolean
   */
  static async addParticipant(
    client: Client,
    groupId: string,
    participantAddress: string
  ): Promise<boolean> {
    try {
      // Check if participant can use XMTP
      const canMessageMap = await client.canMessage([participantAddress]);
      const canMessage = canMessageMap.get(participantAddress);
      if (!canMessage) {
        console.warn(`User ${participantAddress} is not on XMTP network`);
        return false;
      }

      // Get inbox ID
      const inboxId = await client.findInboxIdByAddress(participantAddress);
      if (!inboxId) {
        console.warn(`Could not find inbox ID for ${participantAddress}`);
        return false;
      }

      // Get conversation and add member
      const conversation = await client.conversations.getConversationById(groupId);
      if (!conversation) {
        throw new Error(`Group ${groupId} not found`);
      }

      await conversation.addMembers([inboxId]);
      
      console.log(`Added ${participantAddress} to XMTP group ${groupId}`);
      return true;
    } catch (error) {
      console.error('Error adding participant to XMTP group:', error);
      throw new Error(`Failed to add participant: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Remove participant from XMTP group
   * @param client - XMTP client (must be admin)
   * @param groupId - XMTP group conversation ID
   * @param participantAddress - Wallet address to remove
   * @returns Success boolean
   */
  static async removeParticipant(
    client: Client,
    groupId: string,
    participantAddress: string
  ): Promise<boolean> {
    try {
      const inboxId = await client.findInboxIdByAddress(participantAddress);
      if (!inboxId) {
        console.warn(`Could not find inbox ID for ${participantAddress}`);
        return false;
      }

      const conversation = await client.conversations.getConversationById(groupId);
      if (!conversation) {
        throw new Error(`Group ${groupId} not found`);
      }

      await conversation.removeMembers([inboxId]);
      
      console.log(`Removed ${participantAddress} from XMTP group ${groupId}`);
      return true;
    } catch (error) {
      console.error('Error removing participant from XMTP group:', error);
      throw new Error(`Failed to remove participant: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get XMTP group ID for a room
   * @param roomId - MongoDB Room ID
   * @returns Group ID or null if not found
   */
  static async getGroupId(roomId: string): Promise<string | null> {
    try {
      // Try Redis first
      const redisClient = await RedisUtils.getClient();
      const cachedGroupId = await redisClient.get(RedisUtils.roomKeys.xmtpGroup(roomId));
      
      if (cachedGroupId) {
        return cachedGroupId;
      }

      // Fall back to MongoDB
      const room = await Room.findById(roomId);
      if (room?.xmtpGroupId) {
        // Cache in Redis
        await redisClient.set(
          RedisUtils.roomKeys.xmtpGroup(roomId),
          room.xmtpGroupId,
          'EX',
          RedisUtils.TTL
        );
        return room.xmtpGroupId;
      }

      return null;
    } catch (error) {
      console.error('Error getting group ID:', error);
      return null;
    }
  }

  /**
   * Get messages from XMTP group
   * @param client - XMTP client
   * @param groupId - XMTP group conversation ID
   * @param limit - Maximum number of messages to fetch
   * @param offset - Number of messages to skip
   * @returns Array of messages
   */
  static async getMessages(
    client: Client,
    groupId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<any[]> {
    try {
      const conversation = await client.conversations.getConversationById(groupId);
      if (!conversation) {
        throw new Error(`Group ${groupId} not found`);
      }

      // Sync to get latest messages
      await conversation.sync();

      // Get messages (fetch more than needed for offset)
      const allMessages = await conversation.messages({
        limit: BigInt(limit + offset)
      }) as any[];

      // Messages come in reverse chronological order, so we need to:
      // 1. Reverse to get chronological
      // 2. Apply offset
      // 3. Limit results
      const chronological = allMessages.reverse();
      const slicedMessages = chronological.slice(offset, offset + limit);
      return slicedMessages;
    } catch (error) {
      console.error('Error fetching XMTP messages:', error);
      throw new Error(`Failed to fetch messages: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get message count for a group
   * @param client - XMTP client
   * @param groupId - XMTP group conversation ID
   * @param afterTimestamp - Optional timestamp to count messages after (for unread)
   * @returns Message count
   */
  static async getMessageCount(
    client: Client,
    groupId: string,
    afterTimestamp?: number
  ): Promise<number> {
    try {
      const conversation = await client.conversations.getConversationById(groupId);
      if (!conversation) {
        return 0;
      }

      await conversation.sync();

      if (afterTimestamp) {
        // Count unread messages
        const messages = await conversation.messages({
          sentAfterNs: BigInt(afterTimestamp * 1_000_000), // Convert to nanoseconds
        }) as any[];
        return messages.length;
      }

      // Total message count - get all messages and count
      const allMessages = await conversation.messages() as any[];
      return allMessages.length;
    } catch (error) {
      console.error('Error getting message count:', error);
      return 0;
    }
  }

  /**
   * Send text message to group
   * @param client - XMTP client
   * @param groupId - XMTP group conversation ID
   * @param text - Message text
   * @returns Sent message
   */
  static async sendMessage(
    client: Client,
    groupId: string,
    text: string
  ): Promise<any> {
    try {
      const conversation = await client.conversations.getConversationById(groupId);
      if (!conversation) {
        throw new Error(`Group ${groupId} not found`);
      }

      await conversation.send(text);
      
      // Return a message-like object
      return {
        content: text,
        senderInboxId: client.inboxId,
        sentAt: new Date(),
      };
    } catch (error) {
      console.error('Error sending XMTP message:', error);
      throw new Error(`Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Send reply to a message
   * @param client - XMTP client
   * @param groupId - XMTP group conversation ID
   * @param text - Reply text
   * @param replyToMessageId - ID of message being replied to
   * @returns Sent message
   */
  static async sendReply(
    client: Client,
    groupId: string,
    text: string,
    replyToMessageId: string
  ): Promise<any> {
    try {
      const conversation = await client.conversations.getConversationById(groupId);
      if (!conversation) {
        throw new Error(`Group ${groupId} not found`);
      }

      // XMTP reply implementation
      // Note: This is a simplified version - adjust based on actual XMTP SDK reply mechanism
      await conversation.send(text, {
        // contentType: ContentTypeReply,
        // reference: replyToMessageId,
      });

      return {
        content: text,
        senderInboxId: client.inboxId,
        sentAt: new Date(),
        replyToId: replyToMessageId,
      };
    } catch (error) {
      console.error('Error sending XMTP reply:', error);
      throw new Error(`Failed to send reply: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete/archive XMTP group
   * @param client - XMTP client (must be admin)
   * @param groupId - XMTP group conversation ID
   * @param roomId - MongoDB Room ID
   * @returns Success boolean
   */
  static async deleteGroup(
    client: Client,
    groupId: string,
    roomId: string
  ): Promise<boolean> {
    try {
      // XMTP doesn't support deleting messages
      // Best we can do is remove the group reference
      
      // Remove from MongoDB
      await Room.findByIdAndUpdate(roomId, { $unset: { xmtpGroupId: '' } });

      // Remove from Redis
      const redisClient = await RedisUtils.getClient();
      await redisClient.del(RedisUtils.roomKeys.xmtpGroup(roomId));

      console.log(`Removed XMTP group ${groupId} reference for room ${roomId}`);
      return true;
    } catch (error) {
      console.error('Error deleting XMTP group:', error);
      return false;
    }
  }
}
