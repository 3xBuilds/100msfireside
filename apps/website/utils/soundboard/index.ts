/**
 * Soundboard utilities export
 * 
 * This module re-exports all soundboard-related utilities for easier imports.
 */

// Sound definitions and helpers
export {
  type SoundEffect,
  type SoundCategory,
  SOUNDBOARD_SOUNDS,
  getAvailableSounds,
  getSoundsByCategory,
  getSoundById,
  getCategories,
  getCategoryInfo,
} from './sounds';

// Constants and preferences
export {
  SOUND_COOLDOWN_MS,
  GLOBAL_RATE_LIMIT,
  DEFAULT_SOUNDBOARD_VOLUME,
  MAX_SOUNDBOARD_VOLUME,
  MIN_SOUNDBOARD_VOLUME,
  SOUNDBOARD_ALLOWED_ROLES,
  SOUNDBOARD_PREFS_KEY,
  RECENT_SOUNDS_KEY,
  MAX_RECENT_SOUNDS,
  SOUND_PLAYED_ANIMATION_DURATION,
  type SoundboardPreferences,
  DEFAULT_SOUNDBOARD_PREFS,
  getSoundboardPrefs,
  saveSoundboardPrefs,
  getRecentSounds,
  addToRecentSounds,
} from './constants';

