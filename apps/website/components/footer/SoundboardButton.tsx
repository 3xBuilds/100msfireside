"use client";

import Button from "../UI/Button";
import { BsSoundwave } from "react-icons/bs";
import { useGlobalContext } from "@/utils/providers/globalContext";


interface SoundboardButtonProps {
  onClick: () => void;
  isPlaying?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * SoundboardButton - Button to open the soundboard drawer
 * 
 * Styled to match other footer buttons (emoji, hand raise, etc.)
 */
export default function SoundboardButton({
  onClick,
  isPlaying = false,
  disabled = false,
  className = "",
}: SoundboardButtonProps) {

  const {user} = useGlobalContext()

  if(user.soundboardEligible !== undefined)
  return (
    <Button
      variant="ghost"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!disabled && user?.soundboardEligible) {
          onClick();
        }
      }}
      active={isPlaying}
      disabled={disabled || user?.soundboardEligible === false}
      className={`w-full h-14 text-lg font-bold p-2 overflow-visible rounded-lg disabled:opacity-50 bg-neutral-purple focus:scale-100 text-white focus:bg-neutral-purple active:text-white active:bg-neutral-purple focus:text-white flex flex-col items-center justify-center transition-all duration-200 transform hover:scale-105 active:scale-95 hover:white/20 cursor-pointer select-none ${
        isPlaying ? "animate-pulse bg-fireside-orange/20 text-fireside-orange" : ""
      } ${disabled || user?.soundboardEligible === false ? "opacity-50 cursor-not-allowed" : ""} ${className}`}
      title="Soundboard"
      role="button"
    ><div className="flex gap-2 items-center ">
    <BsSoundwave className={`text-xl ${isPlaying ? "text-fireside-orange" : ""}`} /> Soundboard
    </div>
      
      {user?.soundboardEligible === false && (
        <span className="block text-white text-xs font-bold px-2 rounded-full select-none">
          Requires 1M $FIRE
        </span>
      )}
    </Button>
  );
}

