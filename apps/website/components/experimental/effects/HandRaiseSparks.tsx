import React from "react";
import { RisingSparkParticle } from "./RisingSparkParticle";

export function HandRaiseSparks(props: { id: string }) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {[0, 1, 2].map((i) => (
        <RisingSparkParticle
          key={`${props.id}-${i}`}
          id={`${props.id}-${i}`}
          delay={i * 0.15}
        />
      ))}
    </div>
  );
}
