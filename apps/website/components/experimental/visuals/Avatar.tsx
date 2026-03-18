import React, { useMemo } from "react";
import { motion } from "motion/react";
import { initials, hash01, clamp, TOKENS } from "../utils";

export function Avatar(props: {
  name: string;
  img?: string;
  size?: number;
  speaking?: boolean;
  strong?: boolean;
  storyteller?: boolean;
  fireDistance?: number;
  depth?: number;
  onClick?: () => void;
}) {
  const { name, img, onClick } = props;
  const size = props.size ?? 44;
  const speaking = !!props.speaking;
  const strong = !!props.strong;
  const storyteller = !!props.storyteller;
  const fireDistance = props.fireDistance ?? 0.6;
  const depth = clamp(props.depth ?? 0.5, 0, 1);

  const tone = useMemo(() => {
    const t = hash01(name);
    const a = 18 + Math.round(t * 10);
    const b = 22 + Math.round(t * 10);
    return `rgb(${a},${a},${b})`;
  }, [name]);

  const rimIntensity = 1 - fireDistance * 0.75;
  const rimColor = `rgba(246,206,132,${rimIntensity * 0.48})`;
  const dim = 1 - depth * 0.22;

  return (
    <div
      className="relative"
      style={{ width: size, height: size, opacity: dim, cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}
    >
      <div
        className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full blur-md"
        style={{
          width: size * 0.72,
          height: size * 0.22,
          background: "rgba(0,0,0,.42)",
          opacity: 0.45 + (1 - depth) * 0.18,
        }}
      />

      {storyteller ? (
        <motion.div
          className="absolute -inset-4 rounded-full"
          animate={{
            opacity: [0.18, 0.42, 0.22],
            scale: [1, 1.05, 1],
          }}
          transition={{
            duration: 2.3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          style={{
            background:
              "radial-gradient(circle at 50% 55%, rgba(246,206,132,.26), rgba(255,90,106,.16) 52%, rgba(0,0,0,0) 72%)",
            filter: "blur(10px)",
          }}
        />
      ) : null}

      <motion.div
        className="absolute -inset-1 rounded-full"
        animate={
          speaking
            ? {
                opacity: [0.0, 0.55, 0.12],
                scale: [1, 1.03, 1],
              }
            : { opacity: 0, scale: 1 }
        }
        transition={{
          duration: 1.2,
          repeat: speaking ? Infinity : 0,
          ease: "easeInOut",
        }}
        style={{
          background: `radial-gradient(circle at 50% 45%, ${TOKENS.emberRing}, rgba(0,0,0,0) 65%)`,
        }}
      />

      <div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          background: `radial-gradient(circle at 30% 72%, ${rimColor}, transparent 52%)`,
          opacity: rimIntensity,
        }}
      />

      <div
        className="relative grid place-items-center rounded-full"
        style={{
          width: size,
          height: size,
          background:
            "radial-gradient(80% 80% at 30% 25%, rgba(255,255,255,.08), rgba(255,255,255,.02) 55%, rgba(0,0,0,.55) 100%)",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,.035)",
          border: `2px solid ${
            speaking
              ? "rgba(246,206,132,.85)"
              : strong || storyteller
              ? "rgba(255,255,255,.14)"
              : "rgba(255,255,255,.05)"
          }`,
          filter: storyteller
            ? "drop-shadow(0 10px 26px rgba(0,0,0,.50))"
            : "drop-shadow(0 8px 18px rgba(0,0,0,.42))",
        }}
      >

        <div
          className="absolute inset-0 rounded-full"
          style={{
            background:
              "radial-gradient(120% 100% at 30% 20%, rgba(255,255,255,.05), rgba(0,0,0,0) 55%), " +
              tone,
            opacity: 0.9,
          }}
        />
        {img ? (
          <img
            src={img}
            alt={name}
            className="absolute inset-0 w-full h-full rounded-full object-cover"
            style={{ zIndex: 5 }}
          />
        ) : (
          <div
            className="relative z-10 font-semibold"
            style={{
              color: "rgba(255,255,255,.88)",
              fontSize: Math.max(11, Math.floor(size * 0.28)),
              letterSpacing: "0.02em",
            }}
          >
            {initials(name)}
          </div>
        )}
      </div>
    </div>
  );
}
