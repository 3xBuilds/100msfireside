"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAgoraContext } from "@/contexts/AgoraContext";

/**
 * PlaylistItem represents a single audio/video item that can be played
 */
export interface PlaylistItem {
  id: string;
  name: string;
  url: string;
  duration?: number; // in milliseconds
  metadata?: Record<string, any>;
}

/**
 * PlaybackState represents the current state of the playlist playback
 */
export interface PlaybackState {
  isPlaying: boolean;
  isPaused: boolean;
  currentTrack: PlaylistItem | null;
  progress: number; // 0-100
  volume: number; // 0-100
  currentTime: number; // in milliseconds
}

/**
 * UsePlaylistOptions configuration for the playlist hook
 */
export interface UsePlaylistOptions {
  type?: 'audio' | 'video';
  defaultVolume?: number; // 0-100
  onPlaybackStart?: (track: PlaylistItem) => void;
  onPlaybackEnd?: (track: PlaylistItem) => void;
  onPlaybackProgress?: (progress: number, currentTime: number) => void;
  onError?: (error: Error) => void;
}

/**
 * UsePlaylistReturn - the return type of the usePlaylist hook
 */
export interface UsePlaylistReturn {
  // Playback controls
  play: (item: PlaylistItem) => Promise<void>;
  stop: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
  seek: (time: number) => Promise<void>;
  
  // State
  playbackState: PlaybackState;
  isConnected: boolean;
  
  // Utilities
  preload: (items: PlaylistItem[]) => void;
}

/**
 * usePlaylist - A modular hook wrapping HMS Playlist API
 * 
 * This hook provides a generic interface for audio/video playlist functionality
 * that can be used for soundboards, background music, podcasts, etc.
 * 
 * @param options - Configuration options for the playlist
 * @returns Playlist controls and state
 * 
 * @example
 * ```tsx
 * const { play, stop, playbackState } = usePlaylist({
 *   type: 'audio',
 *   defaultVolume: 70,
 *   onPlaybackEnd: (track) => console.log('Finished playing:', track.name)
 * });
 * 
 * // Play a sound
 * await play({ id: '1', name: 'Airhorn', url: '/sounds/airhorn.mp3' });
 * ```
 */
