import Button from "../UI/Button";
import { MdEmojiEmotions } from "react-icons/md";


interface EmojiButtonProps {
  onClick: () => void;
  className?: string;
}

export default function EmojiButton({ onClick, className }: EmojiButtonProps) {
  return (
    <button
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
      className={`w-12 aspect-square text-xs gap-1 font-bold p-2 border-0 overflow-visible rounded-full bg-neutral-blue/5 text-neutral-blue border-neutral-blue/30 flex items-center justify-center transition-all duration-200 transform hover:scale-105 active:scale-95 hover:white/20 cursor-pointer select-none focus:bg-neutral-blue/5 focus:text-neutral-blue active:bg-neutral-blue/5 active:text-neutral-blue`}
      title="reactions"
      role="button"
    >
      <MdEmojiEmotions className="text-2xl" />
    </button>
  );
}
