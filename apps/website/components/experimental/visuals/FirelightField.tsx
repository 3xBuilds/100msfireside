import React from "react";
import { motion } from "motion/react";
import { clamp } from "../utils";

export function FirelightField(props: { flicker: number }) {
  const o = clamp(0.55 * props.flicker, 0.38, 0.75);
  const blur = 22 + props.flicker * 10;

  return (
    <>
      <motion.div
        className="pointer-events-none absolute inset-0"
        animate={{ opacity: [o * 0.92, o, o * 0.94] }}
        transition={{
          duration: 2.6,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        style={{
          background:
            "radial-gradient(120% 90% at 50% 54%, rgba(246,206,132,.18), rgba(255,90,106,.10) 28%, rgba(255,90,106,.05) 48%, rgba(0,0,0,0) 72%)",
          filter: `blur(${blur}px)`,
          opacity: o,
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 95% at 50% 40%, rgba(0,0,0,0) 55%, rgba(0,0,0,.70) 100%)",
          opacity: 0.9,
        }}
      />
    </>
  );
}
