"use client";

import { useState, useEffect } from "react";

interface ChatStateLogicProps {
  roomId: string;
  messages: Array<any>;
  localPeerName?: string;
  userFid?: number;
}

export function useChatStateLogic({ roomId, messages, localPeerName, userFid }: ChatStateLogicProps) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [lastReadTimestamp, setLastReadTimestamp] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(`lastReadTimestamp_${roomId}`);
      return stored ? parseInt(stored, 10) : Date.now();
    }
    return Date.now();
  });
  const [unreadCount, setUnreadCount] = useState(0);

  const handleChatToggle = () => {
    const newChatState = !isChatOpen;
    setIsChatOpen(newChatState);
    
    if (newChatState) {
      const now = Date.now();
      setUnreadCount(0);
      setLastReadTimestamp(now);
      
      if (typeof window !== 'undefined') {
        localStorage.setItem(`lastReadTimestamp_${roomId}`, now.toString());
      }
    }
  };

  useEffect(() => {
    if (!isChatOpen && messages.length > 0) {
      const unreadMessages = messages.filter((message: any) => {
        if (!message.time) return false;
        
        const isAfterLastRead = message.time.getTime() > lastReadTimestamp;
        
        const isNotOwnMessage = message.sender !== localPeerName && 
                               message.senderName !== localPeerName &&
                               message.sender !== userFid?.toString();
        
        return isAfterLastRead && isNotOwnMessage;
      });
      
      setUnreadCount(unreadMessages.length);
    }
  }, [messages, lastReadTimestamp, isChatOpen, localPeerName, userFid]);

  useEffect(() => {
    if (isChatOpen) {
      setUnreadCount(0);
    }
  }, [isChatOpen]);

  return {
    isChatOpen,
    unreadCount,
    handleChatToggle
  };
}
