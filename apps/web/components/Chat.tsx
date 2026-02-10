"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ChatMessage } from "./ChatMessage";
import { ReplyPreview } from "./ReplyPreview";
import { useGlobalContext } from "@/utils/providers/globalContext";
import { toast } from "react-toastify";
import sdk from "@farcaster/miniapp-sdk";
import { MdSend } from 'react-icons/md';
import { getXMTPGroupInfo, addMemberToXMTPGroup } from "@/utils/serverActions";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
} from "@/components/UI/drawer";
import { useXMTP } from "@/contexts/XMTPContext";
import { 
  formatXMTPMessages, 
  registerUserProfile, 
  type FormattedMessage 
} from "@/utils/xmtp/messageHelpers";
import { useAccount } from "wagmi";

interface ChatProps {
  isOpen: boolean;
  setIsChatOpen: () => void;
  roomId: string;
}

export default function Chat({ isOpen, setIsChatOpen, roomId }: ChatProps) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [joiningGroup, setJoiningGroup] = useState(false);
  const [selectedReplyMessage, setSelectedReplyMessage] = useState<FormattedMessage | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {address} = useAccount()

  const { user } = useGlobalContext();
  const { 
    client, 
    currentGroup, 
    messages: xmtpMessages, 
    isLoading: xmtpLoading, 
    error: xmtpError,
    joinGroup,
    sendMessage: sendXMTPMessage,
    sendReply,
    leaveGroup
  } = useXMTP();

  // Scroll to bottom function
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: "smooth",
        block: "end"
      });
    }
  }, []);

  // Register current user's profile for message formatting
  useEffect(() => {
    if (user && client?.inboxId) {
      registerUserProfile(client.inboxId, {
        fid: user.fid?.toString() || '',
        username: user.username || '',
        displayName: user.displayName || user.username || '',
        pfp_url: user.pfp_url || '',
        wallet: user.wallet || '',
      });
      console.log('✅ Registered user profile for XMTP messages');
    }
  }, [user, client?.inboxId]);

  // Join XMTP group when chat opens
  useEffect(() => {
    async function setupXMTPChat() {
      console.log('🔍 Chat setup - isOpen:', isOpen, 'roomId:', roomId, 'client:', !!client, 'currentGroup:', !!currentGroup, 'joiningGroup:', joiningGroup, 'xmtpLoading:', xmtpLoading);
      
      // Skip if already in a group or already joining
      if (!isOpen || !roomId || !client || joiningGroup || currentGroup) return;

      setJoiningGroup(true);
      setLoading(true);

      try {
        // Get XMTP group info from backend
        const env = process.env.NEXT_PUBLIC_ENV;
        let token: any = "";
        if (env !== "DEV") {
          token = (await sdk.quickAuth.getToken()).token;
        }

        const groupInfoResponse = await getXMTPGroupInfo(roomId, token);

        console.log('🔍 Group info response:', groupInfoResponse);
        
        if (!groupInfoResponse.ok || !groupInfoResponse.data?.success) {
          throw new Error('Failed to get XMTP group information');
        }

        const { xmtpGroupId, exists } = groupInfoResponse.data.data;

        if (!exists || !xmtpGroupId) {
          toast.info('Chat group is being set up. Please try again in a moment.');
          return;
        }

        // Try to join the group
        console.log(`🔄 Attempting to join XMTP group ${xmtpGroupId}...`);
        const joined = await joinGroup(xmtpGroupId);

        if (!joined) {
          // User not in group yet, request to be added
          console.log('📝 Requesting to be added to XMTP group...', roomId, token);
          const addMemberResponse = await addMemberToXMTPGroup(roomId, address || '', token);

          if (addMemberResponse.ok && addMemberResponse.data?.success) {
            toast.info('You have been added to the chat. Refreshing...');
            
            // Wait a moment for the group to update, then try joining again
            setTimeout(async () => {
              await joinGroup(xmtpGroupId);
            }, 2000);
          } else {
            const errorMsg = addMemberResponse.data?.error || addMemberResponse.data?.message || 'Failed to join chat';
            if (errorMsg.includes('not registered on the XMTP network')) {
              toast.error('Please complete XMTP registration by signing the message prompt');
            } else {
              toast.error(errorMsg);
            }
          }
        } else {
          console.log('✅ Successfully joined XMTP group');
        }
      } catch (error: any) {
        console.error('❌ Failed to setup XMTP chat:', error);
        if (error?.message?.includes('not registered') || error?.message?.includes('XMTP network')) {
          toast.error('XMTP registration required. Please sign the initialization message.');
        } else {
          toast.error('Unable to connect to chat');
        }
      } finally {
        setLoading(false);
        setJoiningGroup(false);
      }
    }

    setupXMTPChat();
  }, [isOpen, roomId, client, currentGroup, joiningGroup, joinGroup]);

  // Leave group when chat closes
  useEffect(() => {
    if (!isOpen && currentGroup) {
      leaveGroup();
    }
  }, [isOpen, currentGroup, leaveGroup]);

  // Auto-scroll to bottom when new messages arrive or chat opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(scrollToBottom, 300);
    }
  }, [isOpen, xmtpMessages, scrollToBottom]);



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
    if (!message.trim() || !currentGroup) return;

    const messageText = message.trim();
    
    setMessage(""); // Clear input immediately
    const replyMessage = selectedReplyMessage;
    setSelectedReplyMessage(null); // Clear reply selection
    
    // Reset textarea height after clearing message
    setTimeout(() => {
      adjustTextareaHeight();
      scrollToBottom();
    }, 0);

    try {
      // Send via XMTP
      if (replyMessage) {
        await sendReply(messageText, replyMessage.id);
      } else {
        await sendXMTPMessage(messageText);
      }

      setTimeout(scrollToBottom, 100);
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message. Please try again.');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Handler for selecting a message to reply to
  const handleSelectForReply = (msg: FormattedMessage) => {
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

  // Format XMTP messages for display
  const formattedMessages = formatXMTPMessages(xmtpMessages, client?.inboxId);

  return (
    <Drawer open={isOpen} onOpenChange={setIsChatOpen}>
      <DrawerContent className="gradient-orange-bg backdrop-blur-lg border-fireside-orange/20 text-white">
        <DrawerHeader className="border-b border-fireside-lightWhite">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <h2 className="text-xl font-bold">Chat</h2>
              {xmtpLoading && (
                <span className="text-sm text-fireside-lightWhite">Connecting...</span>
              )}
              {currentGroup && (
                <span className="text-sm text-green-400">● Connected</span>
              )}
            </div>
          </div>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-4 py-6 max-h-[90vh]">
          {loading || joiningGroup || xmtpLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-fireside-orange mx-auto mb-4"></div>
                <p className="text-fireside-lightWhite">
                  {xmtpLoading ? 'Initializing XMTP...' : joiningGroup ? 'Joining chat...' : 'Loading messages...'}
                </p>
              </div>
            </div>
          ) : !currentGroup ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
              <p className="text-fireside-lightWhite mb-4">
                {xmtpError 
                  ? 'Unable to connect to chat. Please try again.' 
                  : !client
                  ? 'Setting up chat client...'
                  : 'Chat is not available yet.'}
              </p>
              {xmtpError && (
                <p className="text-sm text-red-400">{xmtpError.message}</p>
              )}
              {!client && !xmtpError && (
                <div className="mt-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-fireside-orange mx-auto"></div>
                </div>
              )}
            </div>
          ) : formattedMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
              <div className="bg-fireside-orange/10 rounded-full p-6 mb-4">
                <svg className="w-16 h-16 text-fireside-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">No messages yet</h3>
              <p className="text-fireside-lightWhite text-sm max-w-xs">
                Be the first to start the conversation! Send a message to get things going.
              </p>
            </div>
          ) : (
            <div className="space-y-4 pb-4">
              {formattedMessages.map((msg) => (
                <ChatMessage
                  key={msg.id}
                  message={msg}
                  onReply={handleSelectForReply}
                  onScrollToReply={handleScrollToMessage}
                  currentUserFid={user?.fid?.toString() || ''}
                />
              ))}
              <div ref={messagesEndRef} className="h-1" />
            </div>
          )}
        </div>

        <DrawerFooter className="border-t border-fireside-lightWhite">
          {selectedReplyMessage && (
            <ReplyPreview
              replyTo={selectedReplyMessage.replyTo!}
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
              placeholder={currentGroup ? "Type a message..." : "Connecting to chat..."}
              disabled={!currentGroup}
              className="w-full px-4 py-3 bg-white/5 text-white rounded-lg border border-fireside-lightWhite focus:border-fireside-darkWhite focus:ring-2 focus:ring-fireside-orange transition-colors duration-200 outline-none resize-none min-h-[48px] text-base disabled:opacity-50 disabled:cursor-not-allowed"
              maxLength={500}
              rows={1}
              onFocus={() => setTimeout(scrollToBottom, 300)}
            />
            <button
              onClick={handleSendMessage}
              disabled={!message.trim() || !currentGroup}
              className="w-12 h-12 bg-fireside-orange aspect-square text-white rounded-lg flex items-center justify-center transition-all hover:bg-fireside-orange/80 disabled:bg-fireside-orange disabled:opacity-30"
              title="Send message"
            >
              <MdSend size={20} />
            </button>
          </div>
          {message.length > 400 && (
            <div className="text-xs text-right text-fireside-lightWhite">
              {message.length}/500
            </div>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}