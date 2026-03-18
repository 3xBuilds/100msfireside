import React, { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, MessageCircle, Gift, Mic, MicOff, Hand, Sparkles, Volume2, Coins, SmilePlus } from "lucide-react";
import { TOKENS } from "../utils";
import { IconButton } from "../ui";
import { GiMicrophone } from "react-icons/gi";

export function ControlCenterDrawer(props: {
  open: boolean;
  setOpen: (v: boolean) => void;
  muted: boolean;
  setMuted: (v: boolean) => void;
  handUp: boolean;
  setHandUp: (v: boolean) => void;
  onReact: () => void;
  onChat: () => void;
  onTip: () => void;
  onSoundboard: () => void;
  onVisibleHeightChange?: (h: number) => void;
  canUnmute: boolean;
  isListener: boolean;
  canRequestToSpeak: boolean;
}) {
  const collapsedH = 118;
  const expandedH = 230;

  useEffect(() => {
    props.onVisibleHeightChange?.(collapsedH);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div
      className="absolute inset-x-0 bottom-0 pb-5 flex items-center justify-center w-screen"
      style={{
        height: props.open ? expandedH : collapsedH,
        zIndex: 50,
      }}
      initial={false}
      animate={{ height: props.open ? expandedH : collapsedH }}
      transition={{
        type: "spring",
        damping: 26,
        stiffness: 280,
      }}
      drag="y"
      dragElastic={0.06}
      dragMomentum={false}
      dragConstraints={{ top: 0, bottom: 0 }}
      onDragEnd={(_:any, info:any) => {
        const v = info.velocity.y;
        if (v < -220) props.setOpen(true);
        else if (v > 220) props.setOpen(false);
      }}
      aria-label="Control center drawer"
    >
      <div
        className="h-full w-[95%] rounded-3xl backdrop-blur-xl gradient-yellow-bg"
        style={{
          border: `1px solid ${TOKENS.line}`,
        }}
      >
        <button
          onClick={() => props.setOpen(!props.open)}
          className="flex w-full items-center justify-center pt-2"
          aria-label={
            props.open
              ? "Collapse control center"
              : "Expand control center"
          }
        >
          <div
            className="h-1.5 w-12 rounded-full"
            style={{ background: "rgba(255,255,255,.15)" }}
          />
        </button>

        <AnimatePresence>
          {props.open ? (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.16 }}
              className="px-3 pt-2"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div
                    className="text-xs font-semibold"
                    style={{ color: "rgba(255,255,255,.84)" }}
                  >
                    Control center
                  </div>
                  <div
                    className="mt-0.5 text-[11px]"
                    style={{ color: TOKENS.muted }}
                  >
                    Soundboard & future integrations live here
                  </div>
                </div>
                <button
                  onClick={() => props.setOpen(false)}
                  className="grid h-9 w-9 place-items-center rounded-2xl backdrop-blur-sm"
                  style={{
                    border: `1px solid ${TOKENS.line}`,
                    background: "rgba(0,0,0,.22)",
                  }}
                  aria-label="Close"
                >
                  <ChevronDown
                    className="h-4 w-4"
                    style={{ color: "rgba(255,255,255,.78)" }}
                  />
                </button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="px-3 pt-3">
          <div className="flex items-center justify-between">
            <IconButton label="Chat" onClick={props.onChat}>
              <MessageCircle
                className="h-5 w-5"
                style={{ color: "rgba(255,255,255,.78)" }}
              />
            </IconButton>

            <IconButton label="Tip" onClick={props.onTip}>
              <Coins
                className="h-5 w-5"
                style={{ color: "rgba(255,255,255,.78)" }}
              />
            </IconButton>

            <motion.button
              onClick={() => props.setMuted(!props.muted)}
              whileTap={{ scale: 0.98 }}
              className="grid h-12 w-[120px] place-items-center rounded-2xl text-sm font-semibold backdrop-blur-md"
              style={{
                border: `1px solid ${props.isListener && !props.canUnmute ? (props.canRequestToSpeak ? "rgba(255,220,90,.32)" : "rgba(156,163,175,.32)") : (props.muted ? TOKENS.line : "rgba(255,90,106,.32)")}`,
                background: props.isListener && !props.canUnmute
                  ? (props.canRequestToSpeak ? "rgba(255,220,90,.11)" : "rgba(156,163,175,.11)")
                  : (props.muted ? "rgba(0,0,0,.22)" : "rgba(255,90,106,.11)"),
                color: TOKENS.text,
                boxShadow: props.isListener && !props.canUnmute
                  ? (props.canRequestToSpeak ? "0 0 22px rgba(255,220,90,.13)" : "none")
                  : (props.muted ? "none" : "0 0 22px rgba(255,90,106,.13)"),
              }}
              aria-label={
                props.isListener && !props.canUnmute
                  ? (props.canRequestToSpeak ? "Request to speak" : "Request sent")
                  : (props.muted ? "Unmute" : "Mute")
              }
            >
              <div className="flex items-center gap-2">
                {props.isListener && !props.canUnmute ? (
                  <>
                    <GiMicrophone className="h-5 w-5" />
                    <span className="text-xs">{props.canRequestToSpeak ? "Request" : "Sent"}</span>
                  </>
                ) : (
                  <>
                    {props.muted ? (
                      <MicOff className="h-5 w-5" />
                    ) : (
                      <Mic className="h-5 w-5" />
                    )}
                    <span className="text-xs">
                      {props.muted ? "Muted" : "Live"}
                    </span>
                  </>
                )}
              </div>
            </motion.button>

            <IconButton
              label="Raise hand"
              onClick={() => props.setHandUp(!props.handUp)}
              active={props.handUp}
            >
              <Hand
                className="h-5 w-5"
                style={{ color: "rgba(255,255,255,.78)" }}
              />
            </IconButton>

            <IconButton label="React" onClick={props.onReact}>
              <SmilePlus
                className="h-5 w-5"
                style={{ color: "rgba(255,255,255,.78)" }}
              />
            </IconButton>
          </div>
        </div>

        <AnimatePresence>
          {props.open ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.18 }}
              className="px-3 pt-3"
            >
              <div className="grid grid-cols-1 gap-2">
                {/* <div
                  className="rounded-2xl p-3 backdrop-blur-sm"
                  style={{
                    border: `1px solid ${TOKENS.line}`,
                    background: "rgba(0,0,0,.18)",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <MessageCircle
                      className="h-4 w-4"
                      style={{ color: "rgba(255,255,255,.78)" }}
                    />
                    <div
                      className="text-xs font-semibold"
                      style={{ color: "rgba(255,255,255,.84)" }}
                    >
                      Chat
                    </div>
                  </div>
                  <div
                    className="mt-1 text-[11px]"
                    style={{ color: TOKENS.muted }}
                  >
                    messages
                  </div>
                </div>

                <div
                  className="rounded-2xl p-3 backdrop-blur-sm"
                  style={{
                    border: `1px solid ${TOKENS.line}`,
                    background: "rgba(0,0,0,.18)",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Gift
                      className="h-4 w-4"
                      style={{ color: "rgba(255,255,255,.78)" }}
                    />
                    <div
                      className="text-xs font-semibold"
                      style={{ color: "rgba(255,255,255,.84)" }}
                    >
                      Tip
                    </div>
                  </div>
                  <div
                    className="mt-1 text-[11px]"
                    style={{ color: TOKENS.muted }}
                  >
                    support hosts
                  </div>
                </div> */}

                <button
                  onClick={props.onSoundboard}
                  className="w-full rounded-2xl p-3 gradient-purple-bg backdrop-blur-sm h-16 flex justify-center transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={{
                    border: `1px solid ${TOKENS.line}`,
                  }}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Volume2
                      className="h-6 w-6"
                      style={{ color: "rgba(255,255,255,.78)" }}
                    />
                    <div
                      className="text-md font-semibold"
                      style={{ color: "rgba(255,255,255,.84)" }}
                    >
                      Soundboard
                    </div>
                  </div>
                  {/* <div
                    className="mt-1 text-[11px]"
                    style={{ color: TOKENS.muted }}
                  >
                    clips & sfx
                  </div> */}
                </button>

                {/* {Array.from({ length: 3 }, (_, i) => (
                  <div
                    key={i}
                    className="rounded-2xl p-3"
                    style={{
                      border: `1px dashed ${TOKENS.line}`,
                      background: "rgba(0,0,0,.10)",
                    }}
                  >
                    <div
                      className="text-xs font-semibold"
                      style={{ color: "rgba(255,255,255,.45)" }}
                    >
                      + Add
                    </div>
                    <div
                      className="mt-1 text-[11px]"
                      style={{ color: TOKENS.muted }}
                    >
                      integration
                    </div>
                  </div>
                ))} */}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
