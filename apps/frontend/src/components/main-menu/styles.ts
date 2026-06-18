import React from "react";

export const panelStyle: React.CSSProperties = {
  background:
    "linear-gradient(180deg, rgba(20,20,20,0.96) 0%, rgba(16,16,16,0.96) 100%)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 18,
  padding: 20,
  boxShadow: "0 18px 40px rgba(0,0,0,0.22)",
};

export const searchBarStyle: React.CSSProperties = {
  minHeight: 56,
  borderRadius: 18,
  background: "#1f1f1f",
  border: "1px solid rgba(255,255,255,0.08)",
  display: "flex",
  alignItems: "center",
  gap: 14,
  padding: "0 18px",
};

export const iconButtonStyle: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: "50%",
  border: "1px solid rgba(255,255,255,0.08)",
  background: "#1a1a1a",
  color: "#f5f5f5",
  display: "grid",
  placeItems: "center",
  position: "relative",
  cursor: "pointer",
};

export const heroMetaStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  color: "#b8bcc5",
  fontSize: 14,
  fontWeight: 600,
};

export const startButtonStyle: React.CSSProperties = {
  border: "none",
  borderRadius: 999,
  background: "#ff7a1a",
  color: "#111111",
  minHeight: 38,
  padding: "0 22px",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  fontSize: 15,
  fontWeight: 900,
  textTransform: "uppercase",
  cursor: "pointer",
};

export function bottomNavItemStyle(active: boolean): React.CSSProperties {
  return {
    minHeight: 58,
    display: "grid",
    justifyItems: "center",
    alignContent: "center",
    gap: 6,
    fontSize: 12,
    fontWeight: active ? 800 : 600,
    textTransform: "uppercase",
    letterSpacing: "0.03em",
  };
}
