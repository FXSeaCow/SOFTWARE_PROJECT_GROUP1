import React from "react";
import { CalendarDays, Dumbbell, Flame } from "lucide-react";
import { Link } from "react-router-dom";

import { heroMetaStyle, panelStyle, startButtonStyle } from "./styles";
import { useIsMobile } from "../../hooks/useIsMobile";

export function MainMenuWelcomeCard({
  currentStreak,
  daysCompletedThisWeek,
  weeklyProgressPercent,
  scheduleHref = "/schedule",
  exercisesHref = "/exercises",
}: {
  currentStreak: number | null;
  daysCompletedThisWeek: number;
  weeklyProgressPercent: number;
  scheduleHref?: string;
  exercisesHref?: string;
}) {
  const isMobile = useIsMobile(768);

  return (
    <section
      className="interactive-card dashboard-card-enter"
      style={{
        ...panelStyle,
        padding: 24,
        marginBottom: 18,
        background:
          "linear-gradient(90deg, rgba(18,12,8,0.96) 0%, rgba(51,28,11,0.92) 46%, rgba(12,12,12,0.92) 100%)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          right: -120,
          top: -80,
          width: 320,
          height: 320,
          borderRadius: "50%",
          border: "2px solid rgba(255,122,26,0.18)",
          boxShadow: "0 0 60px rgba(255,122,26,0.12)",
          pointerEvents: "none",
        }}
      />

      <div style={{ position: "relative", zIndex: 1 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            flexWrap: "wrap",
            marginBottom: 18,
          }}
        >
          <div style={heroMetaStyle}>
            <Flame size={16} />
            <span>{currentStreak !== null ? `${currentStreak}-day streak` : "No streak yet"}</span>
          </div>
          <div style={heroMetaStyle}>
            <CalendarDays size={16} />
            <span>{daysCompletedThisWeek}/7 days this week</span>
          </div>
        </div>

        <div
          style={{
            height: 8,
            borderRadius: 999,
            background: "rgba(255,255,255,0.08)",
            overflow: "hidden",
            maxWidth: 420,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${weeklyProgressPercent}%`,
              borderRadius: 999,
              background: "#ff7a1a",
              transition: "width 300ms ease",
            }}
          />
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <Link
            to={scheduleHref}
            style={{ textDecoration: "none", display: isMobile ? "block" : "inline-block" }}
          >
            <button
              type="button"
              style={{
                ...startButtonStyle,
                minHeight: 46,
                padding: "0 24px",
                width: isMobile ? "100%" : undefined,
                justifyContent: isMobile ? "center" : "flex-start",
              }}
            >
              <CalendarDays size={18} />
              <span>View schedule</span>
            </button>
          </Link>

          <Link
            to={exercisesHref}
            style={{ textDecoration: "none", display: isMobile ? "block" : "inline-block" }}
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
                justifyContent: isMobile ? "center" : "flex-start",
                gap: 10,
                fontSize: 14,
                fontWeight: 900,
                textTransform: "uppercase",
                cursor: "pointer",
                width: isMobile ? "100%" : undefined,
              }}
            >
              <Dumbbell size={18} />
              <span>Browse exercises</span>
            </button>
          </Link>
        </div>
      </div>
    </section>
  );
}
