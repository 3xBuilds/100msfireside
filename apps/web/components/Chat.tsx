"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  selectHMSMessages,
  selectLocalPeer,
  useHMSActions,
  useHMSStore,
  HMSMessage,
} from "@100mslive/react-sdk";
import { ChatMessage } from "./ChatMessage";
import { ReplyPreview } from "./ReplyPreview";
import { useGlobalContext } from "@/utils/providers/globalContext";
import { toast } from "react-toastify";
import sdk from "@farcaster/miniapp-sdk";
import { MdClose, MdSend } from 'react-icons/md';
import { fetchChatMessages, sendChatMessage } from "@/utils/serverActions";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
} from "@/components/UI/drawer";
import { Client } from '@xmtp/browser-sdk';
import { useXMTPSigner } from '@/hooks';

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

  const messages = useHMSStore(selectHMSMessages);
  const hmsActions = useHMSActions();
  const { user } = useGlobalContext();

  // XMTP integration
  const { signer, isLoading: signerLoading, error: signerError } = useXMTPSigner();
  const [xmtpClient, setXmtpClient] = useState<Client | null>(null);
  const [isXmtpInitializing, setIsXmtpInitializing] = useState(false);

  // Initialize XMTP client when signer is available
  useEffect(() => {
    async function initializeXMTP() {
      if (!signer || xmtpClient || isXmtpInitializing) return;

      setIsXmtpInitializing(true);
      try {
        console.log('🔄 Initializing XMTP client...');
        const client = await Client.create(signer, {
          env: 'production',
        });
        setXmtpClient(client);
        console.log('✅ XMTP client initialized:', client.inboxId);
      } catch (error) {
        console.error('❌ Failed to initialize XMTP client:', error);
      } finally {
        setIsXmtpInitializing(false);
      }
    }

    initializeXMTP();
  }, [signer, xmtpClient, isXmtpInitializing]);

  // Scroll to bottom function
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: "smooth",
        block: "end"
      });
    }
  }, []);

  useEffect(() => {
    const loadMessages = async () => {
      if (!roomId) return;

      setLoading(true);
      try {
        const env = process.env.NEXT_PUBLIC_ENV;
        
        var token: any = "";
        if (env !== "DEV") {
          token = (await sdk.quickAuth.getToken()).token;
        };

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
  }, [isOpen, messages, redisMessages, scrollToBottom]);



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
    const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
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
      // Send to HMS for real-time broadcast
      // Format the message to include user fid and reply metadata for identification
      const messageWithMetadata = JSON.stringify({
        text: messageText,
        userFid: user.fid,
        pfp_url: user.pfp_url || '',
        username: user.username || '',
        displayName: user.displayName || user.username || '',
        type: 'chat',
        replyTo: selectedReplyMessage ? {
          messageId: selectedReplyMessage.id,
          message: selectedReplyMessage.message.substring(0, 100),
          username: selectedReplyMessage.username,
          pfp_url: selectedReplyMessage.pfp_url
        } : undefined
      });
      hmsActions.sendBroadcastMessage(messageWithMetadata);

      const env = process.env.NEXT_PUBLIC_ENV;
        
      var token: any = "";
      if (env !== "DEV") {
        token = (await sdk.quickAuth.getToken()).token;
      };

      // Store in Redis for persistence
      const response = await sendChatMessage(
        roomId,
        {
          message: messageText,
          replyToId: replyToId
        },
        token
      );

      if (response.ok && response.data.success) {
        // Add the new message to our local state
        setRedisMessages(prev => [...prev, response.data.data.message]);
        setTimeout(scrollToBottom, 100);
      } else {
        console.error('Failed to store message:', response.data.error);
        toast.error('Failed to send message. Please try again.');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // toast.error('Error sending message. Please try again.');
      // Could show a retry option here
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
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
    
    // For HMS messages
    if ('time' in msg && 'message' in msg) {
      // Check if the message is a JSON string containing our metadata
      try {
        const parsedMessage = JSON.parse(msg.message);
        return typeof parsedMessage === 'object' && 'text' in parsedMessage;
      } catch (e) {
        // If it's not parseable as JSON, check if it's a plain string message
        return typeof msg.message === 'string';
      }
    }
    
    return false;
  };

  // Filter and combine messages
  const validRedisMessages = redisMessages.filter(isValidMessageStructure);
  const validHMSMessages = messages
    .filter(msg => {
      if (!isValidMessageStructure(msg)) return false;
      
      // Check if this message already exists in Redis
      // For HMS messages that contain JSON, we need to extract the text part
      let messageText;
      try {
        const parsedMsg = JSON.parse(msg.message);
        messageText = parsedMsg.text;
      } catch (e) {
        messageText = msg.message;
      }

      return !validRedisMessages.some(redisMsg =>
        redisMsg.message === messageText &&
        Math.abs(new Date(redisMsg.timestamp).getTime() - msg.time.getTime()) < 5000
      );
    })
    .map(hmsMsg => {
      // Try to parse the message as JSON to extract user fid
      let messageText = hmsMsg.message;
      let messageFid = '';
      let messagePfpUrl = '';
      let messageUsername = '';
      let messageDisplayName = '';
      let messageReplyTo = undefined;
      
      try {
        const parsedMsg = JSON.parse(hmsMsg.message);
        messageText = parsedMsg.text;
        messageFid = parsedMsg.userFid || '';
        messagePfpUrl = parsedMsg.pfp_url || '';
        messageUsername = parsedMsg.username || '';
        messageDisplayName = parsedMsg.displayName || '';
        messageReplyTo = parsedMsg.replyTo;
      } catch (e) {
        // If parsing fails, use the message as is
        messageText = hmsMsg.message;
      }
      
      return {
        id: `hms_${hmsMsg.id}`,
        roomId: roomId,
        userId: messageFid || user.fid || hmsMsg.sender || 'unknown',
        username: messageUsername || hmsMsg.senderName || hmsMsg.sender || 'Unknown',
        displayName: messageDisplayName || hmsMsg.senderName || hmsMsg.sender || 'Unknown',
        pfp_url: messagePfpUrl,
        message: messageText,
        timestamp: hmsMsg.time.toISOString(),
        type: 'text' as const,
        replyTo: messageReplyTo
      };
    });

  const combinedMessages = [...validRedisMessages, ...validHMSMessages]
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
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-4 py-6 max-h-[90vh] ">
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
          <div className="flex items-start space-x-3">
            
              <textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type a message..."
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