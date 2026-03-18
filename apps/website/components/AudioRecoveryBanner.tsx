"use client";

import { useState, useEffect } from "react";
import { toast } from "react-toastify";

export default function AudioRecoveryBanner() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Check for autoplay issues on iOS Safari
    const checkAudioContext = async () => {
      if (typeof window === 'undefined') return;
      
      try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContext) {
          const testContext = new AudioContext();
          if (testContext.state === 'suspended') {
            setShowBanner(true);
          }
          testContext.close();
        }
      } catch (error) {
        console.warn('[AudioRecoveryBanner] Error checking audio context:', error);
      }
    };

    // Check periodically
    const interval = setInterval(checkAudioContext, 5000);
    checkAudioContext();

    return () => clearInterval(interval);
  }, []);

  const handleResumeAudio = async () => {
    try {
      // Create and immediately play a silent audio to resume autoplay
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      // REMOVED: The problematic setVolume calls that were manipulating remote peer audio tracks
      // This was causing random participants to be muted when others toggled their audio
      // Only the user should control their own audio via setLocalAudioEnabled()

      setShowBanner(false);
      toast.success('Audio resumed');
      console.log('[AudioRecoveryBanner] Audio context resumed');
    } catch (error) {
      console.error('[AudioRecoveryBanner] Failed to resume audio:', error);
    }
  };

  if (!showBanner) return null;

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-slide-down">
      <div className="bg-yellow-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-4">
        <span className="text-lg">🔊</span>
        <div>
          <p className="font-semibold">Audio Paused</p>
          <p className="text-sm text-yellow-100">Tap to resume audio</p>
        </div>
        <button
          onClick={handleResumeAudio}
          className="bg-white text-yellow-600 px-4 py-2 rounded font-semibold hover:bg-yellow-50 transition-colors"
        >
          Resume
        </button>
      </div>
    </div>
  );
}

