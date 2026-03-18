import React from "react";

export function StarRings() {
  return (
    <svg
      width="170"
      height="140"
      viewBox="0 0 170 140"
      className="absolute -left-10 -top-10 pointer-events-none"
      aria-hidden="true"
    >
      <defs>
        <radialGradient
          id="ringGlow"
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(40 40) rotate(45) scale(140 140)"
        >
          <stop offset="0" stopColor="rgba(246,206,132,.14)" />
          <stop
            offset="0.45"
            stopColor="rgba(255,255,255,.06)"
          />
          <stop offset="1" stopColor="rgba(0,0,0,0)" />
        </radialGradient>
      </defs>

      <circle
        cx="40"
        cy="40"
        r="34"
        fill="none"
        stroke="rgba(255,255,255,.10)"
        strokeWidth="1"
      />
      <circle
        cx="40"
        cy="40"
        r="58"
        fill="none"
        stroke="rgba(255,255,255,.07)"
        strokeWidth="1"
      />
      <circle
        cx="40"
        cy="40"
        r="86"
        fill="none"
        stroke="rgba(255,255,255,.05)"
        strokeWidth="1"
      />
      <circle
        cx="40"
        cy="40"
        r="116"
        fill="none"
        stroke="rgba(255,255,255,.04)"
        strokeWidth="1"
      />
      <circle
        cx="40"
        cy="40"
        r="130"
        fill="url(#ringGlow)"
        opacity="0.85"
      />

      <g fill="rgba(255,255,255,.45)">
        <circle cx="18" cy="62" r="1.4" />
        <circle cx="64" cy="24" r="1.2" />
        <circle cx="92" cy="52" r="1.0" />
        <circle cx="108" cy="86" r="1.0" />
      </g>
      <g fill="rgba(246,206,132,.35)">
        <circle cx="122" cy="26" r="2.2" />
      </g>
    </svg>
  );
}
