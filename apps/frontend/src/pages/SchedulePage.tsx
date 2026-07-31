import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  RotateCcw,
  Save,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

import { panelStyle, searchBarStyle, startButtonStyle } from "../components/main-menu/styles";
import { AppShell } from "../layouts/AppShell";
import { getCurrentUser } from "../services/authService";
import {
  applyGeneratedPlanToWeeklySchedule,
  createEmptySchedule,
  createScheduleEntry,
  generateSmartWorkoutPlan,
  getScheduleCellKey,
  loadWeeklySchedule,
  resolveWorkoutGoal,
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
const SCHEDULE_ENTRY_DRAG_TYPE = "application/gym-schedule-entry";
const DEFAULT_SELECTED_CELL_KEY = getScheduleCellKey(scheduleDays[0].value, schedulePeriods[0].value);

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

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatShortDate(date: Date) {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function getWeekDates(weekOffset = 0) {
  const today = new Date();
  const mondayOffset = (today.getDay() + 6) % 7;
  const monday = new Date(today);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(today.getDate() - mondayOffset + weekOffset * 7);

  return scheduleDays.map((_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return date;
  });
}

const calendarDayLabels = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const GOAL_SUGGESTIONS = [
  "Tôi muốn giảm cân và săn chắc cơ thể",
  "Tôi muốn tăng cơ, khỏe hơn",
  "Tôi muốn cải thiện sức bền, chạy bền hơn",
  "Tôi muốn dẻo dai và linh hoạt hơn",
  "Tôi mới bắt đầu, chỉ muốn khỏe mạnh hơn",
];

export function SchedulePage() {
  const currentUser = getCurrentUser();
  const scheduleGridRef = useRef<HTMLElement | null>(null);
  const skipNextScheduleSaveRef = useRef(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const initialWeekStartKey = formatDateKey(getWeekDates(0)[0]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [schedule, setSchedule] = useState<WeeklySchedule>(() =>
    loadWeeklySchedule(currentUser?.id, initialWeekStartKey),
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState("all");
  const [selectedFitnessLevel, setSelectedFitnessLevel] =
    useState<"beginner" | "intermediate" | "advanced">("beginner");
  const [activeDropKey, setActiveDropKey] = useState<string | null>(null);
  const [selectedCellKey, setSelectedCellKey] = useState(DEFAULT_SELECTED_CELL_KEY);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [goalText, setGoalText] = useState("");
  const [daysPerWeek, setDaysPerWeek] = useState(3);
  const [isGenerating, setIsGenerating] = useState(false);
  const [smartError, setSmartError] = useState<string | null>(null);
  const [smartMessage, setSmartMessage] = useState<string | null>(null);

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

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);
  const weekStartKey = useMemo(() => formatDateKey(weekDates[0]), [weekDates]);
  const todayKey = useMemo(() => formatDateKey(new Date()), []);
  const weekRangeLabel = useMemo(() => {
    return `${formatShortDate(weekDates[0])} - ${formatShortDate(weekDates[6])}`;
  }, [weekDates]);

  useEffect(() => {
    skipNextScheduleSaveRef.current = true;
    setSchedule(loadWeeklySchedule(currentUser?.id, weekStartKey));
    setSelectedCellKey(DEFAULT_SELECTED_CELL_KEY);
  }, [currentUser?.id, weekStartKey]);

  useEffect(() => {
    if (skipNextScheduleSaveRef.current) {
      skipNextScheduleSaveRef.current = false;
      return;
    }

    saveWeeklySchedule(currentUser?.id, schedule, weekStartKey);
  }, [currentUser?.id, schedule, weekStartKey]);

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

  function addExerciseToSelectedCell(exerciseId: string) {
    const [dayValue, periodValue] = selectedCellKey.split("-");
    const day = Number(dayValue);

    if (!day || (periodValue !== "morning" && periodValue !== "afternoon")) {
      return;
    }

    addExerciseToCell(day, periodValue, exerciseId);
    scheduleGridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function moveEntryInCell(day: number, period: SchedulePeriod, entryId: string, direction: -1 | 1) {
    const key = getScheduleCellKey(day, period);

    setSchedule((current) => {
      const cell = current[key];
      const currentIndex = cell.entries.findIndex((entry) => entry.id === entryId);
      const nextIndex = currentIndex + direction;

      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= cell.entries.length) {
        return current;
      }

      const entries = [...cell.entries];
      const [movedEntry] = entries.splice(currentIndex, 1);
      entries.splice(nextIndex, 0, movedEntry);

      return {
        ...current,
        [key]: {
          ...cell,
          entries,
        },
      };
    });
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

  function moveEntry(sourceKey: string, targetKey: string, entryId: string, targetEntryId?: string) {
    setSchedule((current) => {
      const sourceCell = current[sourceKey];
      const targetCell = current[targetKey];
      const movedEntry = sourceCell?.entries.find((entry) => entry.id === entryId);

      if (!sourceCell || !targetCell || !movedEntry) {
        return current;
      }

      const sourceEntries = sourceCell.entries.filter((entry) => entry.id !== entryId);
      const targetBaseEntries =
        sourceKey === targetKey
          ? sourceEntries
          : targetCell.entries.filter((entry) => entry.id !== entryId);
      const targetIndex = targetEntryId
        ? targetBaseEntries.findIndex((entry) => entry.id === targetEntryId)
        : -1;
      const nextTargetEntries = [...targetBaseEntries];

      if (targetIndex >= 0) {
        nextTargetEntries.splice(targetIndex, 0, movedEntry);
      } else {
        nextTargetEntries.push(movedEntry);
      }

      if (sourceKey === targetKey) {
        return {
          ...current,
          [sourceKey]: {
            ...sourceCell,
            entries: nextTargetEntries,
          },
        };
      }

      return {
        ...current,
        [sourceKey]: {
          ...sourceCell,
          entries: sourceEntries,
        },
        [targetKey]: {
          ...targetCell,
          entries: nextTargetEntries,
        },
      };
    });
  }

  function handleDrop(
    event: React.DragEvent<HTMLDivElement>,
    day: number,
    period: SchedulePeriod,
  ) {
    event.preventDefault();
    const targetKey = getScheduleCellKey(day, period);
    const sourceKey = event.dataTransfer.getData(`${SCHEDULE_ENTRY_DRAG_TYPE}:cell`);
    const entryId = event.dataTransfer.getData(SCHEDULE_ENTRY_DRAG_TYPE);
    const exerciseId =
      event.dataTransfer.getData(DRAG_TYPE) || event.dataTransfer.getData("text/plain");

    setActiveDropKey(null);
    setSelectedCellKey(targetKey);

    if (sourceKey && entryId) {
      moveEntry(sourceKey, targetKey, entryId);
      return;
    }

    if (exerciseId) {
      addExerciseToCell(day, period, exerciseId);
    }
  }

  async function handleGenerateSmartPlan() {
    if (!goalText.trim()) {
      setSmartError("Hãy mô tả mục tiêu tập luyện của bạn trước, hoặc chọn một gợi ý bên dưới.");
      return;
    }

    setIsGenerating(true);
    setSmartError(null);
    setSmartMessage(null);

    try {
      const resolved = await resolveWorkoutGoal(goalText);
      const goal = resolved.goal ?? "general_fitness";

      const generated = await generateSmartWorkoutPlan({
        title: `Smart plan ${new Date().toLocaleDateString()}`,
        goal,
        fitnessLevel: selectedFitnessLevel,
        daysPerWeek: resolved.preferred_slots.length || daysPerWeek,
        preferredSlots: resolved.preferred_slots,
      });

      const nextSchedule = applyGeneratedPlanToWeeklySchedule(generated.schedule, (exerciseId) =>
        getExerciseById(exercises, exerciseId),
      );
      setSchedule(nextSchedule);
      setSmartMessage(
        resolved.fallback
          ? `Đã tạo lịch tập theo mục tiêu "${formatLabel(goal)}" (AI tạm thời không khả dụng, dùng gợi ý dự phòng).`
          : `Đã tạo lịch tập theo mục tiêu "${formatLabel(goal)}". Nhấn Save để lưu lại nếu bạn muốn giữ lịch này.`,
      );
    } catch (error) {
      setSmartError(
        error instanceof Error ? error.message : "Không thể tạo lịch tập thông minh.",
      );
    } finally {
      setIsGenerating(false);
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
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              minHeight: 38,
              borderRadius: 999,
              background: "#1f1f1f",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#f5f5f5",
              padding: "0 10px",
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            <button
              type="button"
              onClick={() => setWeekOffset((current) => current - 1)}
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                border: "none",
                background: "rgba(255,255,255,0.06)",
                color: "#f5f5f5",
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
              }}
              aria-label="Previous week"
            >
              <ChevronLeft size={16} />
            </button>
            <span style={{ minWidth: 178, textAlign: "center" }}>
              {weekRangeLabel}
            </span>
            <button
              type="button"
              onClick={() => setWeekOffset((current) => current + 1)}
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                border: "none",
                background: "rgba(255,255,255,0.06)",
                color: "#f5f5f5",
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
              }}
              aria-label="Next week"
            >
              <ChevronRight size={16} />
            </button>
            {weekOffset !== 0 ? (
              <button
                type="button"
                onClick={() => setWeekOffset(0)}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#60a5fa",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 900,
                }}
              >
                This week
              </button>
            ) : null}
          </div>
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

      <section style={{ ...panelStyle, marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <Sparkles size={18} color="#ff9a3d" />
          <div style={{ fontSize: 15, fontWeight: 900, textTransform: "uppercase" }}>
            Tạo lịch tập thông minh
          </div>
        </div>

        <div style={{ color: "#9ca8b7", fontSize: 13, marginBottom: 10 }}>
          Mô tả mục tiêu tập luyện bằng lời của bạn, hệ thống sẽ tự hiểu và tạo lịch tập phù hợp.
        </div>

        <textarea
          value={goalText}
          onChange={(event) => setGoalText(event.target.value)}
          placeholder="Ví dụ: Tôi muốn giảm mỡ bụng và tăng sức bền..."
          rows={3}
          style={{
            width: "100%",
            boxSizing: "border-box",
            borderRadius: 14,
            background: "#1f1f1f",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "#f5f5f5",
            padding: 12,
            fontSize: 14,
            resize: "vertical",
            marginBottom: 10,
          }}
        />

        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <span style={{ color: "#6f7784", fontSize: 12 }}>Chưa biết viết gì? Thử:</span>
          {GOAL_SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => setGoalText(suggestion)}
              style={{
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.04)",
                color: "#cfd5df",
                fontSize: 12,
                padding: "6px 12px",
                cursor: "pointer",
              }}
            >
              {suggestion}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "#9ca8b7", fontSize: 12, textTransform: "uppercase" }}>
              Số ngày/tuần
            </span>
            <select
              value={daysPerWeek}
              onChange={(event) => setDaysPerWeek(Number(event.target.value))}
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
              {[2, 3, 4, 5, 6].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={handleGenerateSmartPlan}
            disabled={isGenerating}
            style={{
              ...startButtonStyle,
              width: "auto",
              opacity: isGenerating ? 0.66 : 1,
              cursor: isGenerating ? "wait" : "pointer",
            }}
          >
            <Sparkles size={18} />
            {isGenerating ? "Đang tạo..." : "Tạo lịch tập"}
          </button>
        </div>

        {smartError ? (
          <div style={{ marginTop: 12, color: "#fecaca", fontSize: 13 }}>{smartError}</div>
        ) : null}
        {smartMessage ? (
          <div style={{ marginTop: 12, color: "#bbf7d0", fontSize: 13 }}>{smartMessage}</div>
        ) : null}
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

      <section ref={scheduleGridRef} style={{ marginBottom: 22, overflowX: "auto", paddingBottom: 4 }}>
        <div
          style={{
            ...panelStyle,
            minWidth: 1280,
            padding: 0,
            overflow: "hidden",
            borderRadius: 18,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "96px repeat(7, minmax(165px, 1fr))",
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
              Session
            </div>
            {scheduleDays.map((day, index) => {
              const isToday = formatDateKey(weekDates[index]) === todayKey;

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
                gridTemplateColumns: "96px repeat(7, minmax(165px, 1fr))",
                borderBottom:
                  periodIndex === schedulePeriods.length - 1
                    ? "none"
                    : "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div
                style={{
                  minHeight: 250,
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
                    onClick={() => setSelectedCellKey(key)}
                    style={{
                      minHeight: 250,
                      borderRight:
                        index === scheduleDays.length - 1
                          ? "none"
                          : "1px solid rgba(255,255,255,0.08)",
                      background:
                        activeDropKey === key
                          ? "rgba(255,122,26,0.12)"
                          : selectedCellKey === key
                            ? "rgba(96,165,250,0.1)"
                            : "rgba(255,255,255,0.01)",
                      boxShadow:
                        selectedCellKey === key
                          ? "inset 0 0 0 1px rgba(96,165,250,0.42)"
                          : "none",
                      padding: 10,
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    {cell.entries.length > 0 ? (
                      <div
                        style={{
                          flex: 1,
                          minHeight: 0,
                          maxHeight: 226,
                          overflowY: "auto",
                          paddingRight: 4,
                          display: "flex",
                          flexDirection: "column",
                          gap: 8,
                          scrollbarWidth: "thin",
                          scrollbarColor: "rgba(255,122,26,0.55) rgba(255,255,255,0.06)",
                        }}
                      >
                        {cell.entries.map((entry, entryIndex) => {
                          const exercise = getExerciseById(exercises, entry.exerciseId);
                          if (!exercise) {
                            return null;
                          }

                          return (
                            <ScheduledExercise
                              key={entry.id}
                              entry={entry}
                              exercise={exercise}
                              orderIndex={entryIndex}
                              totalEntries={cell.entries.length}
                              onRemove={() => removeEntry(day.value, period.value, entry.id)}
                              onChange={(field, value) =>
                                updateEntry(day.value, period.value, entry.id, field, value)
                              }
                              onMoveUp={() => moveEntryInCell(day.value, period.value, entry.id, -1)}
                              onMoveDown={() => moveEntryInCell(day.value, period.value, entry.id, 1)}
                              onDragStart={(event) => {
                                event.dataTransfer.effectAllowed = "move";
                                event.dataTransfer.setData(SCHEDULE_ENTRY_DRAG_TYPE, entry.id);
                                event.dataTransfer.setData(`${SCHEDULE_ENTRY_DRAG_TYPE}:cell`, key);
                              }}
                              onDropBefore={(event) => {
                                const sourceKey = event.dataTransfer.getData(
                                  `${SCHEDULE_ENTRY_DRAG_TYPE}:cell`,
                                );
                                const draggedEntryId =
                                  event.dataTransfer.getData(SCHEDULE_ENTRY_DRAG_TYPE);

                                if (!sourceKey || !draggedEntryId) {
                                  return;
                                }

                                event.preventDefault();
                                event.stopPropagation();
                                setActiveDropKey(null);
                                setSelectedCellKey(key);

                                if (draggedEntryId !== entry.id) {
                                  moveEntry(sourceKey, key, draggedEntryId, entry.id);
                                }
                              }}
                            />
                          );
                        })}
                      </div>
                    ) : (
                      <div
                        style={{
                          flex: 1,
                          minHeight: 226,
                          maxHeight: 226,
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
                        +
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
            <ExerciseLibraryCard
              key={exercise.id}
              exercise={exercise}
              onClick={() => addExerciseToSelectedCell(exercise.id)}
            />
          ))}
        </section>
      )}
    </AppShell>
  );
}

function ExerciseLibraryCard({ exercise, onClick }: { exercise: Exercise; onClick: () => void }) {
  const tone = difficultyTone(exercise.difficulty.toLowerCase());

  return (
    <article
      draggable
      onClick={onClick}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "copy";
        event.dataTransfer.setData(DRAG_TYPE, exercise.id);
        event.dataTransfer.setData("text/plain", exercise.id);
      }}
      style={{
        ...panelStyle,
        padding: 16,
        cursor: "pointer",
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
  orderIndex,
  totalEntries,
  onRemove,
  onChange,
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDropBefore,
}: {
  entry: ScheduleEntry;
  exercise: Exercise;
  orderIndex: number;
  totalEntries: number;
  onRemove: () => void;
  onChange: (
    field: keyof Pick<ScheduleEntry, "sets" | "reps" | "restSeconds">,
    value: number,
  ) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDragStart: (event: React.DragEvent<HTMLDivElement>) => void;
  onDropBefore: (event: React.DragEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDropBefore}
      style={{
        borderRadius: 10,
        background: "rgba(12,12,12,0.82)",
        border: "1px solid rgba(255,255,255,0.08)",
        padding: 8,
        display: "flex",
        flexDirection: "column",
        gap: 7,
        cursor: "grab",
      }}
    >
      <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 6 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: "#9ca8b7", fontSize: 10, textTransform: "uppercase", marginBottom: 3 }}>
            #{orderIndex + 1} · {formatLabel(exercise.muscle_group)}
          </div>
          <div style={{ fontSize: 13, fontWeight: 900, lineHeight: 1.15 }}>{exercise.name}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 3, flex: "0 0 auto" }}>
          <button
            type="button"
            onClick={onMoveUp}
            disabled={orderIndex === 0}
            style={{
              width: 23,
              height: 23,
              borderRadius: "50%",
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.04)",
              color: orderIndex === 0 ? "#56606d" : "#d7dde7",
              display: "grid",
              placeItems: "center",
              cursor: orderIndex === 0 ? "not-allowed" : "pointer",
            }}
            aria-label="Move exercise up"
          >
            <ArrowUp size={12} />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={orderIndex === totalEntries - 1}
            style={{
              width: 23,
              height: 23,
              borderRadius: "50%",
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.04)",
              color: orderIndex === totalEntries - 1 ? "#56606d" : "#d7dde7",
              display: "grid",
              placeItems: "center",
              cursor: orderIndex === totalEntries - 1 ? "not-allowed" : "pointer",
            }}
            aria-label="Move exercise down"
          >
            <ArrowDown size={12} />
          </button>
          <button
            type="button"
            onClick={onRemove}
            style={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.04)",
              color: "#fca5a5",
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
            }}
            aria-label="Remove exercise"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 5,
        }}
      >
        <NumberField label="Sets" value={entry.sets} onChange={(value) => onChange("sets", value)} />
        <NumberField label="Reps" value={entry.reps} onChange={(value) => onChange("reps", value)} />
        <div style={{ gridColumn: "1 / -1" }}>
          <NumberField
            label="Rest"
            value={entry.restSeconds}
            onChange={(value) => onChange("restSeconds", value)}
          />
        </div>
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
      <div style={{ color: "#818b99", fontSize: 9, textTransform: "uppercase", marginBottom: 3 }}>
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
          borderRadius: 7,
          border: "1px solid rgba(255,255,255,0.08)",
          background: "#1d1d1d",
          color: "#f5f5f5",
          minHeight: 28,
          padding: "0 8px",
          fontSize: 12,
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
