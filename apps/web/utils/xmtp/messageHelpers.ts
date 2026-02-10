/**
 * XMTP Message Helpers
 * Utilities for formatting and handling XMTP messages in the UI
 */

export interface XMTPMessage {
  id: string;
  senderInboxId: string;
  content: any;
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
  const userProfile = getUserProfile(xmtpMsg.senderInboxId);

  // Extract message text and reply metadata
  let messageText = '';
  let replyTo: FormattedMessage['replyTo'] | undefined;

  if (typeof xmtpMsg.content === 'string') {
    messageText = xmtpMsg.content;
  } else if (xmtpMsg.content?.text) {
    messageText = xmtpMsg.content.text;
    
    // Check for reply metadata
    if (xmtpMsg.content.reply?.reference) {
      const replyProfile = getUserProfile(xmtpMsg.content.reply.senderInboxId || '');
      replyTo = {
        messageId: xmtpMsg.content.reply.reference,
        message: xmtpMsg.content.reply.text || '',
        username: replyProfile?.username || 'Unknown',
        pfp_url: replyProfile?.pfp_url || '',
      };
    }
  }

  return {
    id: xmtpMsg.id,
    userId: userProfile?.fid || xmtpMsg.senderInboxId,
    username: userProfile?.username || 'Unknown',
    displayName: userProfile?.displayName || userProfile?.username || 'Unknown User',
    pfp_url: userProfile?.pfp_url || '',
    message: messageText,
    timestamp: xmtpMsg.sentAt.toISOString(),
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
 * Creates reply content for XMTP
 * @param replyText - The reply message text
 * @param originalMessage - The message being replied to
 */
export function createReplyContent(
  replyText: string,
  originalMessage: FormattedMessage
) {
  return {
    text: replyText,
    reply: {
      reference: originalMessage.id,
      text: originalMessage.message.substring(0, 100), // Include snippet for context
      senderInboxId: originalMessage.userId,
    },
  };
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
