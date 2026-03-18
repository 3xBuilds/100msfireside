"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAgoraContext } from "@/contexts/AgoraContext";
import { useCustomAudioTrack, AudioTrackItem } from "@/hooks/useCustomAudioTrack";
import { useSoundPlayedEvent, useSoundStoppedEvent, SoundPlayedMessage } from "@/utils/events";
import {
  SoundEffect,
  getAvailableSounds,
  getSoundById,
} from "@/utils/soundboard/sounds";
import {
  GLOBAL_RATE_LIMIT,
  DEFAULT_SOUNDBOARD_VOLUME,
  SOUNDBOARD_ALLOWED_ROLES,
  getSoundboardPrefs,
  saveSoundboardPrefs,
  addToRecentSounds,
  getRecentSounds,
} from "@/utils/soundboard/constants";

/**
 * Recent sound play for rate limiting
 */
interface SoundPlayRecord {
  timestamp: number;
  soundId: string;
}

/**
 * Sound notification that appears when someone plays a sound
 */
export interface SoundNotification {
  id: number;
  soundId: string;
  soundName: string;
  soundEmoji: string;
  senderName: string;
  senderAvatar?: string;
}

/**
 * useSoundboardLogic hook return type
 */
export interface UseSoundboardLogicReturn {
  // Actions
  playSound: (sound: SoundEffect) => Promise<void>;
  stopSound: () => Promise<void>;
  setVolume: (volume: number) => void;
  
  // State
  isPlaying: boolean;
  currentSound: SoundEffect | null;
  progress: number;
  volume: number;
  cooldownRemaining: number;
  canUse: boolean;
  isOnCooldown: boolean;
  
  // Data
  availableSounds: SoundEffect[];
  recentSounds: SoundEffect[];
  notifications: SoundNotification[];
  
  // User info
  localPeerName: string;
  localPeerAvatar?: string;
}

/**
 * useSoundboardLogic - Hook for soundboard feature logic
 * 
 * Handles:
 * - Playing sounds via HMS Custom Audio Tracks API
 * - Rate limiting (soft warnings only)
 * - Permission checks (host/co-host/speaker only)
 * - Visual sync across all peers via custom events
 * - Recent sounds tracking
 * 
 * @param user - The current user object from global context
 */
