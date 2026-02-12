/**
 * XMTP Message Helpers
 * Utilities for formatting and handling XMTP messages in the UI
 */

import type { MentionData } from '@/utils/mentions';

/**
 * Sender metadata embedded in message content
 */
export interface SenderMetadata {
  username: string;
  pfp_url: string;
  displayName?: string;
  fid?: string;
}

/**
 * Enhanced message content with sender metadata and mentions
 */
export interface MessageContent {
  text: string;
  sender: SenderMetadata;
  mentions?: MentionData[];
}

/**
 * Legacy structured message content with custom reply (for backward compatibility)
 */
export interface LegacyMessageContent extends MessageContent {
  reply?: {
    reference: string;
    text: string;
    senderInboxId: string;
    sender?: SenderMetadata;
  };
}

export interface XMTPMessage {
  id: string;
  senderInboxId: string;
  content: any; // Can be plain string, structured content, or XMTP reply content
  contentType?: { typeId: string; authorityId: string };
  sentAt: Date;
}

export interface FormattedMessage {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  pfp_url: string;
  message: string;
  timestamp: string;
  mentions?: MentionData[];
  replyTo?: {
    messageId: string;
    message: string;
    username: string;
    pfp_url: string;
  };
}

export interface UserProfile {
  fid: string;
  username: string;
  displayName: string;
  pfp_url: string;
  wallet?: string;
}

/**
 * Maps inbox IDs to user profiles for message display
 */
const userProfileCache = new Map<string, UserProfile>();

/**
 * Register a user profile for message formatting
 * @param inboxId - XMTP inbox ID (usually wallet address)
 * @param profile - User profile information
 */
export function registerUserProfile(inboxId: string, profile: UserProfile) {
  userProfileCache.set(inboxId.toLowerCase(), profile);
}

/**
 * Get user profile from cache by inbox ID
 * @param inboxId - XMTP inbox ID
 */
export function getUserProfile(inboxId: string): UserProfile | undefined {
  return userProfileCache.get(inboxId.toLowerCase());
}

/**
 * Clear the user profile cache
 */
export function clearUserProfiles() {
  userProfileCache.clear();
}

/**
 * Formats an XMTP message for display in the UI
 * @param xmtpMsg - Raw XMTP message
 * @param currentUserInboxId - Inbox ID of the current user (optional)
 */
