"use client";

import { useState, useEffect } from "react";
import { useAgoraContext } from "@/contexts/AgoraContext";
import { useGlobalContext } from "../utils/providers/globalContext";
import { useHandRaiseLogic } from "./footer/useHandRaiseLogic";
import { useEmojiReactionLogic } from "./footer/useEmojiReactionLogic";
import { useSoundboardLogic } from "./footer/useSoundboardLogic";
import { useSpeakerRejectionEvent, useSpeakerRequestEvent, useHandRaiseEvent } from "../utils/events";
import { ControlCenterDrawer } from "./experimental";
import Chat from "./Chat";
import TippingModal from "./TippingModal";
import EmojiPickerDrawer from "./footer/EmojiPickerDrawer";
import FloatingEmojis from "./footer/FloatingEmojis";
import SoundboardDrawer from "./SoundboardDrawer";
import { toast } from "react-toastify";

export default function Footer({ roomId }: { roomId: string }) {
  const { isLocalAudioEnabled, toggleAudio, localPeer } = useAgoraContext();

  const isListener = localPeer?.roleName?.toLowerCase() === 'listener';
  const canUnmute = !isListener;

  const { user } = useGlobalContext();
  const [controlsOpen, setControlsOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isTippingOpen, setIsTippingOpen] = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isSoundboardOpen, setIsSoundboardOpen] = useState(false);
  const [canRequestToSpeak, setCanRequestToSpeak] = useState(false);
  const [requestTimeoutId, setRequestTimeoutId] = useState<NodeJS.Timeout | null>(null);
  const [isHandRaised, setIsHandRaised] = useState(false);
  
  const { requestToSpeak } = useSpeakerRequestEvent();

  useSpeakerRejectionEvent((msg) => {
    console.log("[HMS Event - Conference] Speaker request event received", {
      peer: msg.peer,
      timestamp: new Date().toISOString(),
    });
    handleRejectRequest({ peerId: msg.peer });
  });

  const handleRejectRequest = ({ peerId }: { peerId: string }) => {
    if (JSON.parse(localPeer?.metadata as string).fid === peerId) {
      toast.info(`Your speaker request was rejected.`, {
        autoClose: 3000,
        toastId: `speaker-reject-${peerId}-${Date.now()}`
      });
      if(typeof window !== 'undefined'){
        localStorage.setItem('speakerRequested', 'false');
      }
      setCanRequestToSpeak(true);
      
      // Clear the timeout if request was rejected
      if (requestTimeoutId) {
        clearTimeout(requestTimeoutId);
        setRequestTimeoutId(null);
      }
    }
  };

  useEffect(() => {
    const speakerRequested = localStorage.getItem('speakerRequested');
    if (speakerRequested === 'true') {
      setCanRequestToSpeak(false);
    } else {
      setCanRequestToSpeak(true);
    }
  },[])


  const { notifyHandRaise } = useHandRaiseEvent();

  const localMetadata = localPeer?.metadata ? JSON.parse(localPeer.metadata as string) : null;
  const localPeerName = localPeer?.name || 'Unknown';
  const localPeerAvatar = localMetadata?.avatar;
  const localPeerFid = localMetadata?.fid;

  const { toggleRaiseHand } = useHandRaiseLogic({
    isHandRaised,
    setIsHandRaised,
    localPeerId: localPeer?.id || '',
    onRaise: () => {
      if (localPeerFid) {
        notifyHandRaise(localPeerFid, localPeerName, true, localPeerAvatar);
      }
    },
    onLower: () => {
      if (localPeerFid) {
        notifyHandRaise(localPeerFid, localPeerName, false, localPeerAvatar);
      }
    },
  });

  const { handleEmojiSelect, floatingEmojis, isDisabled } = useEmojiReactionLogic({ user });

  const soundboardLogic = useSoundboardLogic(user);
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (requestTimeoutId) {
        clearTimeout(requestTimeoutId);
      }
    };
  }, [requestTimeoutId]);

  const handleRequestToSpeak = () => {
    const endTime = Date.now() + 90000;
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('speakerRequested', 'true');
    }

    if(!localPeer){
      return;
    }
    
    requestToSpeak(JSON.parse(localPeer?.metadata as string).fid as string, localPeer.id);
    
    toast.success("🎙️ Speaker request sent", { 
      autoClose: 3000
    });
    setCanRequestToSpeak(false);
    
    // Set a 60-second timeout to reset the request state
    const timeoutId = setTimeout(() => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('speakerRequested', 'false');
      }
      setCanRequestToSpeak(true);
      setRequestTimeoutId(null);
    }, 60000); // 60 seconds
    
    setRequestTimeoutId(timeoutId);
  };

  const handleReaction = () => {
    setIsEmojiPickerOpen(true);
  };

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-50">
        <ControlCenterDrawer
          open={controlsOpen}
          setOpen={setControlsOpen}
          muted={isListener ? false : !isLocalAudioEnabled}
          setMuted={(muted) => {
            if (isListener && !canUnmute) {
              handleRequestToSpeak();
            } else if (muted && isLocalAudioEnabled) {
              toggleAudio();
            } else if (!muted && !isLocalAudioEnabled && canUnmute) {
              toggleAudio();
            }
          }}
          handUp={isHandRaised}
          setHandUp={(up) => {
            if (up !== isHandRaised) {
              toggleRaiseHand();
            }
          }}
          onReact={handleReaction}
          onChat={() => setIsChatOpen(true)}
          onTip={() => setIsTippingOpen(true)}
          onSoundboard={() => setIsSoundboardOpen(true)}
          onVisibleHeightChange={(h) => {
            // Optional: track drawer height if needed
          }}
          canUnmute={canUnmute}
          isListener={isListener}
          canRequestToSpeak={canRequestToSpeak}
        />
      </div>
      
      <FloatingEmojis emojis={floatingEmojis} />
      
      <Chat
        isOpen={isChatOpen}
        setIsChatOpen={() => setIsChatOpen(!isChatOpen)}
        roomId={roomId}
      />
      
      <TippingModal
        isOpen={isTippingOpen}
        onClose={() => setIsTippingOpen(false)}
        roomId={roomId}
      />
      
      <EmojiPickerDrawer
        isOpen={isEmojiPickerOpen}
        onEmojiSelect={handleEmojiSelect}
        onClose={() => setIsEmojiPickerOpen(false)}
        isDisabled={isDisabled}
      />
      
      <SoundboardDrawer
        isOpen={isSoundboardOpen}
        onClose={() => setIsSoundboardOpen(false)}
        {...soundboardLogic}
      />
    </>
  );
}
