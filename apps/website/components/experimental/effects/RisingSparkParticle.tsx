import React from "react";
import { motion } from "motion/react";
import { TOKENS } from "../utils";

export function RisingSparkParticle(props: {
  id: string;
  delay: number;
}) {
  return (
    <motion.div
      className="absolute rounded-full"
      style={{
        width: 3,
        height: 3,
        left: "50%",
        bottom: 0,
        background: TOKENS.warm,
        boxShadow: "0 0 8px rgba(246,206,132,.6)",
      }}
      initial={{ opacity: 0, y: 0, x: 0 }}
      animate={{
        opacity: [0, 1, 1, 0],
        y: -50,
        x: [0, Math.random() * 20 - 10],
      }}
      transition={{
        duration: 1.5,
        ease: "easeOut",
        delay: props.delay,
      }}
    />
  );
}
