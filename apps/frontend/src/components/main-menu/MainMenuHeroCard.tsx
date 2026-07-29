import React from "react";
import { Flame, Play, Timer } from "lucide-react";
import { Link } from "react-router-dom";

import { heroMetaStyle, panelStyle, startButtonStyle } from "./styles";

export function MainMenuHeroCard({
  startHref,
  membershipHref = "/membership",
}: {
  startHref: string;
  membershipHref?: string;
}) {
  return (
    <section
      className="interactive-card dashboard-card-enter"
      style={{
        ...panelStyle,
        minHeight: 260,
        padding: 24,
        marginBottom: 18,
        display: "flex",
        alignItems: "center",
        background:
          "linear-gradient(90deg, rgba(18,12,8,0.96) 0%, rgba(51,28,11,0.92) 46%, rgba(12,12,12,0.92) 100%)",
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
      <div
        style={{
          position: "absolute",
          right: -120,
          top: -80,
          width: 420,
          height: 420,
          borderRadius: "50%",
          border: "2px solid rgba(255,122,26,0.18)",
          boxShadow: "0 0 60px rgba(255,122,26,0.12)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: 48,
          top: 28,
          width: 180,
          height: 180,
          borderRadius: "50%",
          border: "1px solid rgba(255,122,26,0.14)",
          pointerEvents: "none",
        }}
      />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 560 }}>
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
            marginBottom: 20,
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
            marginBottom: 18,
          }}
        >
          <span style={{ color: "#f5f5f5" }}>Iron Warrior</span>
          <br />
          <span style={{ color: "#ff7a1a" }}>Challenge</span>
        </h2>
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
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 18 }}>
          <Link
            to={startHref}
            style={{ textDecoration: "none", display: "inline-block" }}
          >
            <button type="button" style={{ ...startButtonStyle, minHeight: 46, padding: "0 24px" }}>
              <Play size={18} fill="currentColor" />
              <span>Start workout</span>
            </button>
          </Link>

          <Link
            to={membershipHref}
            style={{ textDecoration: "none", display: "inline-block" }}
          >
            <button
              type="button"
              style={{
                minHeight: 46,
                padding: "0 24px",
                borderRadius: 999,
                border: "1px solid rgba(255,122,26,0.32)",
                background: "rgba(255,255,255,0.04)",
                color: "#f8fafc",
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                fontSize: 14,
                fontWeight: 900,
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              <span>View membership plans</span>
            </button>
          </Link>
        </div>
      </div>
    </section>
  );
}
