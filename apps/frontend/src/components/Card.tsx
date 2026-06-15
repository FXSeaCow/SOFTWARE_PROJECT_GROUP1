import React from "react";

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        width: "100%",
        maxWidth: 440,
        background: "rgba(255, 255, 255, 0.92)",
        border: "1px solid rgba(148, 163, 184, 0.2)",
        borderRadius: 24,
        padding: 32,
        boxShadow: "0 24px 80px rgba(15, 23, 42, 0.16)",
        backdropFilter: "blur(12px)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
