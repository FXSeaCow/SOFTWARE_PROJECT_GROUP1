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
          gap: 10,
          marginBottom: 8,
        }}
      >
        {completedDays.map((done, index) => (
          <div
            key={labels[index]}
            style={{
              height: 46,
              borderRadius: 10,
              display: "grid",
              placeItems: "center",
              fontSize: 13,
              fontWeight: 800,
              color: done ? "#f8f1e8" : "rgba(255,255,255,0.64)",
              background: done
                ? index === 4
                  ? "#dd7418"
                  : "linear-gradient(180deg, #cb6516 0%, #dd7418 100%)"
                : "rgba(255,255,255,0.08)",
              border: done
                ? "1px solid rgba(255,146,66,0.22)"
                : "1px solid rgba(255,255,255,0.04)",
            }}
          >
            {labels[index]}
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
