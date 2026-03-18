import React from "react";
import { BadgePercent } from "lucide-react";
import { TOKENS } from "../utils";

export function AdsToggle(props: {
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={props.onToggle}
      className="flex items-center gap-2 rounded-full px-2.5 py-1 backdrop-blur-md"
      style={{
        border: `1px solid ${TOKENS.line}`,
        background: "rgba(0,0,0,.18)",
      }}
      aria-label="Toggle ads preview"
      title="Toggle ads preview"
    >
      <BadgePercent
        className="h-4 w-4"
        style={{ color: "rgba(255,255,255,.78)" }}
      />
      <div
        className="text-[11px] font-semibold"
        style={{ color: "rgba(255,255,255,.78)" }}
      >
        Ads
      </div>
      <div
        className="h-2 w-2 rounded-full"
        style={{
          background: props.on
            ? "rgba(246,206,132,.70)"
            : "rgba(255,255,255,.22)",
        }}
      />
    </button>
  );
}
