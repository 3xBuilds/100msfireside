'use client'

import { MdClose, MdReply } from 'react-icons/md';

interface ReplyPreviewProps {
  replyTo: {
    messageId: string;
    message: string;
    username: string;
    pfp_url: string;
  };
  onClear?: () => void;
  onClick?: () => void;
  variant?: 'input-banner' | 'inline';
}

export function ReplyPreview({ replyTo, onClear, onClick, variant = 'inline' }: ReplyPreviewProps) {
  // Safety check for undefined message
  const messageText = replyTo?.message || '';
  const truncatedMessage = messageText.length > 50 
    ? `${messageText.substring(0, 50)}...` 
    : messageText;

  if (variant === 'input-banner') {
    return (
      <div className="px-4 py-2 bg-white/5 p-2 rounded-lg border-l-2 border-fireside-orange flex items-center justify-between">
        <div 
          className="flex items-center space-x-2 flex-1 cursor-pointer"
          onClick={onClick}
        >
          <MdReply className="text-fireside-orange flex-shrink-0" size={16} />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-fireside-orange font-medium">
              Replying to {replyTo.username}
            </p>
            <p className="text-xs text-white/60 truncate">
              {truncatedMessage}
            </p>
          </div>
        </div>
        {onClear && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            className="ml-2 p-1 hover:bg-white/10 rounded-full transition-colors"
            aria-label="Clear reply"
          >
            <MdClose size={18} className="text-white/60" />
          </button>
        )}
      </div>
    );
  }

  // Inline variant - shown above message bubble
  return (
    <div 
      className="mb-1 px-2 border-l-2 rounded-lg py-1 bg-white/30 border-fireside-orange/40 cursor-pointer hover:border-fireside-orange/60 transition-colors"
      onClick={onClick}
    >
      <div className="flex items-center justify-between space-x-1 mb-0.5">
        <MdReply className="text-white/80" size={12} />
        <p className="text-xs text-white/80 text-right font-medium">
          {replyTo.username}
        </p>
      </div>
      <p className="text-xs text-white line-clamp-2">
        {truncatedMessage}
      </p>
    </div>
  );
}
