import React from "react";
import { ChevronRight } from "lucide-react";

import { panelStyle } from "../main-menu/styles";

export function ProgressSuggestedWorkout({
  title,
  subtitle,
  icon,
  accent,
  reason,
  onStart,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  accent: string;
  reason: string;
  onStart?: () => void;
}) {
  return (
    <section
      className="interactive-card dashboard-card-enter"
      style={{
        ...panelStyle,
        marginBottom: 24,
        background: "linear-gradient(180deg, rgba(22,22,22,0.95) 0%, rgba(13,13,13,0.95) 100%)",
      }}
    >
      <div
        style={{
          fontSize: 18,
          fontWeight: 900,
          textTransform: "uppercase",
          letterSpacing: "-0.03em",
          marginBottom: 18,
        }}
      >
        Suggested Next Workout
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 16,
            display: "grid",
            placeItems: "center",
            background: `${accent}1a`,
            color: accent,
            border: `1px solid ${accent}2e`,
            flexShrink: 0,
          }}
        >
          {icon}
        </div>

        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>{title}</div>
          <div style={{ color: "#8d98a7", fontSize: 14, lineHeight: 1.45 }}>{subtitle}</div>
          <div style={{ color: accent, fontSize: 13, fontWeight: 700, marginTop: 8 }}>{reason}</div>
        </div>

        <button
          type="button"
          onClick={onStart}
          style={{
            border: "none",
            borderRadius: 999,
            background: "#ff7a1a",
            color: "#111111",
            minHeight: 44,
            padding: "0 22px",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontSize: 15,
            fontWeight: 900,
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          <span>Start</span>
          <ChevronRight size={18} />
        </button>
      </div>
    </section>
  );
}