export function useSoundboardLogic(user: any): UseSoundboardLogicReturn {
  const { localPeer } = useAgoraContext();
  const localRoleName = localPeer?.roleName;
  
  // Soundboard state
  const [currentSound, setCurrentSound] = useState<SoundEffect | null>(null);
  const [volume, setVolumeState] = useState(DEFAULT_SOUNDBOARD_VOLUME);
  const [notifications, setNotifications] = useState<SoundNotification[]>([]);
  const [recentSoundIds, setRecentSoundIds] = useState<string[]>([]);
  
  // Rate limiting refs
  const globalPlaysRef = useRef<SoundPlayRecord[]>([]);
  
  // Initialize custom audio track hook
  const {
    play: audioPlay,
    stop: audioStop,
    setVolume: audioSetVolume,
    isPlaying,
  } = useCustomAudioTrack({
    defaultVolume: volume / 100, // Convert 0-100 to 0-1
    onPlaybackStart: (track) => {
      console.log("[Soundboard] Sound started:", track.name);
    },
    onPlaybackEnd: (track) => {
      console.log("[Soundboard] Sound ended:", track.name);
      setCurrentSound(null);
    },
    onError: (error) => {
      console.error("[Soundboard] Playback error:", error);
      setCurrentSound(null);
    },
  });
  
  // Sound played event for visual sync
  const { notifySoundPlayed } = useSoundPlayedEvent((msg: SoundPlayedMessage) => {
    console.log("[Soundboard] Sound played event received:", msg);
    
    // Add notification
    const notification: SoundNotification = {
      id: msg.timestamp,
      soundId: msg.soundId,
      soundName: msg.soundName,
      soundEmoji: msg.soundEmoji,
      senderName: msg.senderName,
      senderAvatar: msg.senderAvatar,
    };
    
    setNotifications(prev => [...prev, notification]);
    
    // Remove notification after animation
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
    }, 3000);
  });
  
  // Sound stopped event
  const { notifySoundStopped } = useSoundStoppedEvent((msg) => {
    console.log("[Soundboard] Sound stopped by:", msg.stoppedBy);
  });
  
  // Load preferences on mount
  useEffect(() => {
    const prefs = getSoundboardPrefs();
    setVolumeState(prefs.volume);
    setRecentSoundIds(getRecentSounds());
  }, []);
  
  // Check if user can use soundboard
  const canUse = SOUNDBOARD_ALLOWED_ROLES.includes(localRoleName?.toLowerCase() || '');
  
  /**
   * Check if we're within global rate limit (soft check - warn only)
   */
  const checkRateLimit = useCallback((): boolean => {
    const now = Date.now();
    const windowStart = now - GLOBAL_RATE_LIMIT.windowMs;
    
    // Clean up old records
    globalPlaysRef.current = globalPlaysRef.current.filter(
      record => record.timestamp > windowStart
    );
    
    // Check if under limit
    return globalPlaysRef.current.length < GLOBAL_RATE_LIMIT.maxSounds;
  }, []);
  
  /**
   * Play a sound effect
   * Uses custom audio tracks for reliable one-shot playback
   */
  const playSound = useCallback(async (sound: SoundEffect): Promise<void> => {
    if (!canUse) {
      console.warn("[Soundboard] User does not have permission to use soundboard");
      return;
    }
    
    // Soft rate limit check - warn but don't block
    if (!checkRateLimit()) {
      console.warn("[Soundboard] Rate limit warning - many sounds in short time");
    }
    
    try {
      const now = Date.now();
      globalPlaysRef.current.push({ timestamp: now, soundId: sound.id });
      
      // Update current sound
      setCurrentSound(sound);
      
      // Add to recent sounds
      addToRecentSounds(sound.id);
      setRecentSoundIds(getRecentSounds());
      
      // Create audio track item from sound
      const audioItem: AudioTrackItem = {
        id: sound.id,
        name: sound.name,
        url: sound.file,
        duration: sound.duration,
      };
      
      // Play via custom audio track - this will stop any currently playing sound
      await audioPlay(audioItem);
      
      // Notify other peers
      notifySoundPlayed(
        sound.id,
        sound.name,
        sound.emoji,
        localPeer?.name || user?.displayName || "Someone",
        user?.pfp_url
      );
      
      console.log("[Soundboard] Playing sound:", sound.name);
    } catch (error) {
      console.error("[Soundboard] Error playing sound:", error);
      setCurrentSound(null);
      throw error;
    }
  }, [
    canUse,
    checkRateLimit,
    audioPlay,
    notifySoundPlayed,
    localPeer?.name,
    user?.displayName,
    user?.pfp_url,
  ]);
  
  /**
   * Stop currently playing sound
   */
  const stopSound = useCallback(async (): Promise<void> => {
    try {
      await audioStop();
      setCurrentSound(null);
      
      // Notify other peers
      notifySoundStopped(localPeer?.name || user?.displayName || "Someone");
      
      console.log("[Soundboard] Sound stopped");
    } catch (error) {
      console.error("[Soundboard] Error stopping sound:", error);
    }
  }, [audioStop, notifySoundStopped, localPeer?.name, user?.displayName]);
  
  /**
   * Set volume (0-100)
   */
  const setVolume = useCallback((newVolume: number) => {
    const clampedVolume = Math.max(0, Math.min(100, newVolume));
    setVolumeState(clampedVolume);
    saveSoundboardPrefs({ volume: clampedVolume });
    audioSetVolume(clampedVolume);
  }, [audioSetVolume]);
  
  // Get available sounds
  const availableSounds = getAvailableSounds();
  
  // Get recent sounds as full sound objects
  const recentSounds = recentSoundIds
    .map(id => getSoundById(id))
    .filter((sound): sound is SoundEffect => sound !== undefined);
  
  return {
    playSound,
    stopSound,
    setVolume,
    isPlaying,
    currentSound,
    progress: 0, // Not tracking progress for one-shot sounds
    volume,
    cooldownRemaining: 0, // No cooldown blocking
    canUse,
    isOnCooldown: false, // No cooldown blocking
    availableSounds,
    recentSounds,
    notifications,
    localPeerName: localPeer?.name || user?.displayName || "Anonymous",
    localPeerAvatar: user?.pfp_url,
  };
}

export default useSoundboardLogic;
