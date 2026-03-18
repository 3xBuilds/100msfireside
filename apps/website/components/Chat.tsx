"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAgoraContext, AgoraPeer } from "@/contexts/AgoraContext";
import { ChatMessage } from "./ChatMessage";
import { ReplyPreview } from "./ReplyPreview";
import { MentionPopup } from "./MentionPopup";
import { useGlobalContext } from "@/utils/providers/globalContext";
import { toast } from "react-toastify";
import { getAuthToken } from "@/utils/auth";
import { MdClose, MdSend } from 'react-icons/md';
import { fetchChatMessages } from "@/utils/serverActions";
import { useChatWebSocket } from "@/hooks/useChatWebSocket";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
} from "@/components/UI/drawer";

interface ChatProps {
  isOpen: boolean;
  setIsChatOpen: () => void;
  roomId: string;
}

export default function Chat({ isOpen, setIsChatOpen, roomId }: ChatProps) {
  const [message, setMessage] = useState("");
  const [redisMessages, setRedisMessages] = useState<RedisChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedReplyMessage, setSelectedReplyMessage] = useState<RedisChatMessage | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Mention popup state
  const [showMentionPopup, setShowMentionPopup] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStartIndex, setMentionStartIndex] = useState(0);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);

  const { localPeer, remotePeers } = useAgoraContext();
  const peers = (() => {
    const allPeers: AgoraPeer[] = [];
    if (localPeer) allPeers.push(localPeer);
    remotePeers.forEach((p) => allPeers.push(p));
    return allPeers;
  })();
  const { user } = useGlobalContext();

  // Scroll to bottom function
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: "smooth",
        block: "end"
      });
    }
  }, []);

  // WebSocket callbacks for real-time chat
  const onNewMessage = useCallback((msg: RedisChatMessage) => {
    setRedisMessages(prev => {
      // Deduplicate by message ID
      if (prev.some(m => m.id === msg.id)) return prev;
      return [...prev, msg];
    });
    setTimeout(scrollToBottom, 100);
  }, [scrollToBottom]);

  const onMessageUpdated = useCallback((msg: RedisChatMessage) => {
    setRedisMessages(prev =>
      prev.map(m => m.id === msg.id ? msg : m)
    );
    setTimeout(scrollToBottom, 100);
  }, [scrollToBottom]);

  const onMessagesDeleted = useCallback((_roomId: string) => {
    setRedisMessages([]);
  }, []);

  const onWsError = useCallback((error: string) => {
    console.error('[Chat WS Error]:', error);
  }, []);

  const { isConnected, sendMessage: wsSendMessage } = useChatWebSocket(roomId, {
    onNewMessage,
    onMessageUpdated,
    onMessagesDeleted,
    onError: onWsError,
  });

  useEffect(() => {
    const loadMessages = async () => {
      if (!roomId) return;

      setLoading(true);
      try {
        const token = getAuthToken() || "";

        const response = await fetchChatMessages(roomId, 50);
        
        if (response.ok && response.data.success) {
          setRedisMessages(response.data.data.messages);
        } else {
          console.error('Failed to load messages:', response.data.error);
        }
      } catch (error) {
        console.error('Failed to load messages:', error);
        toast.error('Unable to load chat messages');
      } finally {
        setLoading(false);
      }
    };

    loadMessages();
  }, [roomId]);

  // Auto-scroll to bottom when new messages arrive or chat opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(scrollToBottom, 300);
    }
  }, [isOpen, redisMessages, scrollToBottom]);



  // Auto-resize textarea based on content
  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const scrollHeight = textarea.scrollHeight;
      const maxHeight = 120; // Maximum height in pixels (roughly 4-5 lines)
      const minHeight = 48; // Minimum height in pixels
      
      if (scrollHeight <= maxHeight) {
        textarea.style.height = `${Math.max(scrollHeight, minHeight)}px`;
        textarea.style.overflowY = 'hidden';
      } else {
        textarea.style.height = `${maxHeight}px`;
        textarea.style.overflowY = 'auto';
      }
    }
  };

  // Adjust height when message changes
  useEffect(() => {
    adjustTextareaHeight();
  }, [message]);

  const handleSendMessage = async () => {
    if (!message.trim() || !user?.fid) return;

    const messageText = message.trim();
    const replyToId = selectedReplyMessage?.id;
    
    setMessage(""); // Clear input immediately
    setSelectedReplyMessage(null); // Clear reply selection
    
    // Reset textarea height after clearing message
    setTimeout(() => {
      adjustTextareaHeight();
      scrollToBottom();
    }, 0);

    try {
      const token = getAuthToken() || "";

      // Send via WebSocket for real-time delivery
      wsSendMessage(messageText, replyToId, token);
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Error sending message. Please try again.');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    // Don't submit if mention popup is open (let it handle navigation)
    if (showMentionPopup && ['ArrowUp', 'ArrowDown', 'Enter', 'Tab', 'Escape'].includes(e.key)) {
      return; // MentionPopup handles these keys
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Handle message input change with mention detection
  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    setMessage(value);

    // Detect @ mentions
    const textBeforeCursor = value.substring(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@(\w*)$/);

    if (atMatch) {
      const query = atMatch[1];
      const startIndex = cursorPos - query.length - 1; // -1 for @
      setMentionQuery(query);
      setMentionStartIndex(startIndex);
      setShowMentionPopup(true);
      setSelectedMentionIndex(0);
    } else {
      setShowMentionPopup(false);
      setMentionQuery("");
    }
  };

  // Handle mention selection
  const handleMentionSelect = (peer: AgoraPeer | null, displayText: string) => {
    const beforeMention = message.substring(0, mentionStartIndex);
    const afterMention = message.substring(mentionStartIndex + mentionQuery.length + 1); // +1 for @
    const newMessage = `${beforeMention}@${displayText} ${afterMention}`;
    
    setMessage(newMessage);
    setShowMentionPopup(false);
    setMentionQuery("");
    
    // Focus back on textarea and set cursor position
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newCursorPos = mentionStartIndex + displayText.length + 2; // @ + name + space
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  // Close mention popup
  const handleMentionClose = () => {
    setShowMentionPopup(false);
    setMentionQuery("");
  };

  // Handler for selecting a message to reply to
  const handleSelectForReply = (msg: RedisChatMessage) => {
    setSelectedReplyMessage(msg);
    // Focus the textarea after selection
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 100);
  };

  // Handler for clearing reply selection
  const handleClearReply = () => {
    setSelectedReplyMessage(null);
  };

  // Scroll to a specific message
  const handleScrollToMessage = (messageId: string) => {
    const messageElement = document.getElementById(`message-${messageId}`);
    if (messageElement) {
      messageElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
      // Add temporary highlight effect
      messageElement.classList.add('highlight-flash');
      setTimeout(() => {
        messageElement.classList.remove('highlight-flash');
      }, 2000);
    }
  };



  // Helper function to validate message structure
  const isValidMessageStructure = (msg: any): boolean => {
    if (!msg || typeof msg !== 'object') return false;
    
    // For Redis messages
    if ('timestamp' in msg && 'message' in msg && typeof msg.message === 'string') return true;
    
    return false;
  };

  // Use Redis messages as single source of truth
  const validRedisMessages = redisMessages.filter(isValidMessageStructure);

  const combinedMessages = [...validRedisMessages]
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Always render, but control visibility through CSS classes
  // const modalClass = `chat-modal ${isOpen ? 'open' : ''} ${isClosing ? 'closing' : ''}`;

  return (
    <Drawer open={isOpen} onOpenChange={setIsChatOpen}>
      <DrawerContent className="gradient-orange-bg backdrop-blur-lg border-fireside-orange/20 text-white ">
        <DrawerHeader className="border-b border-fireside-lightWhite">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 bg-fireside-orange rounded-full animate-pulse"></div>
              <DrawerTitle className="text-xl font-semibold text-white">Room Chat</DrawerTitle>
            </div>
          </div>
          <p className="text-xs text-white/50 mt-2">
            💡 Type <span className="text-fireside-orange font-mono">/bankr</span> followed by a question to ask Bankr AI. Reply to Bankr to continue the conversation.
          </p>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-2 py-6 max-h-[90vh] ">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-white text-sm">Loading messages...</div>
            </div>
          ) : combinedMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
              <div className="w-12 h-12 bg-gray-100/20 rounded-full flex items-center justify-center mb-3">
                <svg
                  className="w-6 h-6 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>
              <p className="text-sm text-white mb-1">No messages yet</p>
              <p className="text-xs text-gray-400">Start the conversation!</p>
            </div>
          ) : (
            <div className="space-y-4 pb-4">
              {combinedMessages.map((msg) => {
                const isOwn = String(msg.userId) === String(user?.fid);
                const isSelected = selectedReplyMessage?.id === msg.id;
                return (
                  <ChatMessage
                    key={msg.id}
                    message={msg}
                    isOwnMessage={isOwn}
                    onSelectForReply={handleSelectForReply}
                    onScrollToMessage={handleScrollToMessage}
                    isSelected={isSelected}
                    currentUserFid={user?.fid?.toString()}
                    roomId={roomId}
                  />
                );
              })}
              <div ref={messagesEndRef} className="h-1" />
            </div>
          )}
        </div>

        <DrawerFooter className="border-t border-fireside-lightWhite">
          {selectedReplyMessage && (
            <ReplyPreview
              replyTo={{
                messageId: selectedReplyMessage.id,
                message: selectedReplyMessage.message,
                username: selectedReplyMessage.username,
                pfp_url: selectedReplyMessage.pfp_url
              }}
              variant="input-banner"
              onClear={handleClearReply}
              onClick={() => handleScrollToMessage(selectedReplyMessage.id)}
            />
          )}
          <div className="relative flex items-start space-x-3">
            {/* Mention Popup */}
            {showMentionPopup && (
              <MentionPopup
                peers={peers}
                query={mentionQuery}
                onSelect={handleMentionSelect}
                onClose={handleMentionClose}
                selectedIndex={selectedMentionIndex}
                onSelectedIndexChange={setSelectedMentionIndex}
              />
            )}
            
              <textarea
                ref={textareaRef}
                value={message}
                onChange={handleMessageChange}
                onKeyDown={(e) => {
                  // Prevent default for keys handled by mention popup
                  if (showMentionPopup && ['ArrowUp', 'ArrowDown', 'Enter', 'Tab', 'Escape'].includes(e.key)) {
                    e.preventDefault();
                  }
                }}
                onKeyPress={handleKeyPress}
                placeholder="Type a message... Use @ to mention"
                className="w-full px-4 py-3 bg-white/5 text-white rounded-lg border border-fireside-lightWhite focus:border-fireside-darkWhite focus:ring-2 focus:ring-fireside-orange transition-colors duration-200 outline-none resize-none min-h-[48px] text-base"
                maxLength={500}
                rows={1}
                onFocus={() => setTimeout(scrollToBottom, 300)}
              />
           
            <button
              onClick={handleSendMessage}
              disabled={!message.trim()}
              className="w-12 h-12 bg-fireside-orange aspect-square text-white rounded-lg flex items-center justify-center transition-all hover:bg-fireside-orange/80 disabled:bg-fireside-orange disabled:opacity-30"
              title="Send message"
            >
              <MdSend size={20} />
            </button>
          </div>
          {message.length > 400 && (
            <div className="text-xs text-gray-400 mt-2 text-right">
              {message.length}/500
            </div>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}