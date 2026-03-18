"use client";

import { useState, useCallback } from "react";

interface HandRaiseLogicProps {
  isHandRaised: boolean;
  setIsHandRaised: (value: boolean) => void;
  localPeerId: string;
  onRaise?: () => void;
  onLower?: () => void;
}

export function useHandRaiseLogic({ isHandRaised, setIsHandRaised, localPeerId, onRaise, onLower }: HandRaiseLogicProps) {
  const [handRaiseDisabled, setHandRaiseDisabled] = useState(false);
  const [handRaiseCountdown, setHandRaiseCountdown] = useState(10);
  
  const toggleRaiseHand = useCallback(async () => {
    try {
      console.log("[Agora Action] Hand raise toggle initiated", {
        currentState: isHandRaised,
        targetState: !isHandRaised,
        peerId: localPeerId,
        timestamp: new Date().toISOString(),
      });
      
      if (isHandRaised) {
        setIsHandRaised(false);
        console.log("[Agora Action] Hand lowered successfully");
        onLower?.();
      } else if(!isHandRaised && !handRaiseDisabled) {
        setIsHandRaised(true);
        console.log("[Agora Action] Hand raised successfully");
        onRaise?.();
        setHandRaiseDisabled(true);
        setHandRaiseCountdown(10);
        
        const countdownInterval = setInterval(() => {
          setHandRaiseCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(countdownInterval);
              setHandRaiseDisabled(false);
              return 10;
            }
            return prev - 1;
          });
        }, 1000);
        
        setTimeout(() => {
          clearInterval(countdownInterval);
          setHandRaiseDisabled(false);
          setHandRaiseCountdown(10);
        }, 10000);
      }
    } catch (error) {
      console.error("[Agora Action] Error toggling hand raise:", error);
    }
  }, [isHandRaised, setIsHandRaised, handRaiseDisabled, localPeerId, onRaise, onLower]);

  return {
    toggleRaiseHand,
    handRaiseDisabled,
    handRaiseCountdown
  };
}
