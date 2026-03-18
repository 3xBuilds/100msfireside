'use client'

import { LogOut } from "lucide-react";
import { useAgoraContext } from "@/contexts/AgoraContext";
import { useState } from 'react';
import RoomEndModal from './RoomEndModal';
import { TbShare3 } from "react-icons/tb";
import { MdCopyAll, MdOutlineIosShare } from "react-icons/md";
import { FaXTwitter } from "react-icons/fa6";
import { toast } from "react-toastify";
import Button from '@/components/UI/Button';
import { StarRings } from "./experimental";
import { ConnectButton } from "@rainbow-me/rainbowkit";

interface HeaderProps {
  onToggleChat?: () => void;
  isChatOpen?: boolean;
  roomId?: string;
}
import Image from "next/image";
import { useRouter } from "next/navigation";
import FiresideLogo from "./UI/firesideLogo";

export default function Header({ onToggleChat, isChatOpen = false, roomId }: HeaderProps) {
  const { isConnected, localPeer, leave } = useAgoraContext();
  const router = useRouter();
  const [showRoomEndModal, setShowRoomEndModal] = useState(false);
  const [isShareMenuOpen, setIsShareMenuOpen] = useState(false);

  const isHost = localPeer?.roleName === 'host';

  const handleLeaveClick = () => {
    if (isHost) {
      setShowRoomEndModal(true);
    } else {
      // Direct leave for other roles
      leave();
      router.push('/');
    }
  };

  const handleCopyURL = () => {
    const roomURL = `${window.location.origin}/call/${roomId}`;
    navigator.clipboard.writeText(roomURL).then(() => {
      toast.success("Room URL copied to clipboard!");
    }).catch((error) => {
      console.error("Failed to copy URL:", error);
      toast.error("Failed to copy URL to clipboard");
    });
  };

  const handleShareOnTwitter = () => {
    const roomURL = `${window.location.origin}/call/${roomId}`;
    const text = "Come join the conversation on Fireside!";
    const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(roomURL)}`;
    window.open(intentUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-fireside-darkOrange px-6 h-16 my-auto relative overflow-hidden">
        {/* Background visual effect */}
        <div className="absolute -top-10 -right-10 pointer-events-none opacity-30">
          <StarRings />
        </div>
        
        <div className="max-w-7xl h-full mx-auto flex items-center justify-between relative z-10">
          <div className="flex items-start justify-start space-x-4">
            <FiresideLogo className="w-32 justify-start"/>
          </div>
          <div className="flex items-center space-x-3">
            {!isConnected && (
              <ConnectButton accountStatus="avatar" chainStatus="none" showBalance={false} />
            )}
            {isConnected && (
              <>
                {roomId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsShareMenuOpen((prev) => !prev)}
                    className="relative z-50 flex items-center space-x-2"
                    title="Share"
                  >
                    <TbShare3 className="w-5 h-5" />
                    
                  </Button>
                )}
                <ConnectButton accountStatus="avatar" chainStatus="none" showBalance={false} />
                <Button
                  id="leave-btn"
                  variant="ghost"
                  size="sm"
                  className="bg-fireside-red px-2 py-1 flex items-center"
                  onClick={handleLeaveClick}
                >
                  <LogOut className="w-6 h-6" />
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Share Menu Overlay */}
      <div onClick={() => setIsShareMenuOpen(false)} className={`fixed top-0 left-0 h-screen w-screen bg-black/30 duration-200 z-[1000] ${isShareMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}>
        {isShareMenuOpen && (
          <div className="absolute right-4 top-16 border border-white/10 mb-2 w-40 bg-gray-800 text-white rounded-lg ">
            <Button
              variant="ghost"
              onClick={() => {
                setIsShareMenuOpen(false);
                handleShareOnTwitter();
              }}
              className="w-full px-4 py-2 text-left hover:bg-gray-700 flex items-center space-x-2 rounded-none rounded-t-lg shadow-none"
            >
              <FaXTwitter className="w-5 h-5" />
              <span>Share on X</span>
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setIsShareMenuOpen(false);
                handleCopyURL();
              }}
              className="w-full px-4 py-2 text-left hover:bg-gray-700 flex items-center space-x-2 rounded-none rounded-b-lg shadow-none"
            >
              <MdCopyAll className="w-5 h-5" />
              <span>Copy URL</span>
            </Button>
          </div>
        )}
      </div>

      {/* Room End Modal */}
      {showRoomEndModal && roomId && (
        <RoomEndModal
          isVisible={showRoomEndModal}
          onClose={() => setShowRoomEndModal(false)}
          roomId={roomId}
        />
      )}
    </>
  );
}
