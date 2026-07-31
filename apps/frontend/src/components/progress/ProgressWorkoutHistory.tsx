import React from "react";
import { ChevronRight, MapPin } from "lucide-react";

import { panelStyle } from "../main-menu/styles";

export type WorkoutHistoryEntry = {
  date: string;
  time: string;
  branchName: string;
};

export function ProgressWorkoutHistory({
  entries,
  onSeeAll,
}: {
  entries: WorkoutHistoryEntry[];
  onSeeAll?: () => void;
}) {
  return (
    <section className="interactive-card dashboard-card-enter" style={{ ...panelStyle, marginBottom: 24 }}>
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
          Workout History
        </div>
        <button
          type="button"
          onClick={onSeeAll}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            border: "none",
            background: "transparent",
            color: "#9ca8b7",
            fontWeight: 700,
            cursor: onSeeAll ? "pointer" : "default",
          }}
        >
          <span>See all</span>
          <ChevronRight size={16} />
        </button>
      </div>

      {entries.length === 0 ? (
        <div style={{ color: "#8d98a7", fontSize: 14 }}>No check-ins recorded yet.</div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {entries.map((entry, index) => (
            <div
              key={`${entry.date}-${entry.time}-${index}`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "14px 16px",
                borderRadius: 14,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.06)",
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    display: "grid",
                    placeItems: "center",
                    color: "#ff7a1a",
                    background: "rgba(255,122,26,0.08)",
                    border: "1px solid rgba(255,122,26,0.16)",
                    flexShrink: 0,
                  }}
                >
                  <MapPin size={16} />
                </div>
                <div style={{ display: "grid", gap: 4 }}>
                  <div style={{ color: "#f5f5f5", fontSize: 15, fontWeight: 800 }}>{entry.branchName}</div>
                  <div style={{ color: "#8d98a7", fontSize: 13 }}>{entry.date}</div>
                </div>
              </div>

              <div style={{ color: "#d3dae5", fontSize: 13, fontWeight: 700 }}>{entry.time}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
