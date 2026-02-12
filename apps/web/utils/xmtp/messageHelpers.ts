/**
 * XMTP Message Helpers
 * Utilities for formatting and handling XMTP messages in the UI
 */

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
 * Structured message content with sender metadata
 */
export interface MessageContent {
  text: string;
  sender: SenderMetadata;
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
  content: string | MessageContent; // Can be plain string (legacy) or structured content
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
  // Extract message text and reply metadata
  let messageText = '';
  let replyTo: FormattedMessage['replyTo'] | undefined;
  let senderMetadata: SenderMetadata | undefined;

  if (typeof xmtpMsg.content === 'string') {
    // Legacy plain text message - use cache for sender info
    messageText = xmtpMsg.content;
  } else if (xmtpMsg.content?.text) {
    // Structured message with sender metadata
    messageText = xmtpMsg.content.text;
    senderMetadata = xmtpMsg.content.sender;
    
    // Check for reply metadata
    if (xmtpMsg.content.reply?.reference) {
      // Try to get sender info from embedded metadata first, then cache
      const replySender = xmtpMsg.content.reply.sender || getUserProfile(xmtpMsg.content.reply.senderInboxId || '');
      replyTo = {
        messageId: xmtpMsg.content.reply.reference,
        message: xmtpMsg.content.reply.text || '',
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
 * Creates message content with sender metadata
 * @param text - The message text
 * @param sender - Sender metadata (username, pfp_url, etc.)
 */
export function createMessageContent(
  text: string,
  sender: SenderMetadata
): MessageContent {
  return {
    text,
    sender,
  };
}

/**
 * Creates reply content for XMTP with sender metadata
 * @param replyText - The reply message text
 * @param sender - Current user's metadata
 * @param originalMessage - The message being replied to
 */
export function createReplyContent(
  replyText: string,
  sender: SenderMetadata,
  originalMessage: FormattedMessage
): MessageContent {
  return {
    text: replyText,
    sender,
    reply: {
      reference: originalMessage.id,
      text: originalMessage.message.substring(0, 100), // Include snippet for context
      senderInboxId: originalMessage.userId,
      sender: {
        username: originalMessage.username,
        pfp_url: originalMessage.pfp_url,
        displayName: originalMessage.displayName,
        fid: originalMessage.userId,
      },
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
