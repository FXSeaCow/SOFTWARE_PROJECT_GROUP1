import React, { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Dumbbell,
  GripVertical,
  RotateCcw,
  Save,
  Search,
  Target,
  Trash2,
  X,
} from "lucide-react";

import { panelStyle, searchBarStyle, startButtonStyle } from "../components/main-menu/styles";
import { AppShell } from "../layouts/AppShell";
import { getCurrentUser } from "../services/authService";
import {
  createEmptySchedule,
  createScheduleEntry,
  getScheduleCellKey,
  loadWeeklySchedule,
  saveCustomWeeklySchedule,
  saveWeeklySchedule,
  scheduleDays,
  schedulePeriods,
  ScheduleEntry,
  SchedulePeriod,
  WeeklySchedule,
} from "../services/scheduleService";
import { Exercise, getExercises } from "../services/workoutService";

const DRAG_TYPE = "application/gym-exercise-id";

function formatLabel(value?: string | null) {
  if (!value) {
    return "Not specified";
  }

  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function difficultyTone(difficulty: string): React.CSSProperties {
  if (difficulty === "beginner") {
    return {
      background: "rgba(22,101,52,0.24)",
      border: "1px solid rgba(74,222,128,0.28)",
      color: "#bbf7d0",
    };
  }

  if (difficulty === "intermediate") {
    return {
      background: "rgba(146,64,14,0.24)",
      border: "1px solid rgba(251,191,36,0.28)",
      color: "#fde68a",
    };
  }

  return {
    background: "rgba(127,29,29,0.24)",
    border: "1px solid rgba(248,113,113,0.28)",
    color: "#fecaca",
  };
}

function getExerciseById(exercises: Exercise[], exerciseId: string) {
  return exercises.find((exercise) => exercise.id === exerciseId) ?? null;
}

function getCurrentWeekDates() {
  const today = new Date();
  const mondayOffset = (today.getDay() + 6) % 7;
  const monday = new Date(today);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(today.getDate() - mondayOffset);

  return scheduleDays.map((_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return date;
  });
}

const calendarDayLabels = ["THỨ 2", "THỨ 3", "THỨ 4", "THỨ 5", "THỨ 6", "THỨ 7", "CHỦ NHẬT"];

export function SchedulePage() {
  const currentUser = getCurrentUser();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [schedule, setSchedule] = useState<WeeklySchedule>(() =>
    loadWeeklySchedule(currentUser?.id),
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState("all");
  const [selectedFitnessLevel, setSelectedFitnessLevel] =
    useState<"beginner" | "intermediate" | "advanced">("beginner");
  const [activeDropKey, setActiveDropKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadCatalog() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const nextExercises = await getExercises();
        setExercises(nextExercises);
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Unable to load exercise catalog.",
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadCatalog();
  }, []);

  useEffect(() => {
    saveWeeklySchedule(currentUser?.id, schedule);
  }, [currentUser?.id, schedule]);

  const muscleGroups = useMemo(() => {
    return Array.from(
      new Set(exercises.map((exercise) => exercise.muscle_group).filter(Boolean)),
    ).sort((left, right) => left.localeCompare(right));
  }, [exercises]);

  const visibleExercises = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return exercises.filter((exercise) => {
      if (
        selectedMuscleGroup !== "all" &&
        exercise.muscle_group.toLowerCase() !== selectedMuscleGroup
      ) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return [
        exercise.name,
        exercise.muscle_group,
        exercise.equipment ?? "",
        exercise.description ?? "",
        ...(exercise.goal_tags ?? []),
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [exercises, searchTerm, selectedMuscleGroup]);

  const scheduledCount = useMemo(() => {
    return Object.values(schedule).reduce((total, cell) => total + cell.entries.length, 0);
  }, [schedule]);
  const weekDates = useMemo(() => getCurrentWeekDates(), []);

  function updateCellTime(day: number, period: SchedulePeriod, time: string) {
    const key = getScheduleCellKey(day, period);
    setSchedule((current) => ({
      ...current,
      [key]: {
        ...current[key],
        time,
      },
    }));
  }

  function addExerciseToCell(day: number, period: SchedulePeriod, exerciseId: string) {
    const exercise = getExerciseById(exercises, exerciseId);
    if (!exercise) {
      return;
    }

    const key = getScheduleCellKey(day, period);
    setSchedule((current) => ({
      ...current,
      [key]: {
        ...current[key],
        entries: [...current[key].entries, createScheduleEntry(exercise)],
      },
    }));
  }

  function removeEntry(day: number, period: SchedulePeriod, entryId: string) {
    const key = getScheduleCellKey(day, period);
    setSchedule((current) => ({
      ...current,
      [key]: {
        ...current[key],
        entries: current[key].entries.filter((entry) => entry.id !== entryId),
      },
    }));
  }

  function updateEntry(
    day: number,
    period: SchedulePeriod,
    entryId: string,
    field: keyof Pick<ScheduleEntry, "sets" | "reps" | "restSeconds">,
    value: number,
  ) {
    const key = getScheduleCellKey(day, period);
    setSchedule((current) => ({
      ...current,
      [key]: {
        ...current[key],
        entries: current[key].entries.map((entry) =>
          entry.id === entryId ? { ...entry, [field]: value } : entry,
        ),
      },
    }));
  }

  function handleDrop(
    event: React.DragEvent<HTMLDivElement>,
    day: number,
    period: SchedulePeriod,
  ) {
    event.preventDefault();
    const exerciseId =
      event.dataTransfer.getData(DRAG_TYPE) || event.dataTransfer.getData("text/plain");
    setActiveDropKey(null);

    if (exerciseId) {
      addExerciseToCell(day, period, exerciseId);
    }
  }

  async function handleSaveSchedule() {
    setIsSaving(true);
    setSaveMessage(null);
    setErrorMessage(null);

    try {
      await saveCustomWeeklySchedule({
        title: `Custom weekly schedule ${new Date().toLocaleDateString()}`,
        goal: "Custom schedule",
        fitnessLevel: selectedFitnessLevel,
        schedule,
      });
      setSaveMessage("Schedule saved as your active workout plan.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save schedule.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AppShell activeItem="schedule">
      <section
        style={{
          display: "flex",
          alignItems: "end",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 18,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 13,
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.48)",
              marginBottom: 8,
            }}
          >
            Weekly planner
          </div>
          <h2
            style={{
              margin: 0,
              fontSize: "clamp(1.9rem, 3.6vw, 2.8rem)",
              lineHeight: 0.95,
              fontWeight: 900,
              textTransform: "uppercase",
            }}
          >
            Schedule
          </h2>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <select
            value={selectedFitnessLevel}
            onChange={(event) =>
              setSelectedFitnessLevel(event.target.value as "beginner" | "intermediate" | "advanced")
            }
            style={{
              minHeight: 38,
              borderRadius: 999,
              background: "#1f1f1f",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#f5f5f5",
              padding: "0 14px",
              fontSize: 14,
              fontWeight: 800,
            }}
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>

          <button
            type="button"
            onClick={handleSaveSchedule}
            disabled={isSaving}
            style={{
              ...startButtonStyle,
              width: "auto",
              opacity: isSaving ? 0.66 : 1,
              cursor: isSaving ? "wait" : "pointer",
            }}
          >
            <Save size={18} />
            {isSaving ? "Saving" : "Save"}
          </button>

          <button
            type="button"
            onClick={() => {
              setSchedule(createEmptySchedule());
              setSaveMessage(null);
            }}
            style={{
              ...startButtonStyle,
              width: "auto",
              background: "#1f1f1f",
              color: "#f5f5f5",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <RotateCcw size={18} />
            Reset
          </button>
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 14,
          marginBottom: 18,
        }}
      >
        <SummaryCard label="Catalog" value={exercises.length} icon={<Dumbbell size={20} />} />
        <SummaryCard label="Scheduled" value={scheduledCount} icon={<CalendarDays size={20} />} />
        <SummaryCard label="Groups" value={muscleGroups.length} icon={<Target size={20} />} />
      </section>

      {errorMessage ? (
        <div
          style={{
            ...panelStyle,
            background: "rgba(127,29,29,0.32)",
            color: "#fecaca",
            marginBottom: 18,
          }}
        >
          {errorMessage}
        </div>
      ) : null}

      {saveMessage ? (
        <div
          style={{
            ...panelStyle,
            background: "rgba(22,101,52,0.26)",
            color: "#bbf7d0",
            marginBottom: 18,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <CheckCircle2 size={18} />
          {saveMessage}
        </div>
      ) : null}

      <section style={{ marginBottom: 22, overflowX: "auto", paddingBottom: 4 }}>
        <div
          style={{
            ...panelStyle,
            minWidth: 1180,
            padding: 0,
            overflow: "hidden",
            borderRadius: 18,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "110px repeat(7, minmax(145px, 1fr))",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.02)",
            }}
          >
            <div
              style={{
                minHeight: 86,
                borderRight: "1px solid rgba(255,255,255,0.08)",
                display: "grid",
                placeItems: "center",
                color: "#9ca8b7",
                fontSize: 12,
                fontWeight: 900,
                textTransform: "uppercase",
              }}
            >
              Time
            </div>
            {scheduleDays.map((day, index) => {
              const isToday = weekDates[index].toDateString() === new Date().toDateString();

              return (
                <div
                  key={day.value}
                  style={{
                    minHeight: 86,
                    borderRight:
                      index === scheduleDays.length - 1
                        ? "none"
                        : "1px solid rgba(255,255,255,0.08)",
                    display: "grid",
                    placeItems: "center",
                    gap: 4,
                  }}
                >
                  <div
                    style={{
                      color: isToday ? "#60a5fa" : "#9ca8b7",
                      fontSize: 12,
                      fontWeight: 900,
                      textTransform: "uppercase",
                    }}
                  >
                    {calendarDayLabels[index]}
                  </div>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: "50%",
                      display: "grid",
                      placeItems: "center",
                      background: isToday ? "#2563eb" : "transparent",
                      color: "#f5f5f5",
                      fontSize: 28,
                      lineHeight: 1,
                    }}
                  >
                    {weekDates[index].getDate()}
                  </div>
                </div>
              );
            })}
          </div>

          {schedulePeriods.map((period, periodIndex) => (
            <div
              key={period.value}
              style={{
                display: "grid",
                gridTemplateColumns: "110px repeat(7, minmax(145px, 1fr))",
                borderBottom:
                  periodIndex === schedulePeriods.length - 1
                    ? "none"
                    : "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div
                style={{
                  minHeight: 310,
                  borderRight: "1px solid rgba(255,255,255,0.08)",
                  padding: 14,
                  display: "flex",
                  alignItems: "start",
                  justifyContent: "center",
                  background: "rgba(255,255,255,0.015)",
                }}
              >
                <div
                  style={{
                    writingMode: "vertical-rl",
                    transform: "rotate(180deg)",
                    color: "#f5f5f5",
                    fontSize: 14,
                    fontWeight: 900,
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                  }}
                >
                  {period.label}
                </div>
              </div>

              {scheduleDays.map((day, index) => {
                const key = getScheduleCellKey(day.value, period.value);
                const cell = schedule[key];

                return (
                  <div
                    key={key}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setActiveDropKey(key);
                    }}
                    onDragLeave={() => setActiveDropKey(null)}
                    onDrop={(event) => handleDrop(event, day.value, period.value)}
                    style={{
                      minHeight: 310,
                      borderRight:
                        index === scheduleDays.length - 1
                          ? "none"
                          : "1px solid rgba(255,255,255,0.08)",
                      background:
                        activeDropKey === key
                          ? "rgba(255,122,26,0.12)"
                          : "rgba(255,255,255,0.01)",
                      padding: 10,
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    <label
                      style={{
                        minHeight: 34,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        alignSelf: "start",
                        color: "#9ca8b7",
                        borderRadius: 999,
                        border: "1px solid rgba(255,255,255,0.08)",
                        background: "#1f1f1f",
                        padding: "0 10px",
                      }}
                    >
                      <Clock3 size={14} style={{ flex: "0 0 auto" }} />
                      <input
                        type="time"
                        value={cell.time}
                        onChange={(event) =>
                          updateCellTime(day.value, period.value, event.target.value)
                        }
                        style={{
                          width: 116,
                          border: "none",
                          outline: "none",
                          background: "transparent",
                          color: "#f5f5f5",
                          fontSize: 12,
                          fontWeight: 900,
                          colorScheme: "dark",
                        }}
                      />
                    </label>

                    {cell.entries.length > 0 ? (
                      <div
                        style={{
                          flex: 1,
                          minHeight: 0,
                          maxHeight: 236,
                          overflowY: "auto",
                          paddingRight: 4,
                          display: "flex",
                          flexDirection: "column",
                          gap: 8,
                          scrollbarWidth: "thin",
                          scrollbarColor: "rgba(255,122,26,0.55) rgba(255,255,255,0.06)",
                        }}
                      >
                        {cell.entries.map((entry) => {
                          const exercise = getExerciseById(exercises, entry.exerciseId);
                          if (!exercise) {
                            return null;
                          }

                          return (
                            <ScheduledExercise
                              key={entry.id}
                              entry={entry}
                              exercise={exercise}
                              onRemove={() => removeEntry(day.value, period.value, entry.id)}
                              onChange={(field, value) =>
                                updateEntry(day.value, period.value, entry.id, field, value)
                              }
                            />
                          );
                        })}
                      </div>
                    ) : (
                      <div
                        style={{
                          flex: 1,
                          minHeight: 220,
                          maxHeight: 236,
                          borderRadius: 12,
                          border:
                            activeDropKey === key
                              ? "1px dashed rgba(255,122,26,0.75)"
                              : "1px dashed rgba(255,255,255,0.14)",
                          display: "grid",
                          placeItems: "center",
                          color: "#6f7784",
                          fontSize: 13,
                          textAlign: "center",
                          padding: 12,
                        }}
                      >
                        Drop exercise here
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </section>

      <section style={{ ...panelStyle, marginBottom: 18 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.8fr) minmax(180px, 0.8fr)",
            gap: 14,
          }}
        >
          <label style={{ display: "block" }}>
            <div style={{ color: "#9ca8b7", fontSize: 13, textTransform: "uppercase", marginBottom: 8 }}>
              Search
            </div>
            <div style={searchBarStyle}>
              <Search size={18} color="#9ca8b7" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by name, equipment, tag..."
                style={{
                  flex: 1,
                  minWidth: 0,
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  color: "#f5f5f5",
                  fontSize: 15,
                }}
              />
              {searchTerm ? (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "#9ca8b7",
                    cursor: "pointer",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <X size={17} />
                </button>
              ) : null}
            </div>
          </label>

          <label style={{ display: "block" }}>
            <div style={{ color: "#9ca8b7", fontSize: 13, textTransform: "uppercase", marginBottom: 8 }}>
              Muscle group
            </div>
            <select
              value={selectedMuscleGroup}
              onChange={(event) => setSelectedMuscleGroup(event.target.value)}
              style={{
                width: "100%",
                minHeight: 56,
                borderRadius: 18,
                background: "#1f1f1f",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#f5f5f5",
                padding: "0 16px",
                fontSize: 15,
              }}
            >
              <option value="all">All groups</option>
              {muscleGroups.map((group) => (
                <option key={group} value={group.toLowerCase()}>
                  {formatLabel(group)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {isLoading ? (
        <div style={panelStyle}>Loading exercise catalog...</div>
      ) : (
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 14,
          }}
        >
          {visibleExercises.map((exercise) => (
            <ExerciseLibraryCard key={exercise.id} exercise={exercise} />
          ))}
        </section>
      )}
    </AppShell>
  );
}

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div style={{ ...panelStyle, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div>
        <div style={{ color: "#9ca8b7", fontSize: 13, textTransform: "uppercase", marginBottom: 8 }}>
          {label}
        </div>
        <div style={{ fontSize: 30, fontWeight: 900 }}>{value}</div>
      </div>
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: "50%",
          background: "rgba(255,122,26,0.13)",
          color: "#ff9a3d",
          display: "grid",
          placeItems: "center",
        }}
      >
        {icon}
      </div>
    </div>
  );
}

function ExerciseLibraryCard({ exercise }: { exercise: Exercise }) {
  const tone = difficultyTone(exercise.difficulty.toLowerCase());

  return (
    <article
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "copy";
        event.dataTransfer.setData(DRAG_TYPE, exercise.id);
        event.dataTransfer.setData("text/plain", exercise.id);
      }}
      style={{
        ...panelStyle,
        padding: 16,
        cursor: "grab",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              color: "#9ca8b7",
              fontSize: 12,
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            <GripVertical size={14} />
            <span>{formatLabel(exercise.muscle_group)}</span>
          </div>
          <div style={{ fontSize: 18, fontWeight: 900, lineHeight: 1.15 }}>{exercise.name}</div>
        </div>

        <div
          style={{
            ...tone,
            borderRadius: 999,
            padding: "7px 10px",
            fontSize: 11,
            fontWeight: 800,
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}
        >
          {formatLabel(exercise.difficulty)}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 8,
        }}
      >
        <MiniMetric label="Equipment" value={formatLabel(exercise.equipment)} />
        <MiniMetric label="Tags" value={`${exercise.goal_tags?.length ?? 0}`} />
      </div>

      <p
        style={{
          margin: 0,
          color: "#cfd5df",
          fontSize: 13,
          lineHeight: 1.55,
        }}
      >
        {exercise.description?.trim() || "No description available."}
      </p>
    </article>
  );
}

function ScheduledExercise({
  entry,
  exercise,
  onRemove,
  onChange,
}: {
  entry: ScheduleEntry;
  exercise: Exercise;
  onRemove: () => void;
  onChange: (
    field: keyof Pick<ScheduleEntry, "sets" | "reps" | "restSeconds">,
    value: number,
  ) => void;
}) {
  return (
    <div
      style={{
        borderRadius: 12,
        background: "rgba(12,12,12,0.82)",
        border: "1px solid rgba(255,255,255,0.08)",
        padding: 10,
        display: "flex",
        flexDirection: "column",
        gap: 9,
      }}
    >
      <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: "#9ca8b7", fontSize: 11, textTransform: "uppercase", marginBottom: 5 }}>
            {formatLabel(exercise.muscle_group)}
          </div>
          <div style={{ fontSize: 14, fontWeight: 900, lineHeight: 1.2 }}>{exercise.name}</div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.04)",
            color: "#fca5a5",
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
            flex: "0 0 auto",
          }}
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 6,
        }}
      >
        <NumberField label="Sets" value={entry.sets} onChange={(value) => onChange("sets", value)} />
        <NumberField label="Reps" value={entry.reps} onChange={(value) => onChange("reps", value)} />
        <NumberField
          label="Rest"
          value={entry.restSeconds}
          onChange={(value) => onChange("restSeconds", value)}
        />
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const [draftValue, setDraftValue] = useState(String(value));

  useEffect(() => {
    setDraftValue(String(value));
  }, [value]);

  return (
    <label style={{ display: "block" }}>
      <div style={{ color: "#818b99", fontSize: 10, textTransform: "uppercase", marginBottom: 4 }}>
        {label}
      </div>
      <input
        type="text"
        inputMode="numeric"
        value={draftValue}
        onFocus={() => {
          if (draftValue === "0") {
            setDraftValue("");
          }
        }}
        onBlur={() => {
          if (!draftValue) {
            setDraftValue("0");
            onChange(0);
          }
        }}
        onChange={(event) => {
          const nextValue = event.target.value.replace(/\D/g, "");
          setDraftValue(nextValue);

          if (nextValue) {
            onChange(Math.max(0, Number(nextValue)));
          }
        }}
        style={{
          width: "100%",
          boxSizing: "border-box",
          borderRadius: 8,
          border: "1px solid rgba(255,255,255,0.08)",
          background: "#1d1d1d",
          color: "#f5f5f5",
          minHeight: 34,
          padding: "0 10px",
          fontSize: 13,
          fontWeight: 800,
          textAlign: "center",
        }}
      />
    </label>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        borderRadius: 12,
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        padding: 10,
        minWidth: 0,
      }}
    >
      <div style={{ color: "#9ca8b7", fontSize: 11, textTransform: "uppercase", marginBottom: 5 }}>
        {label}
      </div>
      <div
        style={{
          color: "#f5f5f5",
          fontSize: 13,
          fontWeight: 800,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </div>
    </div>
  );
}
