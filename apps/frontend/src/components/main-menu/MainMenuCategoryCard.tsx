import React from "react";
import { ChevronRight } from "lucide-react";

import { panelStyle } from "./styles";

export function MainMenuCategoryCard({
  title,
  subtitle,
  icon,
  accent,
  metric,
  onClick,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  accent: string;
  metric?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="interactive-card dashboard-card-enter"
      style={{
        ...panelStyle,
        width: "100%",
        minHeight: 128,
        display: "grid",
        gap: 14,
        alignContent: "space-between",
        background:
          "linear-gradient(180deg, rgba(22,22,22,0.95) 0%, rgba(13,13,13,0.95) 100%)",
        textAlign: "left",
        color: "#f5f5f5",
        cursor: onClick ? "pointer" : "default",
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
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
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
            <div style={{ color: "#8d98a7", fontSize: 14, lineHeight: 1.45 }}>{subtitle}</div>
            {metric ? (
              <div style={{ color: accent, fontSize: 14, fontWeight: 800, marginTop: 10 }}>
                {metric}
              </div>
            ) : null}
          </div>
          <div style={{ alignSelf: "end", color: "#d0d5dd" }}>
            <ChevronRight size={18} />
          </div>
        </div>
      </div>
    </button>
  );
}
