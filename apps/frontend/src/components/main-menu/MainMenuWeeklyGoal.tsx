import React from "react";

import { panelStyle } from "./styles";

export function MainMenuWeeklyGoal({
  goalDays,
  completedDays,
  labels,
  progressPercent,
}: {
  goalDays: string;
  completedDays: boolean[];
  labels: string[];
  progressPercent: number;
}) {
  return (
    <section style={{ ...panelStyle, marginBottom: 24 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 18,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            fontSize: 18,
            fontWeight: 900,
            textTransform: "uppercase",
            letterSpacing: "-0.03em",
          }}
        >
          Weekly Goal
        </div>
        <div style={{ color: "#ff7a1a", fontWeight: 800, fontSize: 16 }}>
          {goalDays}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
          gap: 8,
          marginBottom: 8,
        }}
      >
        {completedDays.map((done, index) => (
          <div
            key={labels[index]}
            style={{
              display: "grid",
              gap: 8,
            }}
          >
            <div
              style={{
                height: 46,
                borderRadius: 6,
                background: done
                  ? index === 4
                    ? "#ff8628"
                    : "rgba(183,103,35,0.78)"
                  : "rgba(255,255,255,0.07)",
                border: done
                  ? "1px solid rgba(255,146,66,0.18)"
                  : "1px solid rgba(255,255,255,0.04)",
              }}
            />
            <div
              style={{
                textAlign: "center",
                fontSize: 12,
                color: done ? "#ff7a1a" : "rgba(255,255,255,0.24)",
                fontWeight: 700,
              }}
            >
              {labels[index]}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 18,
          display: "grid",
          gridTemplateColumns: "1fr auto",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div
          style={{
            height: 8,
            borderRadius: 999,
            background: "rgba(255,255,255,0.08)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${progressPercent}%`,
              height: "100%",
              borderRadius: 999,
              background: "linear-gradient(90deg, #ff7a1a 0%, #f04a4a 100%)",
            }}
          />
        </div>
        <div style={{ color: "#ff7a1a", fontWeight: 900, fontSize: 16 }}>
          {progressPercent}%
        </div>
      </div>
    </section>
  );
}
