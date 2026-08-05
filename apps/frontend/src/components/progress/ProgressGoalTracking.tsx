import React from "react";

import { panelStyle } from "../main-menu/styles";

export type GoalEntry = {
  label: string;
  currentLabel: string;
  progressPercent: number;
};

export function ProgressGoalTracking({ goals }: { goals: GoalEntry[] }) {
  return (
    <section className="interactive-card dashboard-card-enter" style={{ ...panelStyle, marginBottom: 24 }}>
      <div
        style={{
          fontSize: 18,
          fontWeight: 900,
          textTransform: "uppercase",
          letterSpacing: "-0.03em",
          marginBottom: 18,
        }}
      >
        Goal Tracking
      </div>

      {goals.length === 0 ? (
        <div style={{ color: "#8d98a7", fontSize: 14 }}>
          Goal tracking is coming soon — you'll be able to set and track personal goals here.
        </div>
      ) : (
      <div style={{ display: "grid", gap: 18 }}>
        {goals.map((goal) => (
          <div key={goal.label}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 8,
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <span style={{ color: "#f5f5f5", fontWeight: 800, fontSize: 15 }}>{goal.label}</span>
              <span style={{ color: "#8d98a7", fontSize: 14, fontWeight: 700 }}>{goal.currentLabel}</span>
            </div>
            <div
              style={{
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
                    width: `${goal.progressPercent}%`,
                    height: "100%",
                    borderRadius: 999,
                    background: "linear-gradient(90deg, #ff7a1a 0%, #f04a4a 100%)",
                  }}
                />
              </div>
              <div style={{ color: "#ff7a1a", fontWeight: 900, fontSize: 14 }}>{goal.progressPercent}%</div>
            </div>
          </div>
        ))}
      </div>
      )}
    </section>
  );
}
