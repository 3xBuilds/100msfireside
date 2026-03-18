"use client";

import { Mic, MicOff, User } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useAgoraContext, AgoraPeer } from "@/contexts/AgoraContext";
import { Card } from "./UI/Card";
import { motion } from "framer-motion";
import { Avatar } from "./experimental";

interface PeerProps {
  peer: AgoraPeer;
}
function NameDisplay({ name, roleName }: { name: string; roleName?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [shouldSlide, setShouldSlide] = useState(false);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const checkOverflow = () => {
      if (containerRef.current && textRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const textWidth = textRef.current.scrollWidth;
        const needsSlide = textWidth > containerWidth;
        setShouldSlide(needsSlide);
        if (needsSlide) {
          setOffset(containerWidth - textWidth);
        }
      }
    };

    checkOverflow();
    
    const timeoutId = setTimeout(checkOverflow, 100);
    
    return () => clearTimeout(timeoutId);
  }, [name]);

  return (
    <div 
      ref={containerRef}
      className={`${roleName == "listener" ? " text-[0.7rem] " : " text-sm font-bold "} text-white mt-1 px-1 overflow-hidden relative w-full`}
    >
      <motion.div 
        ref={textRef}
        className="whitespace-nowrap"
        animate={shouldSlide ? {
          x: [0, offset]
        } : {}}
        transition={{
          duration: 6,
          repeat: Infinity,
          repeatType: "loop",
          ease: "easeInOut",
          repeatDelay: 0.5
        }}
        style={{
          display: 'inline-block',
          textAlign: shouldSlide ? 'left' : 'center',
          width: shouldSlide ? 'auto' : '100%',
          padding: "0 5px",
        }}
      >
        {name}
      </motion.div>
    </div>
  );
}

export default function Peer({ peer }: PeerProps) {
  const { audioLevels } = useAgoraContext();
  const peerAudioLevel = audioLevels.get(peer.uid) || 0;
  const isPeerAudioEnabled = !!peer.audioTrack;

  // Check if this peer is currently speaking
  const isSpeaking = isPeerAudioEnabled && peerAudioLevel > 5;
  
  // Get avatar URL from metadata
  const avatarUrl = peer.metadata ? JSON.parse(peer.metadata).avatar : undefined;

  console.log('Peer Render:', peer.metadata);
  
  // Determine if peer is a storyteller (host/co-host)
  const isStoryteller = peer.roleName === "host" || peer.roleName === "co-host";

  return (
    <div className="flex flex-col w-full min-w-0 items-center">
      <Avatar
        name={peer.name}
        img={avatarUrl}
        size={peer.roleName === "listener" ? 48 : 96}
        speaking={isSpeaking}
        storyteller={isStoryteller}
        fireDistance={isSpeaking ? 0.8 : 0.5}
      />
      <NameDisplay name={peer.name} roleName={peer.roleName} />
    </div>
  );
}
