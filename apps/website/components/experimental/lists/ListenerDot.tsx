import React from "react";
import { Avatar } from "../visuals";

export function ListenerDot(props: { p: any; onAvatarClick?: (id: string) => void }) {
  const p = props.p;
  const { onAvatarClick } = props;
  return (
    <div className="flex flex-col items-center">
      <Avatar
        img={p.img}
        name={p.name}
        size={34}
        speaking={p.speaking}
        fireDistance={0.92}
        depth={0.88}
        onClick={onAvatarClick ? () => onAvatarClick(p.id) : undefined}
      />
      <div
        className="mt-1 max-w-[78px] truncate text-[11px]"
        style={{ color: "rgba(255,255,255,.70)" }}
      >
        {p.name}
      </div>
    </div>
  );
}
