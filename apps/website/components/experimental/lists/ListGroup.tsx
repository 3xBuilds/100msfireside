import React from "react";

export function ListGroup(props: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4">
      <div
        className="mb-2 text-xs font-semibold"
        style={{ color: "rgba(255,255,255,.78)" }}
      >
        {props.title}
      </div>
      <div className="space-y-2">{props.children}</div>
    </div>
  );
}
