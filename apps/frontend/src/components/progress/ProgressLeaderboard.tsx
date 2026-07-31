import React from "react";
import { Flame, Trophy } from "lucide-react";

import { panelStyle } from "../main-menu/styles";
import { LeaderboardEntry } from "../../services/progressService";

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function rankAccent(rank: number): { background: string; color: string } {
  if (rank === 1) return { background: "rgba(250,204,21,0.16)", color: "#fde68a" };
  if (rank === 2) return { background: "rgba(203,213,225,0.18)", color: "#e2e8f0" };
  if (rank === 3) return { background: "rgba(217,119,6,0.18)", color: "#fdba74" };
  return { background: "rgba(255,255,255,0.06)", color: "#9ca8b7" };
}

export function ProgressLeaderboard({
  entries,
  currentUserId,
}: {
  entries: LeaderboardEntry[];
  currentUserId?: string;
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
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 18,
            fontWeight: 900,
            textTransform: "uppercase",
            letterSpacing: "-0.03em",
          }}
        >
          <Trophy size={18} color="#fde68a" />
          Streak Leaderboard
        </div>
      </div>

      {entries.length === 0 ? (
        <div style={{ color: "#8d98a7", fontSize: 14 }}>No streak activity yet.</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {entries.map((entry) => {
            const isCurrentUser = entry.user_id === currentUserId;
            const accent = rankAccent(entry.rank);

            return (
              <div
                key={entry.user_id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "12px 16px",
                  borderRadius: 14,
                  background: isCurrentUser ? "rgba(255,122,26,0.08)" : "rgba(255,255,255,0.04)",
                  border: isCurrentUser
                    ? "1px solid rgba(255,122,26,0.24)"
                    : "1px solid rgba(255,255,255,0.06)",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      display: "grid",
                      placeItems: "center",
                      fontWeight: 900,
                      fontSize: 13,
                      flexShrink: 0,
                      ...accent,
                    }}
                  >
                    {entry.rank}
                  </div>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      display: "grid",
                      placeItems: "center",
                      background: "rgba(255,255,255,0.65)",
                      color: "#111111",
                      fontWeight: 900,
                      flexShrink: 0,
                    }}
                  >
                    {initials(entry.full_name)}
                  </div>
                  <div>
                    <div style={{ color: "#f5f5f5", fontSize: 15, fontWeight: 800 }}>
                      {entry.full_name}
                      {isCurrentUser ? " (you)" : ""}
                    </div>
                    <div style={{ color: "#8d98a7", fontSize: 12 }}>
                      Best streak: {entry.longest_streak}d
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#ff9a3d", fontWeight: 900, fontSize: 16 }}>
                  <Flame size={16} />
                  {entry.current_streak}d
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
