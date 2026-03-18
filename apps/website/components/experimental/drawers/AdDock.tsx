import React from "react";
import { AnimatePresence, motion } from "motion/react";
import { TOKENS } from "../utils";

export function AdDock(props: { on: boolean; above: number }) {
  const GAP = 14;
  
  return (
    <AnimatePresence>
      {props.on ? (
        <motion.div
          className="absolute inset-x-0 z-20 px-4"
          style={{
            bottom: props.above + GAP,
          }}
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          aria-label="Sponsored content"
        >
          <div
            className="rounded-3xl p-3 backdrop-blur-xl"
            style={{
              border: `1px solid ${TOKENS.line}`,
              background:
                "radial-gradient(120% 120% at 20% 0%, rgba(246,206,132,.05), rgba(0,0,0,0) 55%), rgba(0,0,0,.32)",
            }}
          >
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div
                    className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                    style={{
                      border: `1px solid ${TOKENS.line}`,
                      background: "rgba(0,0,0,.20)",
                      color: "rgba(255,255,255,.75)",
                    }}
                  >
                    Sponsored
                  </div>
                  <div
                    className="text-[11px]"
                    style={{ color: TOKENS.muted }}
                  >
                    Aurora Deploy
                  </div>
                </div>
                <div
                  className="mt-1 truncate text-xs"
                  style={{ color: "rgba(255,255,255,.82)" }}
                >
                  One-click previews • safe rollbacks • realtime
                  logs
                </div>
              </div>
              <div
                className="ml-3 overflow-hidden rounded-2xl"
                style={{
                  width: 74,
                  height: 48,
                  border: `1px solid ${TOKENS.line}`,
                }}
              >
                <div
                  className="h-full w-full"
                  style={{
                    background:
                      "radial-gradient(90% 120% at 18% 30%, rgba(246,206,132,.16), rgba(255,90,106,.08) 45%, rgba(0,0,0,.10) 100%), " +
                      "linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.02))",
                  }}
                />
              </div>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
