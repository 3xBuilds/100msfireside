/**
 * Sound effect definitions for the soundboard feature
 * 
 * These sounds are designed to mimic Discord's soundboard functionality
 * with categorization for easy UI organization.
 */

export type SoundCategory = 'reaction' | 'comedy' | 'effect' | 'meme';

/**
 * SoundEffect represents a single sound that can be played via the soundboard
 */
export interface SoundEffect {
  /** Unique identifier for the sound */
  id: string;
  /** Display name for the sound */
  name: string;
  /** Emoji representation for visual display */
  emoji: string;
  /** Path to the audio file (relative to public folder) */
  file: string;
  /** Category for grouping in UI */
  category: SoundCategory;
  /** Duration in milliseconds */
  duration: number;
  /** Optional description or tooltip text */
  description?: string;
  /** Whether this sound is available (for future premium sounds) */
  available?: boolean;
}

/**
 * Default soundboard sounds - Discord-style sound effects
 * 
 * Note: You'll need to add the actual .mp3 files to /public/sounds/
 * These can be sourced from royalty-free sound libraries.
 */
export const SOUNDBOARD_SOUNDS: SoundEffect[] = [
  // Reaction sounds
  {
    id: 'airhorn',
    name: 'Airhorn',
    emoji: '📯',
    file: '/sounds/airhorn.mp3',
    category: 'reaction',
    duration: 2000,
    description: 'Classic airhorn sound',
    available: true,
  },
  {
    id: 'applause',
    name: 'Applause',
    emoji: '👏',
    file: '/sounds/applause.mp3',
    category: 'reaction',
    duration: 3500,
    description: 'Crowd applause',
    available: true,
  },
//   {
//     id: 'cheering',
//     name: 'Cheering',
//     emoji: '🎉',
//     file: '/sounds/cheering.mp3',
//     category: 'reaction',
//     duration: 3000,
//     description: 'Crowd cheering',
//     available: true,
//   },
//   {
//     id: 'golf-clap',
//     name: 'Golf Clap',
//     emoji: '⛳',
//     file: '/sounds/golf-clap.mp3',
//     category: 'reaction',
//     duration: 2500,
//     description: 'Polite golf clap',
//     available: true,
//   },
//   {
//     id: 'wow',
//     name: 'Wow',
//     emoji: '😮',
//     file: '/sounds/wow.mp3',
//     category: 'reaction',
//     duration: 1500,
//     description: 'Owen Wilson wow',
//     available: true,
//   },

  // Comedy sounds
  {
    id: 'ba-dum-tss',
    name: 'Ba Dum Tss',
    emoji: '🥁',
    file: '/sounds/ba-dum-tss.mp3',
    category: 'comedy',
    duration: 1500,
    description: 'Rimshot after a joke',
    available: true,
  },
  {
    id: 'crickets',
    name: 'Crickets',
    emoji: '🦗',
    file: '/sounds/crickets.mp3',
    category: 'comedy',
    duration: 3000,
    description: 'Awkward silence crickets',
    available: true,
  },
  {
    id: 'sad-trombone',
    name: 'Sad Trombone',
    emoji: '😢',
    file: '/sounds/sad-trombone.mp3',
    category: 'comedy',
    duration: 2000,
    description: 'Wah wah wah waaah',
    available: true,
  },
//   {
//     id: 'laugh-track',
//     name: 'Laugh Track',
//     emoji: '😂',
//     file: '/sounds/laugh-track.mp3',
//     category: 'comedy',
//     duration: 3500,
//     description: 'Sitcom laugh track',
//     available: true,
//   },
//   {
//     id: 'boo',
//     name: 'Boo',
//     emoji: '👎',
//     file: '/sounds/boo.mp3',
//     category: 'comedy',
//     duration: 2500,
//     description: 'Crowd booing',
//     available: true,
//   },

  // Effect sounds
//   {
//     id: 'quack',
//     name: 'Quack',
//     emoji: '🦆',
//     file: '/sounds/quack.mp3',
//     category: 'effect',
//     duration: 500,
//     description: 'Duck quack',
//     available: true,
//   },
//   {
//     id: 'police-siren',
//     name: 'Police',
//     emoji: '🚨',
//     file: '/sounds/police-siren.mp3',
//     category: 'effect',
//     duration: 2500,
//     description: 'Police siren',
//     available: true,
//   },
//   {
//     id: 'ding',
//     name: 'Ding',
//     emoji: '🔔',
//     file: '/sounds/ding.mp3',
//     category: 'effect',
//     duration: 1000,
//     description: 'Bell ding',
//     available: true,
//   },
//   {
//     id: 'explosion',
//     name: 'Explosion',
//     emoji: '💥',
//     file: '/sounds/explosion.mp3',
//     category: 'effect',
//     duration: 2000,
//     description: 'Boom explosion',
//     available: true,
//   },

  // Meme sounds
//   {
//     id: 'mlg-horn',
//     name: 'MLG Horn',
//     emoji: '🎺',
//     file: '/sounds/mlg-horn.mp3',
//     category: 'meme',
//     duration: 3000,
//     description: 'MLG airhorn remix',
//     available: true,
//   },
//   {
//     id: 'bruh',
//     name: 'Bruh',
//     emoji: '😑',
//     file: '/sounds/bruh.mp3',
//     category: 'meme',
//     duration: 1000,
//     description: 'Bruh moment',
//     available: true,
//   },
//   {
//     id: 'vine-boom',
//     name: 'Vine Boom',
//     emoji: '📺',
//     file: '/sounds/vine-boom.mp3',
//     category: 'meme',
//     duration: 1500,
//     description: 'Vine boom sound effect',
//     available: true,
//   },
  {
    id: 'sus',
    name: 'Sus',
    emoji: '📮',
    file: '/sounds/sus.mp3',
    category: 'meme',
    duration: 2000,
    description: 'Among Us sus',
    available: true,
  },
];

/**
 * Get all available sounds
 */
export function getAvailableSounds(): SoundEffect[] {
  return SOUNDBOARD_SOUNDS.filter(sound => sound.available !== false);
}

/**
 * Get sounds by category
 */
export function getSoundsByCategory(category: SoundCategory): SoundEffect[] {
  return SOUNDBOARD_SOUNDS.filter(
    sound => sound.category === category && sound.available !== false
  );
}

/**
 * Get a sound by its ID
 */
export function getSoundById(id: string): SoundEffect | undefined {
  return SOUNDBOARD_SOUNDS.find(sound => sound.id === id);
}

/**
 * Get all unique categories
 */
export function getCategories(): SoundCategory[] {
  return ['reaction', 'comedy', 'effect', 'meme'];
}

/**
 * Get category display info
 */
export function getCategoryInfo(category: SoundCategory): { name: string; emoji: string } {
  const categoryMap: Record<SoundCategory, { name: string; emoji: string }> = {
    reaction: { name: 'Reactions', emoji: '👏' },
    comedy: { name: 'Comedy', emoji: '😂' },
    effect: { name: 'Effects', emoji: '🔊' },
    meme: { name: 'Memes', emoji: '🎺' },
  };
  return categoryMap[category];
}