export function usePlaylist(options: UsePlaylistOptions = {}): UsePlaylistReturn {
  const {
    type = 'audio',
    defaultVolume = 100,
    onPlaybackStart,
    onPlaybackEnd,
    onPlaybackProgress,
    onError,
  } = options;

  const { isConnected } = useAgoraContext();

  // Internal state
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    isPlaying: false,
    isPaused: false,
    currentTrack: null,
    progress: 0,
    volume: defaultVolume,
    currentTime: 0,
  });

  // Refs for tracking playback
  const currentTrackRef = useRef<PlaylistItem | null>(null);
  const playbackTimerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const preloadedUrlsRef = useRef<Set<string>>(new Set());

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
      }
    };
  }, []);

  /**
   * Start playback progress tracking
   */
  const startProgressTracking = useCallback((track: PlaylistItem) => {
    if (playbackTimerRef.current) {
      clearInterval(playbackTimerRef.current);
    }

    startTimeRef.current = Date.now();
    const duration = track.duration || 5000; // Default 5 seconds if no duration

    playbackTimerRef.current = setInterval(async () => {
      const elapsed = Date.now() - startTimeRef.current;
      const progress = Math.min((elapsed / duration) * 100, 100);
      
      setPlaybackState(prev => ({
        ...prev,
        progress,
        currentTime: elapsed,
      }));

      onPlaybackProgress?.(progress, elapsed);

      // Auto-stop when duration is reached
      if (elapsed >= duration) {
        if (playbackTimerRef.current) {
          clearInterval(playbackTimerRef.current);
        }
        
        // Stop the audio element
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }
        
        setPlaybackState(prev => ({
          ...prev,
          isPlaying: false,
          isPaused: false,
          currentTrack: null,
          progress: 0,
          currentTime: 0,
        }));

        onPlaybackEnd?.(track);
        currentTrackRef.current = null;
      }
    }, 100);
  }, [onPlaybackProgress, onPlaybackEnd]);

  // Audio element ref for Web Audio playback
  const audioRef = useRef<HTMLAudioElement | null>(null);

  /**
   * Play a playlist item
   */
  const play = useCallback(async (item: PlaylistItem): Promise<void> => {
    if (!isConnected) {
      const error = new Error("Not connected to room");
      onError?.(error);
      throw error;
    }

    try {
      // Clear any existing timer
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }

      // Stop any currently playing audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      // Update state before playing
      currentTrackRef.current = item;
      setPlaybackState(prev => ({
        ...prev,
        isPlaying: true,
        isPaused: false,
        currentTrack: item,
        progress: 0,
        currentTime: 0,
      }));

      // Create and play audio element
      const audio = new Audio(item.url);
      audio.volume = playbackState.volume / 100;
      audioRef.current = audio;
      
      audio.onended = () => {
        if (playbackTimerRef.current) {
          clearInterval(playbackTimerRef.current);
        }
        setPlaybackState(prev => ({
          ...prev,
          isPlaying: false,
          isPaused: false,
          currentTrack: null,
          progress: 0,
          currentTime: 0,
        }));
        onPlaybackEnd?.(item);
        currentTrackRef.current = null;
      };

      await audio.play();

      // Start progress tracking
      startProgressTracking(item);

      // Callback
      onPlaybackStart?.(item);

      console.log("[usePlaylist] Playing:", item.name, item.url);
    } catch (error) {
      console.error("[usePlaylist] Error playing:", error);
      
      // Reset state on error
      setPlaybackState(prev => ({
        ...prev,
        isPlaying: false,
        isPaused: false,
        currentTrack: null,
        progress: 0,
        currentTime: 0,
      }));
      currentTrackRef.current = null;

      onError?.(error as Error);
      throw error;
    }
  }, [isConnected, onPlaybackStart, onError, startProgressTracking, playbackState.volume]);

  /**
   * Stop playback
   */
  const stop = useCallback(async (): Promise<void> => {
    if (!isConnected) return;

    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
      }

      const previousTrack = currentTrackRef.current;
      currentTrackRef.current = null;

      setPlaybackState(prev => ({
        ...prev,
        isPlaying: false,
        isPaused: false,
        currentTrack: null,
        progress: 0,
        currentTime: 0,
      }));

      if (previousTrack) {
        onPlaybackEnd?.(previousTrack);
      }

      console.log("[usePlaylist] Stopped playback");
    } catch (error) {
      console.error("[usePlaylist] Error stopping:", error);
      onError?.(error as Error);
    }
  }, [isConnected, onPlaybackEnd, onError]);

  /**
   * Pause playback
   */
  const pause = useCallback(async (): Promise<void> => {
    if (!isConnected || !playbackState.isPlaying) return;

    try {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
      }

      setPlaybackState(prev => ({
        ...prev,
        isPlaying: false,
        isPaused: true,
      }));

      console.log("[usePlaylist] Paused playback");
    } catch (error) {
      console.error("[usePlaylist] Error pausing:", error);
      onError?.(error as Error);
    }
  }, [isConnected, playbackState.isPlaying, onError]);

  /**
   * Resume playback
   */
  const resume = useCallback(async (): Promise<void> => {
    if (!isConnected || !playbackState.isPaused || !currentTrackRef.current) return;

    try {
      if (audioRef.current) {
        await audioRef.current.play();
      }
      
      // Resume progress tracking from where we left off
      const track = currentTrackRef.current;
      const remainingDuration = (track.duration || 5000) - playbackState.currentTime;
      
      if (remainingDuration > 0) {
        startTimeRef.current = Date.now() - playbackState.currentTime;
        startProgressTracking(track);
      }

      setPlaybackState(prev => ({
        ...prev,
        isPlaying: true,
        isPaused: false,
      }));

      console.log("[usePlaylist] Resumed playback");
    } catch (error) {
      console.error("[usePlaylist] Error resuming:", error);
      onError?.(error as Error);
    }
  }, [isConnected, playbackState, onError, startProgressTracking]);

  /**
   * Set volume (0-100)
   */
  const setVolume = useCallback(async (volume: number): Promise<void> => {
    const clampedVolume = Math.max(0, Math.min(100, volume));

    try {
      if (audioRef.current) {
        audioRef.current.volume = clampedVolume / 100;
      }
      
      setPlaybackState(prev => ({
        ...prev,
        volume: clampedVolume,
      }));

      console.log("[usePlaylist] Volume set to:", clampedVolume);
    } catch (error) {
      console.error("[usePlaylist] Error setting volume:", error);
      onError?.(error as Error);
    }
  }, [onError]);

  /**
   * Seek to a specific time (in milliseconds)
   */
  const seek = useCallback(async (time: number): Promise<void> => {
    if (!isConnected || !currentTrackRef.current) return;

    try {
      if (audioRef.current) {
        audioRef.current.currentTime = time / 1000;
      }
      
      startTimeRef.current = Date.now() - time;
      
      setPlaybackState(prev => ({
        ...prev,
        currentTime: time,
        progress: (time / (currentTrackRef.current?.duration || 5000)) * 100,
      }));

      console.log("[usePlaylist] Seeked to:", time, "ms");
    } catch (error) {
      console.error("[usePlaylist] Error seeking:", error);
      onError?.(error as Error);
    }
  }, [isConnected, onError]);

  /**
   * Preload audio files for faster playback
   */
  const preload = useCallback((items: PlaylistItem[]): void => {
    items.forEach(item => {
      if (!preloadedUrlsRef.current.has(item.url)) {
        const audio = new Audio();
        audio.preload = 'auto';
        audio.src = item.url;
        preloadedUrlsRef.current.add(item.url);
        console.log("[usePlaylist] Preloaded:", item.name);
      }
    });
  }, []);

  return {
    play,
    stop,
    pause,
    resume,
    setVolume,
    seek,
    playbackState,
    isConnected: isConnected ?? false,
    preload,
  };
}

export default usePlaylist;

