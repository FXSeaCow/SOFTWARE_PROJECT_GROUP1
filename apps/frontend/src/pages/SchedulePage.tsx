import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Plus,
  RotateCcw,
  Save,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

import { panelStyle, searchBarStyle, startButtonStyle } from "../components/main-menu/styles";
import { useIsMobile } from "../hooks/useIsMobile";
import { AppShell } from "../layouts/AppShell";
import { getCurrentUser } from "../services/authService";
import {
  applyGeneratedPlanToWeeklySchedule,
  createEmptySchedule,
  createScheduleBoardId,
  createScheduleEntry,
  deleteScheduleBoardData,
  generateSmartWorkoutPlan,
  getScheduleCellKey,
  loadScheduleBoards,
  loadWeeklySchedule,
  resolveWorkoutGoal,
  saveCustomWeeklySchedule,
  saveScheduleBoards,
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

// The backend still requires a fitness_level enum on generate/save calls,
// but it's no longer a user-facing control now that boards replace it.
const DEFAULT_FITNESS_LEVEL = "beginner" as const;

const GOAL_SUGGESTIONS = [
  "I want to lose weight and tone up",
  "I want to build muscle and get stronger",
  "I want to improve my stamina and endurance",
  "I want to become more flexible",
  "I'm just starting out, I want to get healthier",
];

export function SchedulePage() {
  const isMobile = useIsMobile();
  const currentUser = getCurrentUser();
  const scheduleGridRef = useRef<HTMLElement | null>(null);
  const skipNextScheduleSaveRef = useRef(false);
  const boardMenuRef = useRef<HTMLDivElement | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const initialWeekStartKey = formatDateKey(getWeekDates(0)[0]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [boardIds, setBoardIds] = useState<string[]>(() => loadScheduleBoards(currentUser?.id));
  const [activeBoardId, setActiveBoardId] = useState<string>(() => boardIds[0]);
  const [isBoardMenuOpen, setIsBoardMenuOpen] = useState(false);
  const [schedule, setSchedule] = useState<WeeklySchedule>(() =>
    loadWeeklySchedule(currentUser?.id, initialWeekStartKey, activeBoardId),
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState("all");
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
  const [isSmartPanelOpen, setIsSmartPanelOpen] = useState(false);

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
    if (!isBoardMenuOpen) {
      return;
    }

    function handleClickOutside(event: MouseEvent) {
      if (boardMenuRef.current && !boardMenuRef.current.contains(event.target as Node)) {
        setIsBoardMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isBoardMenuOpen]);

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);
  const weekStartKey = useMemo(() => formatDateKey(weekDates[0]), [weekDates]);
  const todayKey = useMemo(() => formatDateKey(new Date()), []);
  const weekRangeLabel = useMemo(() => {
    return `${formatShortDate(weekDates[0])} - ${formatShortDate(weekDates[6])}`;
  }, [weekDates]);

  useEffect(() => {
    skipNextScheduleSaveRef.current = true;
    setSchedule(loadWeeklySchedule(currentUser?.id, weekStartKey, activeBoardId));
    setSelectedCellKey(DEFAULT_SELECTED_CELL_KEY);
  }, [currentUser?.id, weekStartKey, activeBoardId]);

  useEffect(() => {
    if (skipNextScheduleSaveRef.current) {
      skipNextScheduleSaveRef.current = false;
      return;
    }

    saveWeeklySchedule(currentUser?.id, schedule, weekStartKey, activeBoardId);
  }, [currentUser?.id, schedule, weekStartKey, activeBoardId]);

  useEffect(() => {
    saveScheduleBoards(currentUser?.id, boardIds);
  }, [currentUser?.id, boardIds]);

  function handleAddScheduleBoard() {
    const newBoardId = createScheduleBoardId();
    setBoardIds((current) => [...current, newBoardId]);
    setActiveBoardId(newBoardId);
    setSaveMessage(null);
  }

  function handleDeleteScheduleBoard(boardId: string) {
    if (boardIds.length <= 1) {
      return;
    }

    const nextBoardIds = boardIds.filter((id) => id !== boardId);
    deleteScheduleBoardData(currentUser?.id, boardId);
    setBoardIds(nextBoardIds);

    if (activeBoardId === boardId) {
      setActiveBoardId(nextBoardIds[0]);
    }
  }

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
      setSmartError("Please describe your workout goal first, or pick a suggestion below.");
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
        fitnessLevel: DEFAULT_FITNESS_LEVEL,
        daysPerWeek: resolved.preferred_slots.length || daysPerWeek,
        preferredSlots: resolved.preferred_slots,
      });

      const nextSchedule = applyGeneratedPlanToWeeklySchedule(generated.schedule, (exerciseId) =>
        getExerciseById(exercises, exerciseId),
      );
      setSchedule(nextSchedule);
      setSmartMessage(
        resolved.fallback
          ? `Generated a schedule for the goal "${formatLabel(goal)}" (AI was temporarily unavailable, used a fallback suggestion).`
          : `Generated a schedule for the goal "${formatLabel(goal)}". Click Save if you want to keep this schedule.`,
      );
    } catch (error) {
      setSmartError(
        error instanceof Error ? error.message : "Unable to generate a smart workout schedule.",
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
        fitnessLevel: DEFAULT_FITNESS_LEVEL,
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
          <div ref={boardMenuRef} style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setIsBoardMenuOpen((current) => !current)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                minHeight: 38,
                minWidth: 160,
                borderRadius: 999,
                background: "#1f1f1f",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#f5f5f5",
                padding: "0 14px",
                fontSize: 14,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              <span>Schedule {boardIds.indexOf(activeBoardId) + 1}</span>
              <ChevronDown
                size={16}
                style={{
                  transform: isBoardMenuOpen ? "rotate(180deg)" : "none",
                  transition: "transform 0.15s ease",
                }}
              />
            </button>

            {isBoardMenuOpen ? (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  left: 0,
                  minWidth: 220,
                  borderRadius: 14,
                  background: "#1f1f1f",
                  border: "1px solid rgba(255,255,255,0.1)",
                  boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
                  overflow: "hidden",
                  zIndex: 70,
                }}
              >
                {boardIds.map((boardId, index) => {
                  const isActive = activeBoardId === boardId;

                  return (
                    <div
                      key={boardId}
                      onClick={() => {
                        setActiveBoardId(boardId);
                        setIsBoardMenuOpen(false);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                        padding: "10px 10px 10px 14px",
                        background: isActive ? "rgba(96,165,250,0.16)" : "transparent",
                        cursor: "pointer",
                      }}
                    >
                      <span
                        style={{
                          color: isActive ? "#60a5fa" : "#f5f5f5",
                          fontSize: 14,
                          fontWeight: 700,
                        }}
                      >
                        Schedule {index + 1}
                      </span>
                      {boardIds.length > 1 ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDeleteScheduleBoard(boardId);
                          }}
                          aria-label={`Delete Schedule ${index + 1}`}
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: "50%",
                            border: "none",
                            background: "rgba(255,255,255,0.06)",
                            color: "#cfd5df",
                            display: "grid",
                            placeItems: "center",
                            cursor: "pointer",
                            flex: "0 0 auto",
                          }}
                        >
                          <X size={12} />
                        </button>
                      ) : null}
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={() => {
                    handleAddScheduleBoard();
                    setIsBoardMenuOpen(false);
                  }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 14px",
                    border: "none",
                    borderTop: "1px solid rgba(255,255,255,0.08)",
                    background: "transparent",
                    color: "#60a5fa",
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  <Plus size={14} />
                  Add schedule
                </button>
              </div>
            ) : null}
          </div>

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
            minWidth: isMobile ? 560 : 1280,
            padding: 0,
            overflow: "hidden",
            borderRadius: 18,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "56px repeat(7, minmax(72px, 1fr))" : "96px repeat(7, minmax(165px, 1fr))",
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
                gridTemplateColumns: isMobile ? "56px repeat(7, minmax(72px, 1fr))" : "96px repeat(7, minmax(165px, 1fr))",
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
                          color: activeDropKey === key ? "#ff9a3d" : "#9ca8b7",
                          fontSize: 34,
                          fontWeight: 300,
                          lineHeight: 1,
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
            gridTemplateColumns: isMobile ? "minmax(0, 1fr)" : "minmax(0, 1.8fr) minmax(180px, 0.8fr)",
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

      {isSmartPanelOpen ? (
        <div
          style={{
            position: "fixed",
            right: 24,
            bottom: 96,
            width: 340,
            maxWidth: "calc(100vw - 32px)",
            maxHeight: "min(560px, calc(100vh - 140px))",
            display: "flex",
            flexDirection: "column",
            borderRadius: 18,
            background: "#161616",
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 18px 48px rgba(0,0,0,0.5)",
            overflow: "hidden",
            zIndex: 60,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              padding: "12px 14px",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,122,26,0.08)",
              flex: "0 0 auto",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Sparkles size={16} color="#ff9a3d" />
              <div style={{ fontSize: 13, fontWeight: 900 }}>
                Smart schedule generator
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsSmartPanelOpen(false)}
              style={{
                width: 26,
                height: 26,
                borderRadius: "50%",
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.04)",
                color: "#cfd5df",
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
                flex: "0 0 auto",
              }}
            >
              <X size={14} />
            </button>
          </div>

          <div style={{ padding: 14, overflowY: "auto", flex: "1 1 auto" }}>
            <div style={{ color: "#9ca8b7", fontSize: 12, marginBottom: 10 }}>
              Describe your workout goal in your own words, and the system will build a matching schedule.
            </div>

            <textarea
              value={goalText}
              onChange={(event) => setGoalText(event.target.value)}
              placeholder="e.g. I want to lose belly fat and improve endurance..."
              rows={3}
              style={{
                width: "100%",
                boxSizing: "border-box",
                borderRadius: 12,
                background: "#1f1f1f",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#f5f5f5",
                padding: 10,
                fontSize: 13,
                resize: "vertical",
                marginBottom: 10,
              }}
            />

            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
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
                    fontSize: 11,
                    padding: "5px 10px",
                    cursor: "pointer",
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span style={{ color: "#9ca8b7", fontSize: 11 }}>
                Days per week
              </span>
              <select
                value={daysPerWeek}
                onChange={(event) => setDaysPerWeek(Number(event.target.value))}
                style={{
                  minHeight: 34,
                  borderRadius: 999,
                  background: "#1f1f1f",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#f5f5f5",
                  padding: "0 12px",
                  fontSize: 13,
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
                width: "100%",
                textTransform: "none",
                opacity: isGenerating ? 0.66 : 1,
                cursor: isGenerating ? "wait" : "pointer",
              }}
            >
              <Sparkles size={16} />
              {isGenerating ? "Generating..." : "Generate schedule"}
            </button>

            {smartError ? (
              <div style={{ marginTop: 10, color: "#fecaca", fontSize: 12 }}>{smartError}</div>
            ) : null}
            {smartMessage ? (
              <div style={{ marginTop: 10, color: "#bbf7d0", fontSize: 12 }}>{smartMessage}</div>
            ) : null}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setIsSmartPanelOpen((current) => !current)}
        title="Smart schedule generator"
        style={{
          position: "fixed",
          right: 24,
          bottom: 24,
          width: 56,
          height: 56,
          borderRadius: "50%",
          border: "none",
          background: "linear-gradient(135deg, #ff7a1a, #ff9a3d)",
          color: "#161616",
          display: "grid",
          placeItems: "center",
          cursor: "pointer",
          boxShadow: "0 10px 30px rgba(255,122,26,0.45)",
          zIndex: 60,
        }}
      >
        {isSmartPanelOpen ? <X size={22} /> : <Sparkles size={22} />}
      </button>
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
