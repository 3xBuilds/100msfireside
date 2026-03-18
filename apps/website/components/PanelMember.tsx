import { ScrollingName } from "./experimental";
import { useAgoraContext } from "@/contexts/AgoraContext";
import { useEffect, useState } from "react";

interface PanelMemberProps {
  id: string;
  name: string;
  img?: string;
  role: string;
  speaking: boolean;
  muted: boolean;
  onClick: (id: string) => void;
  isHandRaised?: boolean;
}

export default function PanelMember({ id, name, img, role, onClick, isHandRaised }: PanelMemberProps) {
  const { audioLevels, remotePeers, localPeer, isLocalAudioEnabled } = useAgoraContext();
  
  // Find peer by id to get audio state
  const isLocalUser = id === localPeer?.id;
  const peer = isLocalUser ? localPeer : remotePeers.get(parseInt(id));
  // For local peer, use the authoritative isLocalAudioEnabled state.
  // For remote peers, use the audioTrack presence (set/cleared by Agora events).
  const isPeerAudioEnabled = isLocalUser ? isLocalAudioEnabled : !!peer?.audioTrack;
  const peerAudioLevel = audioLevels.get(parseInt(id)) || 0;
  const [showSpeakingRing, setShowSpeakingRing] = useState(false);

  // Check if this peer is currently speaking
  const isSpeaking = isPeerAudioEnabled && peerAudioLevel > 5;

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    if (isSpeaking) {
      setShowSpeakingRing(true);
    } else {
      // Add a short delay before hiding the ring (300ms)
      timeoutId = setTimeout(() => {
        setShowSpeakingRing(false);
      }, 300);
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [isSpeaking]);

  const getBorderClass = () => {
    // Role-based border colors
    switch (role) {
      case 'Host':
        return 'border-neutral-red';
      case 'Co-host':
        return 'border-fireside-orange';
      case 'Speaker':
        return 'border-neutral-blue';
      default:
        return 'border-transparent';
    }
  };

  const getRingClass = () => {
    if (showSpeakingRing) {
      return `ring-4 ${role == "Host" && "ring-neutral-red/50"} ${role == "Co-host" && "ring-fireside-orange/50"} ${role == "Speaker" && "ring-neutral-blue/50"}`;
    }
    return '';
  };

  return (
    <div 
      className="flex flex-col items-center gap-2 cursor-pointer"
      onClick={() => onClick(id)}
    >
      <div
        className={`relative rounded-xl transition-all duration-200 border-b-4 ${getBorderClass()} ${getRingClass()}`}
        style={{
          width: '80px',
          height: '80px'
        }}
      >
        <img
          src={img || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`}
          alt={name}
          className={`w-full h-full rounded-xl object-cover transition-all duration-300 ease-in-out ${!isPeerAudioEnabled ? "opacity-70" : ""}`}
        />
        {!isPeerAudioEnabled && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-black/70 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </div>
          </div>
        )}
        {/* Hand raise indicator */}
        {isHandRaised && (
          <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-white flex items-center justify-center text-sm z-10 animate-bounce shadow-lg">
            ✋
          </div>
        )}
      </div>
      <div className="w-full">
        <ScrollingName 
          name={name}
          className="text-xs text-center" 
          style={{ color: 'rgba(255,255,255,.92)' }}
        />
        <div className="text-[10px] text-center" style={{ color: 'rgba(255,255,255,.55)' }}>
          {role}
        </div>
      </div>
    </div>
  );
}
