import React from "react";

export function Toast({
  message,
  tone = "success",
}: {
  message: string;
  tone?: "success" | "error";
}) {
  const palette =
    tone === "success"
      ? {
          background: "rgba(6,95,70,0.92)",
          border: "1px solid rgba(52,211,153,0.28)",
          color: "#d1fae5",
        }
      : {
          background: "rgba(127,29,29,0.92)",
          border: "1px solid rgba(248,113,113,0.28)",
          color: "#fee2e2",
        };

  return (
    <div
      style={{
        position: "fixed",
        right: 24,
        bottom: 24,
        zIndex: 80,
        minWidth: 280,
        maxWidth: 420,
        borderRadius: 16,
        padding: "14px 16px",
        boxShadow: "0 18px 50px rgba(0,0,0,0.28)",
        animation: "modalPanelIn 220ms cubic-bezier(0.22, 1, 0.36, 1) both",
        ...palette,
      }}
    >
      {message}
    </div>
  );
}
