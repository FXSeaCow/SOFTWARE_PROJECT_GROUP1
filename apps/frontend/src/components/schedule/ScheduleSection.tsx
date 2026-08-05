import React from "react";

import { Exercise } from "../../services/workoutService";
import { ScheduleEntry } from "../../services/scheduleService";
import { AddSessionButton } from "./AddSessionButton";
import { WorkoutSessionCard } from "./WorkoutSessionCard";

export function ScheduleSection({
  label,
  time,
  entries,
  getExercise,
  onAddSession,
  onRemoveEntry,
  onMoveEntry,
}: {
  label: string;
  time: string;
  entries: ScheduleEntry[];
  getExercise: (exerciseId: string) => Exercise | null;
  onAddSession: () => void;
  onRemoveEntry: (entryId: string) => void;
  onMoveEntry: (entryId: string, direction: -1 | 1) => void;
}) {
  return (
    <section style={{ marginBottom: 24 }}>
      <div
        style={{
          color: "#ff7a1a",
          fontSize: 12,
          fontWeight: 900,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          marginBottom: 12,
        }}
      >
        {label}
      </div>

      {entries.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
          {entries.map((entry, index) => {
            const exercise = getExercise(entry.exerciseId);
            if (!exercise) {
              return null;
            }

            return (
              <WorkoutSessionCard
                key={entry.id}
                entry={entry}
                exercise={exercise}
                time={time}
                orderIndex={index}
                totalEntries={entries.length}
                onRemove={() => onRemoveEntry(entry.id)}
                onMoveUp={() => onMoveEntry(entry.id, -1)}
                onMoveDown={() => onMoveEntry(entry.id, 1)}
              />
            );
          })}
        </div>
      ) : (
        <div
          style={{
            marginBottom: 12,
            color: "#9ca3af",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          No sessions scheduled
        </div>
      )}

      <AddSessionButton onClick={onAddSession} />
    </section>
  );
}
