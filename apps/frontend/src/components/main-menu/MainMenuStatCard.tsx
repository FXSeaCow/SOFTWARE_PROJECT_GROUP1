import React from "react";

import { panelStyle } from "./styles";
import { useIsMobile } from "../../hooks/useIsMobile";

export function MainMenuStatCard({
  label,
  value,
  icon,
  note,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  note: string;
}) {
  const isMobile = useIsMobile(768);

  return (
    <div
      className="interactive-card dashboard-card-enter"
      style={{ ...panelStyle, minHeight: isMobile ? 176 : 132, padding: 20, display: "flex", alignItems: "center" }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            display: "grid",
            placeItems: "center",
            color: "#ff7a1a",
            background: "rgba(255,122,26,0.08)",
            border: "1px solid rgba(255,122,26,0.16)",
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
        <div>
          <div style={{ color: "#d3dae5", fontSize: 15, marginBottom: 10 }}>{label}</div>
          <div
            style={{
              color: "#f5f5f5",
              fontSize: 24,
              fontWeight: 900,
              lineHeight: 1,
              marginBottom: 10,
              letterSpacing: "-0.04em",
            }}
          >
            {value}
          </div>
          <div style={{ color: "#8f98a7", fontSize: 13 }}>{note}</div>
        </div>
      </div>
    </div>
  );
}
