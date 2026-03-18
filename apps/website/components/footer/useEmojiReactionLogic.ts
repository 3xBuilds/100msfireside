"use client";

import { useState } from "react";
import { useEmojiReactionEvent } from "@/utils/events";

interface FloatingEmoji {
  emoji: string;
  sender: string;
  id: number;
  position: number;
  fontSize: string;
}

interface EmojiReactionLogicProps {
  user: any;
}

export function useEmojiReactionLogic({ user }: EmojiReactionLogicProps) {
  const [floatingEmojis, setFloatingEmojis] = useState<FloatingEmoji[]>([]);
  const [isDisabled, setIsDisabled] = useState(false);
  
  const { sendEmoji } = useEmojiReactionEvent((msg: { emoji: string; sender: string }) => {
    
    const uniqueMsg = {
      ...msg,
      id: Date.now(),
      position: Math.random() * 30,
      fontSize: (Math.random() * 0.5 + 1).toFixed(1)
    };
    setFloatingEmojis((prev) => [...prev, uniqueMsg]);

    setTimeout(() => {
      setFloatingEmojis((prev) => prev.filter((e) => e.id !== uniqueMsg.id));
    }, 5000);
  });

  const handleEmojiSelect = (emoji: { emoji: string }) => {
    if (isDisabled) return;

    sendEmoji(emoji.emoji, user?.pfp_url);
    setIsDisabled(true);
    
    setTimeout(() => {
      setIsDisabled(false);
    }, 1500);
  };

  return {
    floatingEmojis,
    handleEmojiSelect,
    isDisabled
  };
}
