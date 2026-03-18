import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import { TOKENS } from "../utils";

export function BottomSheet(props: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence>
      {props.open ? (
        <>
          <motion.div
            className="fixed inset-0 z-[60]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={props.onClose}
            style={{ background: "rgba(0,0,0,.65)" }}
          />
          <motion.div
            className="fixed inset-x-0 bottom-0 z-[70] mx-auto w-[390px] max-w-full"
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{
              type: "spring",
              damping: 22,
              stiffness: 240,
            }}
          >
            <div
              className="rounded-t-[28px] backdrop-blur-xl"
              style={{
                border: `1px solid ${TOKENS.line}`,
                background: "rgba(0,0,0,.50)",
              }}
            >
              <div className="flex items-center justify-between px-4 pt-3">
                <div
                  className="h-1.5 w-10 rounded-full"
                  style={{
                    background: "rgba(255,255,255,.15)",
                  }}
                />
                <button
                  onClick={props.onClose}
                  className="grid h-9 w-9 place-items-center rounded-2xl backdrop-blur-sm"
                  style={{
                    border: `1px solid ${TOKENS.line}`,
                    background: "rgba(0,0,0,.22)",
                  }}
                >
                  <X
                    className="h-4 w-4"
                    style={{ color: "rgba(255,255,255,.78)" }}
                  />
                </button>
              </div>
              <div className="px-1 pb-5 pt-3">
                {props.children}
              </div>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
