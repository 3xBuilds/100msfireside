"use client";

import { useEffect, useRef } from "react";
import EmojiPicker, { Theme } from "emoji-picker-react";
import { ListGroup } from "../experimental";
import { Card } from "../UI/Card";

interface EmojiPickerDrawerProps {
  isOpen: boolean;
  onEmojiSelect: (emoji: { emoji: string }) => void;
  onClose: () => void;
  isDisabled?: boolean;
}

export default function EmojiPickerDrawer({ isOpen, onEmojiSelect, onClose, isDisabled = false }: EmojiPickerDrawerProps) {
  const pickerRef = useRef<HTMLDivElement>(null);
  
  const emojiPickerStyles = {
    backgroundColor: "#361e14",
    "--epr-category-label-bg-color": "#361e14",
    borderRadius: "0.5rem",
    width: "100%",
    height: "500px",
    margin: "auto",
    zIndex: 100000
  };

  const EMOJIS = [
  { emoji: "🔥", label: "Fire" },
  { emoji: "😂", label: "Laughing" },
  { emoji: "😢", label: "Sad" },
  { emoji: "💯", label: "100" },
  { emoji: "❤️", label: "Heart" },
  { emoji: "👍", label: "Thumb up" },
  { emoji: "👎", label: "Thumb down" },
];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isDisabled) return;
      const target = event.target as HTMLElement;
      
      // Check if click is inside picker or on the emoji button (including its children)
      if (pickerRef.current && !pickerRef.current.contains(target)) {
        // Check if the clicked element or any of its parents is the emoji button
        const isEmojiButton = target.closest('[aria-label="React"]');
        if (!isEmojiButton) {
          onClose();
        }
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose, isDisabled]);

  const handleEmojiClick = (emoji: string) => {
    onEmojiSelect({ emoji });
  };

  if (!isOpen) return null;

  return (
    <div
      ref={pickerRef}
      className={`fixed left-0 right-0 bottom-[8rem] z-[10000] w-full mx-auto transition-all flex items-center justify-center duration-200 ${
        isOpen ? "" : "opacity-0 pointer-events-none"
      } ${isDisabled ? "pointer-events-none" : ""} rounded-t-xl`}
    >
      {/* <ListGroup title="Pick an Emoji" > */}
<Card
        variant="gradient"
        className="rounded-2xl p-2"
      >
        <div className="grid grid-cols-7 gap-2">
          {EMOJIS.map((item) => (
            <button
              key={item.emoji}
              onClick={() => handleEmojiClick(item.emoji)}
              className="aspect-square flex items-center justify-center text-4xl hover:scale-110 active:scale-95 transition-transform rounded-xl hover:bg-white/10"
              aria-label={item.label}
              disabled={isDisabled}
            >
              {item.emoji}
            </button>
          ))}
        </div>
      </Card>
      {/* </ListGroup> */}
      
    </div>
  );
}
