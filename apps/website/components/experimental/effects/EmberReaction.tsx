import React from "react";
import { motion } from "motion/react";
import { TOKENS } from "../utils";

export function EmberReaction(props: {
  emoji: string;
  id: string;
  left: number;
}) {
  return (
    <motion.div
      className="absolute"
      initial={{ opacity: 0, y: 14, scale: 0.9, rotate: 0 }}
      animate={{
        opacity: [0, 1, 1, 0],
        y: -140,
        scale: 1.1,
        rotate: [-5, 5, -3],
      }}
      exit={{ opacity: 0 }}
      transition={{ duration: 2.2, ease: "easeOut" }}
      style={{ left: props.left, bottom: 48, zIndex: 35 }}
    >
      <div
        className="grid h-9 w-9 place-items-center rounded-2xl backdrop-blur-md"
        style={{
          border: `1px solid ${TOKENS.line}`,
          background: "rgba(0,0,0,.26)",
          boxShadow: "0 0 20px rgba(255,90,106,.13)",
        }}
      >
        <div style={{ fontSize: 18 }}>{props.emoji}</div>
      </div>
    </motion.div>
  );
}
