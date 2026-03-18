import React from "react";
import { TOKENS } from "../utils";

export function IconButton(props: {
  label: string;
  onClick?: () => void;
  children: React.ReactNode;
  active?: boolean;
  wide?: boolean;
}) {
  return (
    <button
      onClick={props.onClick}
      className={
        "grid place-items-center rounded-2xl backdrop-blur-md transition-opacity hover:opacity-80 " +
        (props.wide ? "h-11 w-[92px]" : "h-11 w-11")
      }
      style={{
        border: `1px solid ${
          props.active ? "rgba(246,206,132,.16)" : TOKENS.line
        }`,
        background: props.active
          ? "rgba(246,206,132,.06)"
          : "rgba(0,0,0,.22)",
        boxShadow: props.active
          ? "0 0 24px rgba(246,206,132,.10)"
          : "none",
      }}
      title={props.label}
      aria-label={props.label}
    >
      {props.children}
    </button>
  );
}
