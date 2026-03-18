import Button from "../UI/Button";
import { IoChatbubbleSharp } from "react-icons/io5";


interface ChatButtonProps {
  isChatOpen: boolean;
  unreadCount: number;
  onClick: () => void;
}

export default function ChatButton({ isChatOpen, unreadCount, onClick }: ChatButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`w-12 aspect-square rounded-full text-xs p-2 gap-1 flex items-center border-0 justify-center transition-all duration-200 transform hover:scale-105 active:scale-95 ${
        isChatOpen
          ? "bg-neutral-orange text-white shadow-lg"
          : "bg-neutral-yellow/5 text-neutral-yellow hover:bg-neutral-yellow/20"
      }`}
      title="Toggle chat"
    >
      <IoChatbubbleSharp className="text-xl" />
      {unreadCount > 0 && !isChatOpen && (
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center ">
          {unreadCount > 9 ? "9+" : unreadCount}
        </div>
      )}
    </button>
  );
}
