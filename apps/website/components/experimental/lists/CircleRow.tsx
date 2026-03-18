import React from "react";
import { TOKENS } from "../utils";
import { Avatar } from "../visuals";

export function CircleRow(props: { p: any; onAvatarClick?: (id: string) => void }) {
  const p = props.p;
  const { onAvatarClick } = props;
  return (
    <div
      className="flex items-center gap-3 rounded-2xl px-3 py-2 backdrop-blur-sm"
      style={{
        border: `1px solid ${TOKENS.line}`,
        background: "rgba(0,0,0,.18)",
      }}
    >
      <Avatar
        img={p.img}
        name={p.name}
        size={38}
        speaking={p.speaking}
        strong={p.role !== "Speaker"}
        fireDistance={0.65}
        depth={0.55}
        onClick={onAvatarClick ? () => onAvatarClick(p.id) : undefined}
      />
      <div className="min-w-0 flex-1">
        <div
          className="truncate text-sm"
          style={{ color: TOKENS.text }}
        >
          {p.name}
        </div>
        <div
          className="text-xs"
          style={{ color: TOKENS.muted }}
        >
          {p.role}
        </div>
      </div>
      <div
        className="h-2 w-2 rounded-full"
        style={{
          background: p.speaking
            ? TOKENS.ember
            : "rgba(255,255,255,.12)",
        }}
      />
    </div>
  );
}
