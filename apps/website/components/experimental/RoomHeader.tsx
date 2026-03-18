'use client'
import { TOKENS, LiveBadge, AdsToggle, StarRings } from ".";
import { useState, useEffect } from 'react';
import { LogOut } from "lucide-react";
import { TbShare3 } from "react-icons/tb";
import { MdCopyAll, MdOutlineIosShare } from "react-icons/md";
import { FaXTwitter } from "react-icons/fa6";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";
import { useAgoraContext } from "@/contexts/AgoraContext";
import RoomEndModal from "../RoomEndModal";
import { fetchRoomDetails } from "@/utils/serverActions";

interface RoomHeaderProps {
  roomId: string;
  title?: string;
  tagline?: string;
  live?: boolean;
  adsOn?: boolean;
  onAdsToggle?: () => void;
}

export function RoomHeader({
  roomId,
  title: propTitle,
  tagline: propTagline,
  live = false,
  adsOn = false,
  onAdsToggle,
}: RoomHeaderProps) {
  const [isShareMenuOpen, setIsShareMenuOpen] = useState(false);
  const [showRoomEndModal, setShowRoomEndModal] = useState(false);
  const [roomDetails, setRoomDetails] = useState<{ name: string; description: string } | null>(null);
  const router = useRouter();
  const { localPeer, isConnected, leave } = useAgoraContext();

  const isHost = localPeer?.roleName === 'host';

  useEffect(() => {
    if (!propTitle || !propTagline) {
      const getRoomDetails = async () => {
        try {
          const response = await fetchRoomDetails(roomId);
          if (response.data.success) {
            setRoomDetails({ 
              name: response.data.data.room.name, 
              description: response.data.data.room.description
            });
          }
        } catch (error) {
          console.error('Error fetching room details:', error);
        }
      };
      getRoomDetails();
    }
  }, [roomId, propTitle, propTagline]);

  const title = propTitle || roomDetails?.name || "Loading...";
  const tagline = propTagline || roomDetails?.description || "";

  const handleLeaveClick = () => {
    if (isHost) {
      setShowRoomEndModal(true);
    } else {
      leave();
      router.push('/');
    }
  };

  async function composeCast() {
    try {
      const roomURL = `${window.location.origin}/call/${roomId}`;
      if (navigator.share) {
        await navigator.share({
          title: 'Join the conversation on Fireside!',
          text: 'Come join the conversation on Fireside!',
          url: roomURL,
        });
      } else {
        await navigator.clipboard.writeText(roomURL);
        toast.success('Room URL copied to clipboard!');
      }
    } catch (e) {
      console.error("Error sharing:", e);
    }
  }

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
      <div className="relative z-10 px-4 pt-7">
        <StarRings />

        <div className="flex items-start justify-between">
          <div className="relative flex items-center gap-2">
            {live ? <LiveBadge /> : null}
            <div>
              <div
                className="text-base font-semibold"
                style={{ color: TOKENS.text }}
              >
                {title}
              </div>
              <div
                className="text-xs"
                style={{ color: TOKENS.muted }}
              >
                {tagline}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onAdsToggle && (
              <AdsToggle
                on={adsOn}
                onToggle={onAdsToggle}
              />
            )}
            {isConnected && roomId && (
              <button
                className={`grid h-9 w-9 place-items-center transition rounded-full hover:opacity-70 ${isShareMenuOpen ? "bg-white/10" : ""} `}
                aria-label="Share"
                title="Share"
                onClick={() => setIsShareMenuOpen((prev) => !prev)}
              >
                <TbShare3
                  className="h-[18px] w-[18px]"
                  style={{ color: "rgba(255,255,255,.65)" }}
                />
              </button>
            )}
            {isConnected && (
              <button
                className="grid h-9 w-9 place-items-center transition hover:opacity-70 rounded-full"
                style={{ background: "rgba(239,68,68,0.15)" }}
                aria-label="Leave"
                title="Leave"
                onClick={handleLeaveClick}
              >
                <LogOut
                  className="h-[18px] w-[18px]"
                  style={{ color: "rgba(239,68,68,1)" }}
                />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Share Menu Overlay */}
      <div 
        onClick={() => setIsShareMenuOpen(false)} 
        className={`fixed top-0 left-0 h-screen w-screen z-[1000] transition-all duration-200 ${isShareMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
      >
        {isShareMenuOpen && (
          <div className="absolute right-12 top-[4.5rem] border border-white/10 mb-2 w-40 gradient-green-bg bg-black text-white rounded-lg">
            <button
              onClick={() => {
                setIsShareMenuOpen(false);
                composeCast();
              }}
              className="w-full px-4 py-2 text-left hover:bg-gray-700 flex items-center space-x-2 rounded-t-lg transition"
            >
              <MdOutlineIosShare className="w-5 h-5" />
              <span>Share on App</span>
            </button>
            <button
              onClick={() => {
                setIsShareMenuOpen(false);
                handleShareOnTwitter();
              }}
              className="w-full px-4 py-2 text-left hover:bg-gray-700 flex items-center space-x-2 transition"
            >
              <FaXTwitter className="w-5 h-5" />
              <span>Share on X</span>
            </button>
            <button
              onClick={() => {
                setIsShareMenuOpen(false);
                handleCopyURL();
              }}
              className="w-full px-4 py-2 text-left hover:bg-gray-700 flex items-center space-x-2 rounded-b-lg transition"
            >
              <MdCopyAll className="w-5 h-5" />
              <span>Copy URL</span>
            </button>
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
