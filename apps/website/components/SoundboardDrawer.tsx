"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/UI/drawer";
import { HiSpeakerWave } from "react-icons/hi2";
import { IoVolumeMedium, IoVolumeHigh, IoVolumeLow, IoVolumeMute } from "react-icons/io5";
import { SoundEffect, getCategories, getSoundsByCategory, getCategoryInfo } from "@/utils/soundboard/sounds";
import { SoundNotification } from "@/components/footer/useSoundboardLogic";

interface SoundboardDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  
  // From useSoundboardLogic
  playSound: (sound: SoundEffect) => Promise<void>;
  stopSound: () => Promise<void>;
  setVolume: (volume: number) => void;
  isPlaying: boolean;
  currentSound: SoundEffect | null;
  progress: number;
  volume: number;
  cooldownRemaining: number;
  isOnCooldown: boolean;
  availableSounds: SoundEffect[];
  recentSounds: SoundEffect[];
  notifications: SoundNotification[];
  canUse: boolean;
}

/**
 * SoundTile - Individual sound button in the grid
 * Discord-style: simple button that can be rapidly pressed
 */
function SoundTile({
  sound,
  onPlay,
  disabled,
}: {
  sound: SoundEffect;
  onPlay: () => void;
  disabled: boolean;
}) {
  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.05 }}
      whileTap={{ scale: disabled ? 1 : 0.9 }}
      onClick={onPlay}
      disabled={disabled}
      className={`
        relative flex flex-col items-center justify-center gradient-purple-bg 
        p-3 rounded-xl
        transition-all duration-150
        bg-fireside-purple/10 border border-fireside-purple/10 
        hover:bg-fireside-purple/30 hover:border-fireside-purple/25
        active:bg-fireside-purple/30 active:border-fireside-purple/40
        ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
      `}
    >
      {/* Emoji */}
      <span className="text-2xl mb-1 select-none">{sound.emoji}</span>
      
      {/* Name */}
      <span className="text-xs font-medium truncate w-full text-center text-white/80 select-none">
        {sound.name}
      </span>
    </motion.button>
  );
}

/**
 * VolumeSlider - Volume control component
 */
function VolumeSlider({
  volume,
  onChange,
}: {
  volume: number;
  onChange: (value: number) => void;
}) {
  const VolumeIcon = volume === 0 
    ? IoVolumeMute 
    : volume < 33 
      ? IoVolumeLow 
      : volume < 66 
        ? IoVolumeMedium 
        : IoVolumeHigh;
  
  return (
    <div className="flex items-center gap-3 px-2">
      <VolumeIcon className="text-white/60 text-lg flex-shrink-0" />
      <input
        type="range"
        min="0"
        max="100"
        value={volume}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="slider-fireside w-full h-1 bg-white/20 rounded-full appearance-none cursor-pointer"
        style={{
          '--track-fill': `${volume}%`,
        } as React.CSSProperties}
      />
      <span className="text-xs text-white/60 w-8 text-right">{volume}%</span>
    </div>
  );
}

/**
 * SoundboardDrawer - Main soundboard UI component
 * Discord-style: allows rapid re-triggering of sounds
 */
export default function SoundboardDrawer({
  isOpen,
  onClose,
  playSound,
  setVolume,
  volume,
  availableSounds,
  recentSounds,
  notifications,
  canUse,
}: SoundboardDrawerProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const categories = getCategories();
  
  // Handle sound play - no cooldown blocking, just play
  const handlePlaySound = async (sound: SoundEffect) => {
    if (!canUse) return;
    
    try {
      await playSound(sound);
    } catch (error) {
      console.error("[SoundboardDrawer] Error playing sound:", error);
    }
  };
  
  // Get sounds to display based on active category
  const displaySounds = activeCategory 
    ? getSoundsByCategory(activeCategory as any)
    : availableSounds;
  
  return (
    <>
      <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DrawerContent className="bg-black gradient-purple-bg border-fireside-purple/30 max-h-[85vh]">
          <DrawerHeader className="pb-2 border-b-[1px] mb-4 border-fireside-lightWhite">
           <div className="flex items-center gap-2 pb-2">
            <HiSpeakerWave className="text-fireside-purple text-2xl" />
            <DrawerTitle className="text-white text-xl  font-semibold flex items-center gap-2">
              Soundboard
            </DrawerTitle>
           </div>
            
            
          </DrawerHeader>
          
          <div className="px-4 pb-6 overflow-y-auto">
            {/* Permission warning */}
            {!canUse && (
              <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <p className="text-yellow-500 text-sm text-center">
                  Only hosts, co-hosts, and speakers can use the soundboard
                </p>
              </div>
            )}
            
            {/* Volume control */}
            <div className="mb-4">
              <VolumeSlider volume={volume} onChange={setVolume} />
            </div>
            
            {/* Category tabs */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-2 hide-scrollbar">
              <button
                onClick={() => setActiveCategory(null)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  activeCategory === null
                    ? "bg-fireside-purple text-white"
                    : "bg-white/5 text-white/60 hover:bg-white/10"
                }`}
              >
                All
              </button>
              {categories.map(category => {
                const info = getCategoryInfo(category);
                return (
                  <button
                    key={category}
                    onClick={() => setActiveCategory(category)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all flex items-center gap-1 ${
                      activeCategory === category
                        ? "bg-fireside-purple text-white"
                        : "bg-white/5 text-white/60 hover:bg-white/10"
                    }`}
                  >
                    <span>{info.emoji}</span>
                    <span>{info.name}</span>
                  </button>
                );
              })}
            </div>
            
            {/* Recent sounds */}
            {recentSounds.length > 0 && activeCategory === null && (
              <div className="mb-4">
                <h3 className="text-white/60 text-xs font-medium uppercase tracking-wide mb-2">
                  Recently Used
                </h3>
                <div className="grid grid-cols-4 gap-2">
                  {recentSounds.slice(0, 4).map(sound => (
                    <SoundTile
                      key={`recent-${sound.id}`}
                      sound={sound}
                      onPlay={() => handlePlaySound(sound)}
                      disabled={!canUse}
                    />
                  ))}
                </div>
              </div>
            )}
            
            {/* All sounds grid */}
            <div>
              <h3 className="text-white/60 text-xs font-medium uppercase tracking-wide mb-2">
                {activeCategory ? getCategoryInfo(activeCategory as any).name : "All Sounds"}
              </h3>
              <div className="grid grid-cols-4 gap-2">
                {displaySounds.map(sound => (
                  <SoundTile
                    key={sound.id}
                    sound={sound}
                    onPlay={() => handlePlaySound(sound)}
                    disabled={!canUse}
                  />
                ))}
              </div>
            </div>
            
            {/* Empty state */}
            {displaySounds.length === 0 && (
              <div className="text-center py-8 text-white/40">
                No sounds available
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>
      
      {/* Floating notifications */}
      <AnimatePresence>
        {notifications.map(notification => (
          <motion.div
            key={notification.id}
            initial={{ opacity: 0, y: 50, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.8 }}
            className="fixed bottom-36 left-1/2 -translate-x-1/2 z-[10001] pointer-events-none"
          >
            <div className="bg-fireside-darkOrange/95 border border-fireside-orange/30 rounded-2xl px-4 py-3 shadow-xl flex items-center gap-3">
              <span className="text-3xl">{notification.soundEmoji}</span>
              <div>
                <p className="text-white font-medium">{notification.soundName}</p>
                <p className="text-white/60 text-sm">by {notification.senderName}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </>
  );
}
