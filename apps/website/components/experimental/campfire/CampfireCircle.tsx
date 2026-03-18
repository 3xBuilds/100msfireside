import React from "react";
import { AnimatePresence } from "motion/react";
import { clamp } from "../utils";
import { Avatar, ScrollingName } from "../visuals";
import { EmberReaction, StorytellerRipple } from "../effects";
import { CampfireMark } from "../visuals";

export function CampfireCircle(props: {
  people: any[];
  maxVisible?: number;
  onMore?: () => void;
  reactions: { id: string; emoji: string; left: number }[];
  flicker: number;
  onAvatarClick?: (id: string) => void;
}) {
  const maxVisible = props.maxVisible ?? 9;

  const W = 300;
  const H = 300;
  const cx = W / 2;
  const cy = H / 2 + 18;

  const storyteller =
    props.people.find((p) => p.speaking) ||
    props.people.find((p) => p.role === "Host") ||
    props.people[0];

  const rest = props.people.filter(
    (p) => p.id !== storyteller?.id,
  );
  const roleWeight = (p: any) =>
    p.role === "Host" ? 0 : p.role === "Co-host" ? 1 : 2;
  const orderedRest = [...rest].sort(
    (a, b) => roleWeight(a) - roleWeight(b),
  );

  const arcSlots = Math.max(0, maxVisible - 1);
  const overflow = Math.max(0, orderedRest.length - arcSlots);
  const showExtra = overflow > 0;

  const visiblePeople = showExtra
    ? orderedRest.slice(0, arcSlots - 1)
    : orderedRest.slice(0, arcSlots);
  const extraCount = showExtra
    ? orderedRest.length - visiblePeople.length
    : 0;

  const fire = { x: cx, y: cy + 44 };

  const storytellerPos = { x: cx, y: cy - 100 };

  const startAngle = 212;
  const endAngle = -32;
  const rx = 136;
  const ry = 98;

  const slotCount = arcSlots;
  const angles = Array.from({ length: slotCount }, (_, i) => {
    const t = slotCount <= 1 ? 0.5 : i / (slotCount - 1);
    return startAngle + (endAngle - startAngle) * t;
  });

  const slotPositions = angles.map((angle) => {
    const rad = (angle * Math.PI) / 180;
    const x = cx + rx * Math.cos(rad);
    const y = cy + ry * Math.sin(rad) + 6;
    const dx = x - fire.x;
    const dy = y - fire.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const fireDistance = clamp(dist / 310, 0, 1);
    return { x, y, fireDistance };
  });

  const storytellerFireDist = (() => {
    const dx = storytellerPos.x - fire.x;
    const dy = storytellerPos.y - fire.y;
    return clamp(Math.sqrt(dx * dx + dy * dy) / 310, 0, 1);
  })();

  return (
    <div
      className="relative mx-auto"
      style={{ width: W, height: H }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 64% 44% at 50% 68%, rgba(0,0,0,.34), rgba(0,0,0,0) 72%), " +
            "radial-gradient(ellipse 72% 52% at 50% 72%, rgba(255,255,255,.02), rgba(0,0,0,0) 62%)",
          opacity: 0.92,
        }}
      />

      <div
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{
          width: 420,
          height: 420,
          background:
            "radial-gradient(circle at 50% 58%, rgba(246,206,132,.10), rgba(255,90,106,.055) 34%, rgba(0,0,0,0) 72%)",
          filter: `blur(${22 + props.flicker * 6}px)`,
          opacity: clamp(0.42 * props.flicker, 0.22, 0.5),
        }}
      />

      <AnimatePresence>
        {props.reactions.map((r) => (
          <EmberReaction
            key={r.id}
            id={r.id}
            emoji={r.emoji}
            left={r.left}
          />
        ))}
      </AnimatePresence>

      <div
        className="absolute"
        style={{
          left: Math.round(fire.x - 59),
          top: Math.round(fire.y - 59 - 20),
          zIndex: 40,
        }}
      >
        <CampfireMark flicker={props.flicker} />
      </div>

      {visiblePeople.map((p, idx) => {
        const pos = slotPositions[idx];
        const strong =
          p.role === "Host" || p.role === "Co-host";
        const size = strong ? 46 : 44;

        return (
          <div
            key={p.id}
            className="absolute flex flex-col items-center gap-1 -translate-x-1"
            style={{
              left: Math.round(pos.x - size / 2),
              top: Math.round(pos.y - size / 2),
              zIndex: 28,
            }}
            title={`${p.name} • ${p.role}`}
          >
            <Avatar
              img={p.img}
              name={p.name}
              size={size}
              speaking={p.speaking}
              strong={strong}
              fireDistance={pos.fireDistance}
              depth={0.75}
              onClick={props.onAvatarClick ? () => props.onAvatarClick!(p.id) : undefined}
            />
            <ScrollingName 
              name={p.name}
              className="text-[10px] text-center" 
              style={{ color: 'rgba(255,255,255,.75)', width: size + 20 }}
            />
          </div>
        );
      })}

      {extraCount > 0 ? (
        <div
          className="absolute"
          style={{
            left: Math.round(
              slotPositions[slotCount - 1].x - 22,
            ),
            top: Math.round(
              slotPositions[slotCount - 1].y - 22,
            ),
            zIndex: 30,
          }}
        >
          <button
            onClick={props.onMore}
            className="grid place-items-center rounded-full backdrop-blur-md transition-opacity hover:opacity-80"
            style={{
              width: 44,
              height: 44,
              background: "rgba(0,0,0,.28)",
              border: `1px solid rgba(255,255,255,.05)`,
              boxShadow: "0 10px 18px rgba(0,0,0,.35)",
            }}
            aria-label="View more people in circle"
          >
            <div
              className="text-sm font-semibold"
              style={{ color: "rgba(255,255,255,.88)" }}
            >
              +{extraCount}
            </div>
          </button>
        </div>
      ) : null}

      {storyteller ? (
        <div
          className="absolute flex flex-col items-center gap-1 -translate-x-3"
          style={{
            left: Math.round(storytellerPos.x - 32),
            top: Math.round(storytellerPos.y - 32),
            zIndex: 60,
          }}
        >
          <StorytellerRipple
            speaking={!!storyteller.speaking}
          />
          <Avatar
            img={storyteller.img}
            name={storyteller.name}
            size={64}
            speaking={!!storyteller.speaking}
            strong={
              storyteller.role === "Host" ||
              storyteller.role === "Co-host"
            }
            storyteller={true}
            fireDistance={storytellerFireDist}
            depth={0}
            onClick={props.onAvatarClick ? () => props.onAvatarClick!(storyteller.id) : undefined}
          />
          <ScrollingName 
            name={storyteller.name}
            className="text-xs text-center font-semibold" 
            style={{ color: 'rgba(255,255,255,.85)', width: 84 }}
          />
        </div>
      ) : null}
    </div>
  );
}
