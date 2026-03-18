import React from "react";
import { TOKENS } from "../utils";

export function SegTab(props: {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const active = !!props.active;
  return (
    <button
      onClick={props.onClick}
      className={
        "flex-1 rounded-full px-3 py-2 text-xs font-semibold transition backdrop-blur-sm " +
        (active
          ? "text-white"
          : "text-white/70 hover:bg-white/[0.03]")
      }
      style={{
        border: `1px solid ${active ? "rgba(255,255,255,.08)" : "transparent"}`,
        background: active
          ? "rgba(255,255,255,.06)"
          : "transparent",
      }}
    >
      {props.children}
    </button>
  );
}
