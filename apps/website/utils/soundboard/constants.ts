/**
 * Soundboard constants and configuration
 */

/**
 * Cooldown between sounds per user (in milliseconds)
 * Discord-style: minimal cooldown to allow rapid re-triggering
 */
export const SOUND_COOLDOWN_MS = 250;

/**
 * Global rate limit: max sounds per time window
 * More permissive to allow rapid sound effects
 */
export const GLOBAL_RATE_LIMIT = {
  maxSounds: 10,
  windowMs: 5000, // 5 seconds
};

/**
 * Default volume for soundboard (0-100)
 */
export const DEFAULT_SOUNDBOARD_VOLUME = 70;

/**
 * Maximum volume allowed (0-100)
 */
export const MAX_SOUNDBOARD_VOLUME = 100;

/**
 * Minimum volume allowed (0-100)
 */
export const MIN_SOUNDBOARD_VOLUME = 10;

/**
 * Roles that can use the soundboard
 */
export const SOUNDBOARD_ALLOWED_ROLES = ['host', 'co-host', 'speaker'];

/**
 * localStorage key for soundboard preferences
 */
export const SOUNDBOARD_PREFS_KEY = 'fireside_soundboard_prefs';

/**
 * localStorage key for recently used sounds
 */
export const RECENT_SOUNDS_KEY = 'fireside_recent_sounds';

/**
 * Maximum number of recent sounds to track
 */
export const MAX_RECENT_SOUNDS = 6;

/**
 * Animation duration for sound played indicator (ms)
 */
export const SOUND_PLAYED_ANIMATION_DURATION = 1500;

/**
 * Soundboard preferences interface
 */
export interface SoundboardPreferences {
  volume: number;
  enabled: boolean;
  showNotifications: boolean;
}

/**
 * Default soundboard preferences
 */
export const DEFAULT_SOUNDBOARD_PREFS: SoundboardPreferences = {
  volume: DEFAULT_SOUNDBOARD_VOLUME,
  enabled: true,
  showNotifications: true,
};

/**
 * Get soundboard preferences from localStorage
 */
export function getSoundboardPrefs(): SoundboardPreferences {
  if (typeof window === 'undefined') return DEFAULT_SOUNDBOARD_PREFS;
  
  try {
    const stored = localStorage.getItem(SOUNDBOARD_PREFS_KEY);
    if (stored) {
      return { ...DEFAULT_SOUNDBOARD_PREFS, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error('[Soundboard] Error reading preferences:', error);
  }
  
  return DEFAULT_SOUNDBOARD_PREFS;
}

/**
 * Save soundboard preferences to localStorage
 */
export function saveSoundboardPrefs(prefs: Partial<SoundboardPreferences>): void {
  if (typeof window === 'undefined') return;
  
  try {
    const current = getSoundboardPrefs();
    const updated = { ...current, ...prefs };
    localStorage.setItem(SOUNDBOARD_PREFS_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('[Soundboard] Error saving preferences:', error);
  }
}

/**
 * Get recently used sounds from localStorage
 */
export function getRecentSounds(): string[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const stored = localStorage.getItem(RECENT_SOUNDS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('[Soundboard] Error reading recent sounds:', error);
  }
  
  return [];
}

/**
 * Add a sound to recently used
 */
export function addToRecentSounds(soundId: string): void {
  if (typeof window === 'undefined') return;
  
  try {
    const recent = getRecentSounds().filter(id => id !== soundId);
    recent.unshift(soundId);
    const trimmed = recent.slice(0, MAX_RECENT_SOUNDS);
    localStorage.setItem(RECENT_SOUNDS_KEY, JSON.stringify(trimmed));
  } catch (error) {
    console.error('[Soundboard] Error saving recent sound:', error);
  }
}

