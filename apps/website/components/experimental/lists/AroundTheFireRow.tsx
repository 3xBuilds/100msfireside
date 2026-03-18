import React from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronRight, Hand } from "lucide-react";
import { TOKENS } from "../utils";
import { Avatar } from "../visuals";
import { HandRaiseSparks } from "../effects";

export function AroundTheFireRow(props: {
  count: number;
  people: any[];
  onOpen: () => void;
  hands: any[];
  adsOn?: boolean;
}) {
  const preview = props.people.slice(0, 7);
  const extra = Math.max(
    0,
    props.people.length - preview.length,
  );
  const hasRequests = props.hands.length > 0;

  return (
    <button
      onClick={props.onOpen}
      className="w-full rounded-3xl text-left backdrop-blur-md transition-opacity hover:opacity-90"
      style={{
        padding: props.adsOn ? "10px" : "12px",
        border: `1px solid ${TOKENS.line}`,
        background:
          "radial-gradient(120% 120% at 30% 0%, rgba(246,206,132,.05), rgba(0,0,0,0) 55%), rgba(0,0,0,.20)",
      }}
    >
      <div className="flex items-center justify-between">
        <div>
          <div
            className="text-xs font-semibold"
            style={{ color: "rgba(255,255,255,.84)" }}
          >
            Around the fire
          </div>
          <div
            className="mt-0.5 text-xs"
            style={{ color: TOKENS.muted }}
          >
            {props.count} listening
          </div>
        </div>
        <ChevronRight
          className="h-4 w-4"
          style={{ color: "rgba(255,255,255,.70)" }}
        />
      </div>

      <div
        className="flex items-center"
        style={{
          marginTop: props.adsOn ? "8px" : "12px",
          gap: 10,
          flexWrap: "nowrap",
          overflow: "hidden",
        }}
      >
        {preview.map((p) => (
          <div key={p.id} style={{ flex: "0 0 auto" }}>
            <Avatar
              img={p.img}
              name={p.name}
              size={32}
              speaking={p.speaking}
              fireDistance={0.86}
              depth={0.8}
            />
          </div>
        ))}
        {extra > 0 ? (
          <div
            className="grid place-items-center rounded-full"
            style={{
              flex: "0 0 auto",
              width: 32,
              height: 32,
              border: `1px solid ${TOKENS.line}`,
              background: "rgba(0,0,0,.18)",
            }}
          >
            <div
              className="text-[11px] font-semibold"
              style={{ color: "rgba(255,255,255,.82)" }}
            >
              +{extra}
            </div>
          </div>
        ) : null}
      </div>

      <AnimatePresence>
        {hasRequests ? (
          <motion.div
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{
              opacity: 1,
              height: "auto",
              marginTop: 12,
            }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            style={{ overflow: "hidden" }}
          >
            <div
              className="pt-3 relative"
              style={{ borderTop: `1px solid ${TOKENS.line}` }}
            >
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Hand
                    className="h-3.5 w-3.5"
                    style={{ color: TOKENS.warm }}
                  />
                  <HandRaiseSparks id="hand-sparks" />
                </div>
                <div className="flex items-center gap-1">
                  <span
                    className="text-xs font-semibold"
                    style={{ color: TOKENS.warm }}
                  >
                    {props.hands.length}
                  </span>
                  <span
                    className="text-xs"
                    style={{ color: "rgba(255,255,255,.78)" }}
                  >
                    hand{" "}
                    {props.hands.length === 1
                      ? "raise"
                      : "raises"}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div
        className="mt-2 text-[11px]"
        style={{ color: TOKENS.muted }}
      >
        Tap to see everyone & requests
      </div>
    </button>
  );
}
