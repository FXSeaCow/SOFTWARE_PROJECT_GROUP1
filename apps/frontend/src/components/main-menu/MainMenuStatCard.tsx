import React from "react";

import { panelStyle } from "./styles";

export function MainMenuStatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div style={panelStyle}>
      <div style={{ color: "#ff7a1a", marginBottom: 8 }}>{icon}</div>
      <div
        style={{
          color: "#ff7a1a",
          fontSize: 24,
          fontWeight: 900,
          lineHeight: 1,
          marginBottom: 8,
        }}
      >
        {value}
      </div>
      <div
        style={{
          color: "#93a0b2",
          fontSize: 13,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
    </div>
  );
}
