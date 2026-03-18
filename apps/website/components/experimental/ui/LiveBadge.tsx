import React from "react";
import { motion } from "motion/react";
import { TOKENS } from "../utils";

export function LiveBadge() {
  return (
    <div
      className="inline-flex items-center gap-2 rounded-full px-2.5 py-1 backdrop-blur-md"
      style={{
        border: `1px solid ${TOKENS.line}`,
        background: "rgba(0,0,0,.18)",
      }}
      aria-label="Live"
      title="Live"
    >
      <motion.div
        className="h-2 w-2 rounded-full"
        animate={{
          opacity: [0.2, 1, 0.35],
          scale: [0.9, 1.05, 0.95],
        }}
        transition={{
          duration: 1.2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        style={{ background: TOKENS.ember }}
      />
      <div
        className="text-[11px] font-semibold"
        style={{ color: "rgba(255,255,255,.78)" }}
      >
        Live
      </div>
    </div>
  );
}
