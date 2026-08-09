import React, { useState } from "react";
import { ArrowDown, ArrowUp, Dumbbell, MoreVertical, Trash2 } from "lucide-react";

import { Exercise } from "../../services/workoutService";
import { ScheduleEntry } from "../../services/scheduleService";

function estimateDurationMinutes(entry: ScheduleEntry) {
  const workSeconds = entry.sets * entry.reps * 3;
  const restSeconds = Math.max(0, entry.sets - 1) * entry.restSeconds;
  return Math.max(1, Math.round((workSeconds + restSeconds) / 60));
}

function formatTimeLabel(time: string) {
  const [hoursRaw, minutesRaw] = time.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw) || 0;

  if (Number.isNaN(hours)) {
    return time;
  }

  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  return `${String(displayHours).padStart(2, "0")}:${String(minutes).padStart(2, "0")} ${period}`;
}

export function WorkoutSessionCard({
  entry,
  exercise,
  time,
  orderIndex,
  totalEntries,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  entry: ScheduleEntry;
  exercise: Exercise;
  time: string;
  orderIndex: number;
  totalEntries: number;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div style={{ display: "flex", alignItems: "stretch", gap: 12 }}>
      <div
        style={{
          flex: "0 0 auto",
          width: 64,
          display: "flex",
          alignItems: "flex-start",
          paddingTop: 14,
          color: "#9ca3af",
          fontSize: 12,
          fontWeight: 800,
        }}
      >
        {formatTimeLabel(time)}
      </div>

      <div
        style={{
          flex: 1,
          minWidth: 0,
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: 12,
          borderRadius: 16,
          background: "#141414",
          border: "1px solid #2a2a2a",
          padding: 14,
        }}
      >
        <div
          style={{
            flexShrink: 0,
            width: 42,
            height: 42,
            borderRadius: 12,
            background: "rgba(255,122,26,0.12)",
            border: "1px solid rgba(255,122,26,0.24)",
            display: "grid",
            placeItems: "center",
            color: "#ff7a1a",
          }}
        >
          <Dumbbell size={20} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              color: "#ffffff",
              fontSize: 14,
              fontWeight: 800,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {exercise.name}
          </div>
          <div style={{ color: "#9ca3af", fontSize: 12, marginTop: 2 }}>
            ~{estimateDurationMinutes(entry)} min · {entry.sets} sets × {entry.reps} reps
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsMenuOpen((current) => !current)}
          aria-label="Session options"
          style={{
            flexShrink: 0,
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: "none",
            background: "transparent",
            color: "#9ca3af",
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
          }}
        >
          <MoreVertical size={18} />
        </button>

        {isMenuOpen ? (
          <div
            style={{
              position: "absolute",
              top: "100%",
              right: 8,
              marginTop: 6,
              display: "flex",
              flexDirection: "column",
              gap: 4,
              padding: 6,
              borderRadius: 12,
              background: "#1a1a1a",
              border: "1px solid #2a2a2a",
              boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
              zIndex: 20,
              minWidth: 150,
            }}
          >
            <button
              type="button"
              disabled={orderIndex === 0}
              onClick={() => {
                onMoveUp();
                setIsMenuOpen(false);
              }}
              style={menuItemStyle(orderIndex === 0)}
            >
              <ArrowUp size={14} /> Move up
            </button>
            <button
              type="button"
              disabled={orderIndex === totalEntries - 1}
              onClick={() => {
                onMoveDown();
                setIsMenuOpen(false);
              }}
              style={menuItemStyle(orderIndex === totalEntries - 1)}
            >
              <ArrowDown size={14} /> Move down
            </button>
            <button
              type="button"
              onClick={() => {
                onRemove();
                setIsMenuOpen(false);
              }}
              style={{ ...menuItemStyle(false), color: "#fca5a5" }}
            >
              <Trash2 size={14} /> Remove
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function menuItemStyle(disabled: boolean): React.CSSProperties {
  return {
    minHeight: 40,
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "0 10px",
    borderRadius: 8,
    border: "none",
    background: "transparent",
    color: disabled ? "#4b5563" : "#f5f5f5",
    fontSize: 13,
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    textAlign: "left",
  };
}
