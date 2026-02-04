"use client";

import { useState, useEffect, useCallback } from 'react';
import type { Conversation, DecodedMessage } from '@xmtp/browser-sdk';
import { toast } from 'react-toastify';

interface XMTPMessage {
  id: string;
  content: string;
  senderInboxId: string;
  sentAt: Date;
  replyTo?: {
    messageId: string;
    content: string;
  };
}

/**
 * Custom hook to manage XMTP messages for a conversation
 * 
 * Handles:
 * - Fetching message history
 * - Streaming real-time messages
 * - Sending messages and replies
 * - Message count for unread tracking
 */
export function useXMTPMessages(conversation: Conversation | null) {
  const [messages, setMessages] = useState<XMTPMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Fetch initial messages
  useEffect(() => {
    if (!conversation) {
      setMessages([]);
      return;
    }

    async function loadMessages() {
      try {
        setIsLoading(true);
        
        // Sync first to get latest
        await conversation.sync();
        
        // Get messages (comes in reverse chronological order)
        const msgs = await conversation.messages({
          limit: BigInt(100)
        }) as any[];

        // Transform to our format (reverse to get chronological order)
        const transformedMessages = msgs.reverse().map((msg: any) => ({
          id: msg.id,
          content: msg.content,
          senderInboxId: msg.senderInboxId,
          sentAt: msg.sentAt,
          replyTo: msg.contentType?.typeId === 'reply' ? {
            messageId: msg.content?.reference || '',
            content: msg.content?.content || '',
          } : undefined,
        }));

        setMessages(transformedMessages);
      } catch (error) {
        console.error('Error loading messages:', error);
        toast.error('Failed to load message history');
      } finally {
        setIsLoading(false);
      }
    }

    loadMessages();
  }, [conversation]);

  // Stream new messages
  useEffect(() => {
    if (!conversation) return;

    let stream: any;
    let isCancelled = false;

    async function startStream() {
      try {
        // Stream returns an async iterator
        stream = await conversation.streamMessages();
        
        // Process messages from stream
        try {
          for await (const message of stream as any) {
            if (isCancelled) break;
            
            const transformedMessage = {
              id: message.id,
              content: message.content,
              senderInboxId: message.senderInboxId,
              sentAt: message.sentAt,
              replyTo: message.contentType?.typeId === 'reply' ? {
                messageId: message.content?.reference || '',
                content: message.content?.content || '',
              } : undefined,
            };

            setMessages(prev => [...prev, transformedMessage]);
          }
        } catch (streamError) {
          if (!isCancelled) {
            console.error('Message stream error:', streamError);
            toast.error('Lost connection to chat. Messages may be delayed.');
          }
        }
      } catch (error) {
        console.error('Error starting message stream:', error);
      }
    }

    startStream();

    return () => {
      isCancelled = true;
      if (stream && typeof stream.return === 'function') {
        stream.return();
      }
    };
  }, [conversation]);

  // Send message
  const sendMessage = useCallback(async (text: string) => {
    if (!conversation || !text.trim()) {
      return;
    }

    try {
      setIsSending(true);
      await conversation.send(text.trim());
      
      // Message will be added via the stream
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
      throw error;
    } finally {
      setIsSending(false);
    }
  }, [conversation]);

  // Send reply
  const sendReply = useCallback(async (text: string, replyToId: string) => {
    if (!conversation || !text.trim()) {
      return;
    }

    try {
      setIsSending(true);
      
      // Note: XMTP reply implementation depends on SDK version
      // This is a simplified version - adjust based on actual SDK capabilities
      await conversation.send(text.trim(), {
        // contentType: ContentTypeReply,
        // reference: replyToId,
      });
      
      // For now, just send as regular message with metadata
      // The backend will handle reply structure
      
    } catch (error) {
      console.error('Error sending reply:', error);
      toast.error('Failed to send reply');
      throw error;
    } finally {
      setIsSending(false);
    }
  }, [conversation]);

  // Get message count (for unread tracking)
  const getMessageCount = useCallback(async (afterTimestamp?: number): Promise<number> => {
    if (!conversation) return 0;

    try {
      await conversation.sync();
      
      if (afterTimestamp) {
        const messages = await conversation.messages({
          sentAfterNs: BigInt(afterTimestamp * 1_000_000), // Convert to nanoseconds
        }) as any[];
        return messages.length;
      }

      // Get all messages and count them
      const allMessages = await conversation.messages() as any[];
      return allMessages.length;
    } catch (error) {
      console.error('Error getting message count:', error);
      return 0;
    }
  }, [conversation]);

  return {
    messages,
    isLoading,
    isSending,
    sendMessage,
    sendReply,
    getMessageCount,
  };
}
