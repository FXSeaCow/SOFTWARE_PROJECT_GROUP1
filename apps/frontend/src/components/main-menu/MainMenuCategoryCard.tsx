import React from "react";

import { panelStyle } from "./styles";

export function MainMenuCategoryCard({
  title,
  subtitle,
  icon,
  accent,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <div
      style={{
        ...panelStyle,
        minHeight: 128,
        display: "grid",
        gap: 14,
        alignContent: "space-between",
        background:
          "linear-gradient(180deg, rgba(22,22,22,0.95) 0%, rgba(13,13,13,0.95) 100%)",
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          display: "grid",
          placeItems: "center",
          background: `${accent}1a`,
          color: accent,
          border: `1px solid ${accent}2e`,
        }}
      >
        {icon}
      </div>

      <div>
        <div
          style={{
            fontSize: 20,
            fontWeight: 800,
            marginBottom: 4,
          }}
        >
          {title}
        </div>
        <div style={{ color: "#8d98a7", fontSize: 14 }}>{subtitle}</div>
      </div>
    </div>
  );
}
