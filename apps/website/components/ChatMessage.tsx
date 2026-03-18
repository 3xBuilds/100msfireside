'use client'

import { formatDistanceToNow } from "./utils/timeUtils";
import { ReplyPreview } from "./ReplyPreview";
import { useRef, useState, ReactNode } from "react";
import { BankrTransactionButton } from "./BankrTransactionButton";
import { toast } from "react-toastify";

// Role mentions and their styling
const ROLE_MENTIONS: Record<string, { color: string; bgColor: string }> = {
  host: { color: 'text-fireside-orange', bgColor: 'bg-fireside-orange/20' },
  'co-host': { color: 'text-purple-400', bgColor: 'bg-purple-500/20' },
  speaker: { color: 'text-green-400', bgColor: 'bg-green-500/20' },
  speakers: { color: 'text-green-400', bgColor: 'bg-green-500/20' },
  listener: { color: 'text-gray-400', bgColor: 'bg-gray-500/20' },
  listeners: { color: 'text-gray-400', bgColor: 'bg-gray-500/20' },
};

// Helper function to copy text to clipboard and show toast
const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!', { autoClose: 2000 });
  } catch (err) {
    toast.error('Failed to copy');
  }
};

// Helper function to render 0x addresses as clickable elements (for bot messages)
function render0xAddresses(text: string, keyPrefix: string = ''): ReactNode[] {
  // Match 0x followed by hexadecimal characters (addresses/hashes are typically 40 or 64 chars)
  const addressRegex = /(0x[a-fA-F0-9]+)/g;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = addressRegex.exec(text)) !== null) {
    // Add text before the address
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    
    const address = match[1];
    parts.push(
      <span
        key={`${keyPrefix}addr-${match.index}`}
        className="font-bold text-fireside-orange cursor-pointer hover:underline"
        onClick={(e) => {
          e.stopPropagation();
          copyToClipboard(address);
        }}
        title="Click to copy"
      >
        {address}
      </span>
    );
    
    lastIndex = addressRegex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

// Helper function to parse and highlight mentions in message text
function renderMessageWithMentions(text: string, isBot: boolean = false): ReactNode[] {
  // Match @username patterns (alphanumeric, underscores, dashes)
  const mentionRegex = /@([\w-]+)/g;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = mentionRegex.exec(text)) !== null) {
    // Add text before the mention
    if (match.index > lastIndex) {
      const textSegment = text.slice(lastIndex, match.index);
      if (isBot) {
        parts.push(...render0xAddresses(textSegment, `pre-${match.index}-`));
      } else {
        parts.push(textSegment);
      }
    }
    
    const mentionText = match[1];
    const roleStyle = ROLE_MENTIONS[mentionText.toLowerCase()];
    
    // Add the highlighted mention with role-specific or default styling
    if (roleStyle) {
      // Role mention
      parts.push(
        <span 
          key={`mention-${match.index}`} 
          className={`${roleStyle.color} ${roleStyle.bgColor} font-medium px-1 rounded`}
          title={`Mention all ${mentionText}`}
        >
          @{mentionText}
        </span>
      );
    } else {
      // User mention
      parts.push(
        <span 
          key={`mention-${match.index}`} 
          className="text-fireside-orange font-medium hover:underline cursor-pointer"
          title={`@${mentionText}`}
        >
          @{mentionText}
        </span>
      );
    }
    
    lastIndex = mentionRegex.lastIndex;
  }

  // Add remaining text after last mention
  if (lastIndex < text.length) {
    const remainingText = text.slice(lastIndex);
    if (isBot) {
      parts.push(...render0xAddresses(remainingText, `post-${lastIndex}-`));
    } else {
      parts.push(remainingText);
    }
  }

  // If no mentions found but is bot, still process for 0x addresses
  if (parts.length === 0 && isBot) {
    return render0xAddresses(text, 'full-');
  }

  return parts.length > 0 ? parts : [text];
}

interface ChatMessageProps {
  message: RedisChatMessage;
  isOwnMessage: boolean;
  onSelectForReply?: (message: RedisChatMessage) => void;
  onScrollToMessage?: (messageId: string) => void;
  isSelected?: boolean;
  currentUserFid?: string;
  roomId?: string;
  onTransactionComplete?: (messageId: string, txHash: string, status: 'confirmed' | 'failed') => void;
}

// Bankr AI bot avatar URL
const BANKR_BOT_AVATAR = '/assets/bankr.png';

