import React from "react";

import { panelStyle } from "../main-menu/styles";

export type MuscleBalanceEntry = {
  muscleGroup: string;
  percent: number;
  accent: string;
};

export function ProgressMuscleBalance({ entries }: { entries: MuscleBalanceEntry[] }) {
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
        Muscle Group Balance
      </div>

      <div style={{ display: "grid", gap: 16 }}>
        {entries.map((entry) => (
          <div key={entry.muscleGroup}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 8,
                fontSize: 14,
              }}
            >
              <span style={{ color: "#d3dae5", fontWeight: 700 }}>{entry.muscleGroup}</span>
              <span style={{ color: entry.accent, fontWeight: 800 }}>{entry.percent}%</span>
            </div>
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
                  width: `${entry.percent}%`,
                  height: "100%",
                  borderRadius: 999,
                  background: entry.accent,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
