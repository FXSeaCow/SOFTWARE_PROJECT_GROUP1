import React from "react";
import { Flame, Play, Timer } from "lucide-react";
import { Link } from "react-router-dom";

import { heroMetaStyle, panelStyle, startButtonStyle } from "./styles";

export function MainMenuHeroCard({ startHref }: { startHref: string }) {
  return (
    <section
      style={{
        ...panelStyle,
        minHeight: 250,
        padding: 24,
        marginBottom: 18,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background:
          "linear-gradient(90deg, rgba(18,12,8,0.92) 0%, rgba(76,38,15,0.82) 46%, rgba(15,15,15,0.78) 100%), radial-gradient(circle at center, rgba(255,122,26,0.16), transparent 38%)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.03) 50%, transparent 100%)",
          opacity: 0.45,
          pointerEvents: "none",
        }}
      />

      <div style={{ position: "relative", zIndex: 1 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "6px 12px",
            borderRadius: 8,
            background: "#ff7a1a",
            color: "#111111",
            fontSize: 13,
            fontWeight: 900,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            marginBottom: 36,
          }}
        >
          Today's Challenge
        </div>

        <h2
          style={{
            margin: 0,
            fontSize: "clamp(2.1rem, 5vw, 4rem)",
            lineHeight: 0.96,
            letterSpacing: "-0.06em",
            textTransform: "uppercase",
            fontWeight: 900,
            maxWidth: 520,
          }}
        >
          <span style={{ color: "#f5f5f5" }}>Iron Warrior</span>
          <br />
          <span style={{ color: "#ff7a1a" }}>Challenge</span>
        </h2>
      </div>

      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          alignItems: "center",
          gap: 20,
          flexWrap: "wrap",
        }}
      >
        <div style={heroMetaStyle}>
          <Timer size={16} />
          <span>75 min</span>
        </div>
        <div style={heroMetaStyle}>
          <Flame size={16} />
          <span>680 kcal</span>
        </div>

        <Link to={startHref} style={{ textDecoration: "none" }}>
          <button type="button" style={startButtonStyle}>
            <Play size={18} fill="currentColor" />
            <span>Start</span>
          </button>
        </Link>
      </div>
    </section>
  );
}
