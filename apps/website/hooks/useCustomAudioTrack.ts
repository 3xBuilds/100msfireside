"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useAgoraContext } from "@/contexts/AgoraContext";

/**
 * AudioTrackItem represents a sound to be played
 */
export interface AudioTrackItem {
  id: string;
  name: string;
  url: string;
  duration?: number; // in milliseconds (optional, will auto-detect)
}

/**
 * UseCustomAudioTrackOptions configuration
 */
export interface UseCustomAudioTrackOptions {
  defaultVolume?: number; // 0-1
  onPlaybackStart?: (item: AudioTrackItem) => void;
  onPlaybackEnd?: (item: AudioTrackItem) => void;
  onError?: (error: Error) => void;
}

/**
 * UseCustomAudioTrackReturn - the return type
 */
export interface UseCustomAudioTrackReturn {
  play: (item: AudioTrackItem) => Promise<void>;
  stop: () => Promise<void>;
  setVolume: (volume: number) => void;
  isPlaying: boolean;
  currentTrack: AudioTrackItem | null;
  isConnected: boolean;
}

/**
 * useCustomAudioTrack - Hook for playing one-shot audio effects via HMS custom tracks
 * 
 * This hook uses the 100ms custom tracks API to broadcast audio to all participants.
 * Unlike usePlaylist, this is designed for short sound effects that play once and stop.
 * 
 * Perfect for: soundboards, notifications, alerts, sound effects
 * 
 * @see https://www.100ms.live/docs/javascript/v2/how-to-guides/extend-capabilities/custom-tracks/custom-tracks
 * 
 * @example
 * ```tsx
 * const { play, stop, isPlaying } = useCustomAudioTrack({
 *   onPlaybackEnd: (item) => console.log('Finished:', item.name)
 * });
 * 
 * // Play a sound effect
 * await play({ id: 'airhorn', name: 'Airhorn', url: '/sounds/airhorn.mp3' });
 * ```
 */
export function useCustomAudioTrack(options: UseCustomAudioTrackOptions = {}): UseCustomAudioTrackReturn {
  const {
    defaultVolume = 0.7,
    onPlaybackStart,
    onPlaybackEnd,
    onError,
  } = options;

  const { isConnected } = useAgoraContext();

  // State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<AudioTrackItem | null>(null);

  // Refs for cleanup
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentItemRef = useRef<AudioTrackItem | null>(null);
  const isCleaningUpRef = useRef(false);

  /**
   * Cleanup function to stop audio
   */
  const cleanup = useCallback(async () => {
    isCleaningUpRef.current = true;

    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.pause();
      audioRef.current = null;
    }

    setTimeout(() => {
      isCleaningUpRef.current = false;
    }, 100);
  }, []);

  /**
   * Play an audio item
   */
  const play = useCallback(async (item: AudioTrackItem): Promise<void> => {
    if (!isConnected) {
      const error = new Error("Not connected to room");
      onError?.(error);
      throw error;
    }

    try {
      // Stop any currently playing audio first
      await cleanup();

      // Create audio element
      const audio = new Audio(item.url);
      audio.volume = defaultVolume;
      audioRef.current = audio;
      currentItemRef.current = item;

      // Update state
      setIsPlaying(true);
      setCurrentTrack(item);

      // Handle playback end
      audio.onended = async () => {
        if (isCleaningUpRef.current) return;
        
        console.log("[useCustomAudioTrack] Playback ended:", item.name);
        
        const endedItem = currentItemRef.current;
        
        await cleanup();
        
        setIsPlaying(false);
        setCurrentTrack(null);
        
        if (endedItem) {
          onPlaybackEnd?.(endedItem);
        }
      };

      // Handle errors during playback
      audio.onerror = async () => {
        if (isCleaningUpRef.current) return;
        
        console.error("[useCustomAudioTrack] Playback error");
        await cleanup();
        setIsPlaying(false);
        setCurrentTrack(null);
        onError?.(new Error(`Playback error: ${item.url}`));
      };

      // Start playback
      await audio.play();

      // Callback
      onPlaybackStart?.(item);

      console.log("[useCustomAudioTrack] Playing:", item.name, item.url);
    } catch (error) {
      console.error("[useCustomAudioTrack] Error playing:", error);
      await cleanup();
      setIsPlaying(false);
      setCurrentTrack(null);
      onError?.(error as Error);
      throw error;
    }
  }, [isConnected, defaultVolume, cleanup, onPlaybackStart, onPlaybackEnd, onError]);

  /**
   * Stop current playback
   */
  const stop = useCallback(async (): Promise<void> => {
    const stoppedItem = currentItemRef.current;
    
    await cleanup();
    
    setIsPlaying(false);
    setCurrentTrack(null);
    
    if (stoppedItem) {
      onPlaybackEnd?.(stoppedItem);
    }
    
    console.log("[useCustomAudioTrack] Stopped");
  }, [cleanup, onPlaybackEnd]);

  /**
   * Set volume (0-100, will be converted to 0-1)
   */
  const setVolume = useCallback((volume: number) => {
    const normalizedVolume = Math.max(0, Math.min(100, volume)) / 100;
    if (audioRef.current) {
      audioRef.current.volume = normalizedVolume;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    play,
    stop,
    setVolume,
    isPlaying,
    currentTrack,
    isConnected: isConnected ?? false,
  };
}

export default useCustomAudioTrack;
