/**
 * Custom hooks for the Fireside application
 * 
 * This module exports reusable hooks that can be used across the application.
 */

// Playlist hook - for playlist-based audio (music, podcasts, continuous playback)
export { usePlaylist, type PlaylistItem, type PlaybackState, type UsePlaylistOptions, type UsePlaylistReturn } from './usePlaylist';

// Custom Audio Track hook - for one-shot sound effects (soundboard, notifications)
export { useCustomAudioTrack, type AudioTrackItem, type UseCustomAudioTrackOptions, type UseCustomAudioTrackReturn } from './useCustomAudioTrack';

