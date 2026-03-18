"use client";

import { formatTimeUntil } from "./utils/timeUtils";

interface CountdownProps {
  targetTime: string | Date;
  className?: string;
}

export default function Countdown({ targetTime, className = "" }: CountdownProps) {
  const timeLeft = formatTimeUntil(targetTime);

  return (
    <span className={` ${className}`}>
      {timeLeft}
    </span>
  );
}