export function ChatMessage({ message, isOwnMessage, onSelectForReply, onScrollToMessage, isSelected = false, currentUserFid, roomId, onTransactionComplete }: ChatMessageProps) {
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isLongPressing, setIsLongPressing] = useState(false);
  
  const isRedisMessage = true; // All messages are now RedisChatMessage
  
  // Check if this is a bot message
  const isBotMessage = message.isBot === true;
  const botStatus = message.status;
  
  // Get transactions if present (only for bot messages)
  const transactions = message.transactions;
  const prompterFid = message.prompterFid;
  const isPrompter = !!(currentUserFid && prompterFid && currentUserFid === prompterFid);

  // Get sender name
  const senderName = message.displayName || 'Anonymous';
  
  // Get message text
  const getMessageText = () => {
    return message.message;
  };
  
  // Get timestamp
  const getTimestamp = () => {
    return new Date(message.timestamp);
  };
  
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-gradient-to-br from-fireside-blue to-fireside-purple',
      'bg-gradient-to-br from-fireside-orange to-fireside-blue',
      'bg-gradient-to-br from-fireside-orange to-fireside-orange',
      'bg-gradient-to-br from-fireside-purple to-fireside-orange',
      'bg-gradient-to-br from-pink-400 to-purple-500',
      'bg-gradient-to-br from-blue-400 to-indigo-500',
    ];
    
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  // Get profile picture URL
  const getPfpUrl = () => {
    return message.pfp_url || '';
  };

  const pfpUrl = getPfpUrl();

  // Get message as RedisChatMessage (it already is)
  const getRedisMessage = (): RedisChatMessage => {
    return message;
  };

  // Long press handlers
  const handleTouchStart = () => {
    setIsLongPressing(true);
    longPressTimerRef.current = setTimeout(() => {
      if (onSelectForReply) {
        onSelectForReply(getRedisMessage());
        // Haptic feedback on mobile
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
      }
      setIsLongPressing(false);
    }, 500); // 500ms long press threshold
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    setIsLongPressing(false);
  };

  // Desktop click handler for reply selection
  const handleClick = (e: React.MouseEvent) => {
    // Only handle if Ctrl/Cmd key is pressed (desktop pattern)
    if ((e.ctrlKey || e.metaKey) && onSelectForReply) {
      onSelectForReply(getRedisMessage());
    }
  };

  // Get replyTo data if it exists
  const getReplyTo = () => {
    if (isRedisMessage) {
      return (message as RedisChatMessage).replyTo;
    }
    return undefined;
  };

  const replyTo = getReplyTo();

  // Bot message styling
  const getBotBubbleClass = () => {
    if (!isBotMessage) return '';
    if (botStatus === 'pending') return 'bot-bubble bot-pending';
    if (botStatus === 'failed') return 'bot-bubble bot-failed';
    return 'bot-bubble';
  };

  return (
    <div 
      className={`chat-message p-2 ${isBotMessage ? 'bot-message' : isOwnMessage ? 'own-message' : 'other-message'} ${isSelected ? 'bg-white/5 rounded-lg' : ''} ${isLongPressing ? 'opacity-70' : ''}`}
      id={`message-${(message as RedisChatMessage).id}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onClick={handleClick}
    >
      {/* Bot Avatar */}
      {isBotMessage && (
        <div className="chat-avatar flex-shrink-0">
          <div className="relative">
            <img 
              src={BANKR_BOT_AVATAR} 
              alt="Bankr AI"
              className="w-8 h-8 rounded-full object-cover ring-2 ring-blue-500"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                const fallback = e.currentTarget.nextElementSibling;
                if (fallback) (fallback as HTMLElement).classList.remove('hidden');
              }}
            />
            
           
          </div>
        </div>
      )}
      
      {/* Regular user avatar */}
      {!isOwnMessage && !isBotMessage && (
        <div className="chat-avatar flex-shrink-0">
          {pfpUrl ? (
            <>
              <img 
                src={pfpUrl} 
                alt={senderName}
                className="w-8 h-8 rounded-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const fallback = e.currentTarget.nextElementSibling;
                  if (fallback) (fallback as HTMLElement).classList.remove('hidden');
                }}
              />
              <div className={`w-8 h-8 rounded-full ${getAvatarColor(senderName)} hidden items-center justify-center text-xs font-semibold text-white`}>
                {getInitials(senderName)}
              </div>
            </>
          ) : (
            <div className={`w-8 h-8 rounded-full ${getAvatarColor(senderName)} flex items-center justify-center text-xs font-semibold text-white`}>
              {getInitials(senderName)}
            </div>
          )}
        </div>
      )}
      
      <div className="chat-message-content">
        {/* Bot header with badge */}
        {isBotMessage && (
          <div className="chat-message-header flex items-center gap-2">
            <span className="font-medium text-blue-400 text-sm">
              Bankr
            </span>
            <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded-full font-medium">
              BOT
            </span>
          </div>
        )}
        
        {/* Regular user header */}
        {!isOwnMessage && !isBotMessage && (
          <div className="chat-message-header">
            <span className="font-medium text-fireside-green text-sm">
              {senderName}
            </span>
          </div>
        )}
        
        <div className={`chat-message-bubble ${isBotMessage ? getBotBubbleClass() : isOwnMessage ? 'own-bubble' : 'other-bubble'}`}>
          {replyTo && (
            <ReplyPreview
              replyTo={replyTo}
              variant="inline"
              onClick={() => {
                if (onScrollToMessage) {
                  onScrollToMessage(replyTo.messageId);
                }
              }}
            />
          )}
          
          {/* Bot message with status indicator */}
          {isBotMessage && botStatus === 'pending' ? (
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
              <p className="text-sm text-left leading-relaxed text-blue-300 animate-pulse">
                {getMessageText()}
              </p>
            </div>
          ) : (
            <p className={`text-sm text-left leading-relaxed whitespace-pre-wrap break-words ${botStatus === 'failed' ? 'text-red-300' : ''}`}>
              {renderMessageWithMentions(getMessageText(), isBotMessage)}
            </p>
          )}
          
          {(
            <div className={`text-xs mt-1 ${isBotMessage ? 'text-blue-300/50' : 'text-white/40'} text-right`}>
              {formatDistanceToNow(getTimestamp())}
            </div>
          )}
          
          {/* Transaction button for bot messages with transactions */}
          {isBotMessage && transactions && transactions.length > 0 && roomId && (
            <BankrTransactionButton
              transactions={transactions}
              messageId={isRedisMessage ? (message as RedisChatMessage).id : ''}
              roomId={roomId}
              isPrompter={isPrompter}
              onTransactionComplete={onTransactionComplete}
            />
          )}
        </div>
      </div>
    </div>
  );
}