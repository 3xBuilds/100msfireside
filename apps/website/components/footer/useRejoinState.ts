"use client";

import { useState, useEffect } from "react";

export function useRejoinState() {
  const [isRejoining, setIsRejoining] = useState(false);

  useEffect(() => {
    const handleRoleChange = (event: CustomEvent) => {
      if (event.detail?.type === "role_change_start") {
        setIsRejoining(true);
      } else if (event.detail?.type === "role_change_complete") {
        setIsRejoining(false);
      }
    };

    window.addEventListener(
      "role_change_event",
      handleRoleChange as EventListener
    );
    return () => {
      window.removeEventListener(
        "role_change_event",
        handleRoleChange as EventListener
      );
    };
  }, []);

  return { isRejoining };
}
