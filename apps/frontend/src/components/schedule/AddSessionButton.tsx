import React from "react";
import { Plus } from "lucide-react";

export function AddSessionButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        minHeight: 48,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        borderRadius: 14,
        border: "1px dashed rgba(255,122,26,0.5)",
        background: "transparent",
        color: "#ff7a1a",
        fontSize: 13,
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: "0.03em",
        cursor: "pointer",
      }}
    >
      <Plus size={16} />
      Add Session
    </button>
  );
}