export function formatXMTPMessage(
  xmtpMsg: XMTPMessage,
  currentUserInboxId?: string
): FormattedMessage {
  let messageText = '';
  let replyTo: FormattedMessage['replyTo'] | undefined;
  let senderMetadata: SenderMetadata | undefined;
  let mentions: MentionData[] | undefined;

  // Check if this is a ContentTypeReply message
  const isReply = xmtpMsg.contentType?.typeId === 'reply';
  
  if (isReply && xmtpMsg.content?.content && xmtpMsg.content?.referenceId) {
    // Native XMTP ContentTypeReply format
    const replyContent = xmtpMsg.content;
    
    // Parse the reply content (could be plain text or JSON with metadata)
    let parsedContent: any = replyContent.content;
    if (typeof replyContent.content === 'string') {
      try {
        parsedContent = JSON.parse(replyContent.content);
      } catch (e) {
        // Plain text content
        parsedContent = { text: replyContent.content };
      }
    }
    
    messageText = parsedContent.text || parsedContent;
    senderMetadata = parsedContent.sender;
    mentions = parsedContent.mentions;
    
    // Get reply metadata from the enriched reply
    if (replyContent.inReplyTo) {
      const originalMsg = replyContent.inReplyTo;
      let originalContent: any = originalMsg.content;
      
      // Parse original message content
      if (typeof originalMsg.content === 'string') {
        try {
          originalContent = JSON.parse(originalMsg.content);
        } catch (e) {
          originalContent = { text: originalMsg.content };
        }
      }
      
      const originalText = originalContent.text || originalContent;
      const originalSender = originalContent.sender || getUserProfile(originalMsg.senderInboxId);
      
      replyTo = {
        messageId: replyContent.referenceId,
        message: typeof originalText === 'string' ? originalText.substring(0, 100) : '',
        username: originalSender?.username || 'Unknown',
        pfp_url: originalSender?.pfp_url || '',
      };
    }
  } else if (typeof xmtpMsg.content === 'string') {
    // Try to parse as JSON first (could be our enhanced format)
    try {
      const parsedContent = JSON.parse(xmtpMsg.content);
      if (parsedContent.text) {
        messageText = parsedContent.text;
        senderMetadata = parsedContent.sender;
        mentions = parsedContent.mentions;
        
        // Check for embedded replyTo (new format)
        if (parsedContent.replyTo?.reference) {
          replyTo = {
            messageId: parsedContent.replyTo.reference,
            message: parsedContent.replyTo.text?.substring(0, 100) || '[Referenced message]',
            username: parsedContent.replyTo.username || 'Unknown',
            pfp_url: parsedContent.replyTo.pfp_url || '',
          };
        }
        
        // Check for legacy reply metadata (for backward compatibility)
        if (parsedContent.reply?.reference) {
          const legacyReply = parsedContent.reply;
          const replySender = legacyReply.sender || getUserProfile(legacyReply.senderInboxId || '');
          replyTo = {
            messageId: legacyReply.reference,
            message: legacyReply.text || '',
            username: replySender?.username || 'Unknown',
            pfp_url: replySender?.pfp_url || '',
          };
        }
      } else {
        // Not structured content, treat as plain text
        messageText = xmtpMsg.content;
      }
    } catch (e) {
      // Not JSON, treat as plain text
      messageText = xmtpMsg.content;
    }
  } else if (xmtpMsg.content?.text) {
    // Enhanced or legacy structured message
    messageText = xmtpMsg.content.text;
    senderMetadata = xmtpMsg.content.sender;
    mentions = xmtpMsg.content.mentions;
    
    // Check for embedded replyTo (new format)
    if (xmtpMsg.content.replyTo?.reference) {
      replyTo = {
        messageId: xmtpMsg.content.replyTo.reference,
        message: xmtpMsg.content.replyTo.text?.substring(0, 100) || '[Referenced message]',
        username: xmtpMsg.content.replyTo.username || 'Unknown',
        pfp_url: xmtpMsg.content.replyTo.pfp_url || '',
      };
    }
    
    // Check for legacy reply metadata (for backward compatibility)
    if ((xmtpMsg.content as LegacyMessageContent).reply?.reference) {
      const legacyReply = (xmtpMsg.content as LegacyMessageContent).reply!;
      const replySender = legacyReply.sender || getUserProfile(legacyReply.senderInboxId || '');
      replyTo = {
        messageId: legacyReply.reference,
        message: legacyReply.text || '',
        username: replySender?.username || 'Unknown',
        pfp_url: replySender?.pfp_url || '',
      };
    }
  }

  // Priority: embedded metadata > cache > fallback
  const userProfile = getUserProfile(xmtpMsg.senderInboxId);
  const username = senderMetadata?.username || userProfile?.username || 'Unknown';
  const displayName = senderMetadata?.displayName || userProfile?.displayName || username;
  const pfp_url = senderMetadata?.pfp_url || userProfile?.pfp_url || '';
  const userId = senderMetadata?.fid || userProfile?.fid || xmtpMsg.senderInboxId;

  return {
    id: xmtpMsg.id,
    userId,
    username,
    displayName,
    pfp_url,
    message: messageText,
    timestamp: xmtpMsg.sentAt.toISOString(),
    mentions,
    replyTo,
  };
}

/**
 * Formats multiple XMTP messages for display
 * @param messages - Array of XMTP messages
 * @param currentUserInboxId - Inbox ID of the current user (optional)
 */
export function formatXMTPMessages(
  messages: XMTPMessage[],
  currentUserInboxId?: string
): FormattedMessage[] {
  return messages
    .map(msg => formatXMTPMessage(msg, currentUserInboxId))
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

/**
 * Creates message content with sender metadata and mentions
 * @param text - The message text
 * @param sender - Sender metadata (username, pfp_url, etc.)
 * @param mentions - Optional mention data array
 */
export function createMessageContent(
  text: string,
  sender: SenderMetadata,
  mentions?: MentionData[]
): MessageContent {
  const content: MessageContent = {
    text,
    sender,
  };
  
  if (mentions && mentions.length > 0) {
    content.mentions = mentions;
  }
  
  return content;
}

/**
 * Checks if a message is from the current user
 * @param message - Formatted message
 * @param currentUserFid - Current user's Farcaster ID
 */
export function isOwnMessage(message: FormattedMessage, currentUserFid: string): boolean {
  return message.userId === currentUserFid;
}

/**
 * Groups messages by date for display
 * @param messages - Array of formatted messages
 */
export function groupMessagesByDate(messages: FormattedMessage[]): Map<string, FormattedMessage[]> {
  const groups = new Map<string, FormattedMessage[]>();

  messages.forEach(msg => {
    const date = new Date(msg.timestamp);
    const dateKey = date.toLocaleDateString();

    if (!groups.has(dateKey)) {
      groups.set(dateKey, []);
    }
    groups.get(dateKey)!.push(msg);
  });

  return groups;
}

/**
 * Formats a timestamp for display (e.g., "2:30 PM", "Yesterday", etc.)
 * @param timestamp - ISO timestamp string
 */
export function formatMessageTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return date.toLocaleDateString('en-US', { weekday: 'short' });
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Truncates a message for preview display
 * @param message - Message text
 * @param maxLength - Maximum length (default: 50)
 */
export function truncateMessage(message: string, maxLength: number = 50): string {
  if (message.length <= maxLength) return message;
  return message.substring(0, maxLength) + '...';
}
