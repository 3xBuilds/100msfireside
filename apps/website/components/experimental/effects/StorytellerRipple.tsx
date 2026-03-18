import React from "react";
import { motion } from "motion/react";

export function StorytellerRipple(props: { speaking: boolean }) {
  if (!props.speaking) return null;
  return (
    <div className="absolute inset-0 pointer-events-none">
      <motion.div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          width: 84,
          height: 84,
          border: `1px solid rgba(246,206,132,.22)`,
        }}
        initial={{ opacity: 0, scale: 1 }}
        animate={{ opacity: [0.55, 0], scale: [1, 1.85] }}
        transition={{
          duration: 2.5,
          repeat: Infinity,
          ease: "easeOut",
        }}
      />
      <motion.div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          width: 84,
          height: 84,
          border: `1px solid rgba(255,90,106,.18)`,
        }}
        initial={{ opacity: 0, scale: 1 }}
        animate={{ opacity: [0.45, 0], scale: [1, 2.25] }}
        transition={{
          duration: 2.5,
          repeat: Infinity,
          ease: "easeOut",
          delay: 1.25,
        }}
      />
    </div>
  );
}
