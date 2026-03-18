import React, { useRef, useEffect, useState } from "react";
import { motion } from "motion/react";

export function ScrollingName({ name, className, style }: { name: string; className?: string; style?: React.CSSProperties }) {
  const textRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [scrollDistance, setScrollDistance] = useState(0);

  useEffect(() => {
    if (textRef.current && containerRef.current) {
      const textWidth = textRef.current.scrollWidth;
      const containerWidth = containerRef.current.clientWidth;
      // Add a 2px threshold to prevent false positives from rounding errors
      const overflow = textWidth > containerWidth + 2;
      setIsOverflowing(overflow);
      if (overflow) {
        setScrollDistance(textWidth - containerWidth);
      }
    }
  }, [name]);

  return (
    <div ref={containerRef} className={className} style={{ ...style, overflow: 'hidden', position: 'relative' }}>
      {isOverflowing ? (
        <motion.div
          ref={textRef}
          animate={{
            x: [0, -scrollDistance, -scrollDistance, 0],
          }}
          transition={{
            duration: Math.max(3, scrollDistance / 20),
            repeat: Infinity,
            ease: "linear",
            repeatDelay: 1.5,
          }}
          style={{ whiteSpace: 'nowrap', display: 'inline-block' }}
        >
          {name}
        </motion.div>
      ) : (
        <div ref={textRef} style={{ whiteSpace: 'nowrap' }}>
          {name}
        </div>
      )}
    </div>
  );
}
