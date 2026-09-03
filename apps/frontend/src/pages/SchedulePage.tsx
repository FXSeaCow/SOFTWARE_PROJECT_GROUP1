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
import { MonthCalendarPicker } from "../components/schedule/MonthCalendarPicker";
import { ScheduleSection } from "../components/schedule/ScheduleSection";
import { WeekDateSelector } from "../components/schedule/WeekDateSelector";
import { useIsMobile } from "../hooks/useIsMobile";
import { AppShell } from "../layouts/AppShell";
import {
  applyGeneratedPlanToWeeklySchedule,
  applySavedPlanToWeeklySchedule,
  activateWorkoutPlan,
  createEmptySchedule,
  createScheduleBoardId,
  createScheduleEntry,
  deleteWorkoutPlan,
  generateSmartWorkoutPlan,
  getWorkoutPlanSchedule,
  getScheduleCellKey,
  listWorkoutPlans,
  resolveWorkoutGoal,
  saveCustomWeeklySchedule,
  scheduleDays,
  schedulePeriods,
  ScheduleEntry,
  SchedulePeriod,
  updateSavedWeeklySchedule,
  WeeklySchedule,
  WorkoutPlanDayRef,
  WorkoutPlanSummary,
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

function getMondayOf(date: Date) {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  const mondayOffset = (normalized.getDay() + 6) % 7;
  normalized.setDate(normalized.getDate() - mondayOffset);
  return normalized;
}

function computeWeekOffsetAndIndex(target: Date) {
  const thisMonday = getMondayOf(new Date());
  const targetMonday = getMondayOf(target);
  const diffDays = Math.round((targetMonday.getTime() - thisMonday.getTime()) / (1000 * 60 * 60 * 24));

  return {
    offset: Math.round(diffDays / 7),
    dayIndex: (target.getDay() + 6) % 7,
  };
}

const calendarDayLabels = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// The backend still requires a fitness_level enum on generate/save calls,
// but it's no longer a user-facing control now that boards replace it.
const DEFAULT_FITNESS_LEVEL = "beginner" as const;
const DEFAULT_DRAFT_SCHEDULE_IDS = ["draft-1", "draft-2", "draft-3"];

function getDraftScheduleIdsStorageKey() {
  return "gym-web.schedule-draft-ids";
}

function loadDraftScheduleIds() {
  const raw = localStorage.getItem(getDraftScheduleIdsStorageKey());

  if (!raw) {
    return [...DEFAULT_DRAFT_SCHEDULE_IDS];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.every((id) => typeof id === "string")) {
      return parsed;
    }
  } catch {
    localStorage.removeItem(getDraftScheduleIdsStorageKey());
  }

  return [...DEFAULT_DRAFT_SCHEDULE_IDS];
}

function saveDraftScheduleIds(ids: string[]) {
  localStorage.setItem(getDraftScheduleIdsStorageKey(), JSON.stringify(ids));
}

const GOAL_SUGGESTIONS = [
  "I want to lose weight and tone up",
  "I want to build muscle and get stronger",
  "I want to improve my stamina and endurance",
  "I want to become more flexible",
  "I'm just starting out, I want to get healthier",
];

type GuidedFitnessLevel = "beginner" | "intermediate" | "advanced";
type GuidedGoal = "muscle_gain" | "weight_loss" | "endurance" | "flexibility" | "general_fitness";

const GUIDED_GOALS: Array<{ value: GuidedGoal; label: string }> = [
  { value: "muscle_gain", label: "Build muscle" },
  { value: "weight_loss", label: "Lose weight" },
  { value: "endurance", label: "Endurance" },
  { value: "flexibility", label: "Flexibility" },
  { value: "general_fitness", label: "General fitness" },
];

const GUIDED_FITNESS_LEVELS: Array<{ value: GuidedFitnessLevel; label: string }> = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

const GUIDED_DEFAULT_SPLITS: Record<number, string[][]> = {
  2: [["chest", "back", "legs"], ["shoulders", "arms", "core"]],
  3: [["chest", "shoulders", "arms"], ["back", "arms"], ["legs", "core"]],
  4: [["chest", "arms"], ["back", "arms"], ["legs", "core"], ["shoulders", "core"]],
  5: [["chest", "arms"], ["back"], ["legs"], ["shoulders", "arms"], ["core", "cardio"]],
  6: [["chest"], ["back"], ["legs"], ["shoulders"], ["arms", "core"], ["cardio", "core"]],
};

const GUIDED_FOCUS_GROUPS = [
  "chest",
  "back",
  "legs",
  "shoulders",
  "arms",
  "core",
  "cardio",
  "full_body",
];

const GUIDED_LEVEL_RANK: Record<GuidedFitnessLevel, number> = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
};

const GUIDED_VOLUME: Record<GuidedGoal, Record<GuidedFitnessLevel, { sets: number; reps: number; restSeconds: number }>> = {
  muscle_gain: {
    beginner: { sets: 3, reps: 10, restSeconds: 90 },
    intermediate: { sets: 4, reps: 8, restSeconds: 90 },
    advanced: { sets: 5, reps: 6, restSeconds: 120 },
  },
  weight_loss: {
    beginner: { sets: 3, reps: 15, restSeconds: 45 },
    intermediate: { sets: 4, reps: 12, restSeconds: 40 },
    advanced: { sets: 4, reps: 15, restSeconds: 30 },
  },
  endurance: {
    beginner: { sets: 2, reps: 20, restSeconds: 30 },
    intermediate: { sets: 3, reps: 20, restSeconds: 30 },
    advanced: { sets: 4, reps: 20, restSeconds: 20 },
  },
  flexibility: {
    beginner: { sets: 2, reps: 12, restSeconds: 60 },
    intermediate: { sets: 3, reps: 12, restSeconds: 60 },
    advanced: { sets: 3, reps: 15, restSeconds: 45 },
  },
  general_fitness: {
    beginner: { sets: 3, reps: 12, restSeconds: 60 },
    intermediate: { sets: 3, reps: 10, restSeconds: 60 },
    advanced: { sets: 4, reps: 10, restSeconds: 60 },
  },
};

function getExerciseDifficultyRank(difficulty?: string | null) {
  if (difficulty === "advanced") return 3;
  if (difficulty === "intermediate") return 2;
  return 1;
}

function getGuidedGroupsForDay(
  dayIndex: number,
  daysPerWeekValue: number,
  focusGroups: string[],
  goal: GuidedGoal,
) {
  const template = GUIDED_DEFAULT_SPLITS[daysPerWeekValue] ?? GUIDED_DEFAULT_SPLITS[3];
  const groups = focusGroups.length
    ? [
        focusGroups[dayIndex % focusGroups.length],
        ...(focusGroups.length > 1 ? [focusGroups[(dayIndex + 1) % focusGroups.length]] : []),
      ]
    : template[dayIndex % template.length];

  if ((goal === "weight_loss" || goal === "endurance") && !groups.includes("cardio")) {
    groups.push("cardio");
  }

  if (goal === "flexibility" && !groups.includes("core")) {
    groups.push("core");
  }

  return [...new Set(groups)];
}

export function SchedulePage() {
  const isMobile = useIsMobile();
  const isCompactLayout = useIsMobile(1100);
  const scheduleGridRef = useRef<HTMLElement | null>(null);
  const calendarSectionsRef = useRef<HTMLDivElement | null>(null);
  const exerciseLibraryRef = useRef<HTMLDivElement | null>(null);
  const pendingDayIndexRef = useRef<number | null>(null);
  const boardMenuRef = useRef<HTMLDivElement | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [draftScheduleIds, setDraftScheduleIds] = useState<string[]>(loadDraftScheduleIds);
  const [draftSchedules, setDraftSchedules] = useState<Record<string, WeeklySchedule>>({});
  const [activeScheduleId, setActiveScheduleId] = useState<string>(() => loadDraftScheduleIds()[0] ?? DEFAULT_DRAFT_SCHEDULE_IDS[0]);
  const [savedScheduleSnapshots, setSavedScheduleSnapshots] = useState<Record<string, string>>({});
  const [isBoardMenuOpen, setIsBoardMenuOpen] = useState(false);
  const [schedule, setSchedule] = useState<WeeklySchedule>(() => createEmptySchedule());
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState("all");
  const [activeDropKey, setActiveDropKey] = useState<string | null>(null);
  const [selectedCellKey, setSelectedCellKey] = useState(DEFAULT_SELECTED_CELL_KEY);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingScheduleId, setDeletingScheduleId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [savedPlans, setSavedPlans] = useState<WorkoutPlanSummary[]>([]);
  const [savedPlanDays, setSavedPlanDays] = useState<Record<string, WorkoutPlanDayRef[]>>({});
  const [isLoadingPlans, setIsLoadingPlans] = useState(true);
  const [goalText, setGoalText] = useState("");
  const [daysPerWeek, setDaysPerWeek] = useState(3);
  const [isGenerating, setIsGenerating] = useState(false);
  const [smartError, setSmartError] = useState<string | null>(null);
  const [smartMessage, setSmartMessage] = useState<string | null>(null);
  const [isSmartPanelOpen, setIsSmartPanelOpen] = useState(false);
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [guidedFitnessLevel, setGuidedFitnessLevel] = useState<GuidedFitnessLevel>("beginner");
  const [guidedGoal, setGuidedGoal] = useState<GuidedGoal>("general_fitness");
  const [guidedFocusGroups, setGuidedFocusGroups] = useState<string[]>([]);
  const [guidedDayPeriods, setGuidedDayPeriods] = useState<Partial<Record<number, SchedulePeriod>>>({});
  const [guidedMessage, setGuidedMessage] = useState<string | null>(null);
  const [deletePrompt, setDeletePrompt] = useState<{
    scheduleId: string;
    title: string;
    message: string;
  } | null>(null);

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

  async function loadSavedPlans() {
    setIsLoadingPlans(true);

    try {
      const plans = await listWorkoutPlans();
      setSavedPlans(plans);
      const preferredPlan = plans.find((plan) => plan.is_active) ?? plans[0] ?? null;

      if (preferredPlan && DEFAULT_DRAFT_SCHEDULE_IDS.includes(activeScheduleId) && !draftSchedules[activeScheduleId]) {
        const saved = await getWorkoutPlanSchedule(preferredPlan.id);
        const nextSchedule = applySavedPlanToWeeklySchedule(saved.schedule);
        setActiveScheduleId(preferredPlan.id);
        setSchedule(nextSchedule);
        setSavedPlanDays((current) => ({ ...current, [preferredPlan.id]: saved.schedule }));
        setSavedScheduleSnapshots((current) => ({ ...current, [preferredPlan.id]: JSON.stringify(nextSchedule) }));
      }
    } catch {
      setSavedPlans([]);
    } finally {
      setIsLoadingPlans(false);
    }
  }

  useEffect(() => {
    void loadSavedPlans();
  }, []);

  useEffect(() => {
    saveDraftScheduleIds(draftScheduleIds);
  }, [draftScheduleIds]);

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
  const activePlan = useMemo(() => savedPlans.find((plan) => plan.is_active) ?? null, [savedPlans]);
  const currentBoardPlan = useMemo(
    () => savedPlans.find((plan) => plan.id === activeScheduleId) ?? null,
    [activeScheduleId, savedPlans],
  );
  const scheduleItems = useMemo(
    () => [
      ...savedPlans.map((plan) => ({ id: plan.id, type: "saved" as const, plan })),
      ...draftScheduleIds.map((id) => ({ id, type: "draft" as const, plan: null })),
    ],
    [draftScheduleIds, savedPlans],
  );
  const activeScheduleIndex = Math.max(
    0,
    scheduleItems.findIndex((item) => item.id === activeScheduleId),
  );
  const currentScheduleSnapshot = useMemo(() => JSON.stringify(schedule), [schedule]);
  const currentSavedScheduleSnapshot = savedScheduleSnapshots[activeScheduleId] ?? JSON.stringify(createEmptySchedule());
  const hasUnsavedBackendChanges = currentSavedScheduleSnapshot !== currentScheduleSnapshot;
  const hasScheduleExercises = useMemo(
    () => Object.values(schedule).some((cell) => cell.entries.length > 0),
    [schedule],
  );
  const isCurrentScheduleActive = Boolean(
    currentBoardPlan && activePlan && currentBoardPlan.id === activePlan.id && !hasUnsavedBackendChanges,
  );
  const isCurrentBoardActive = Boolean(
    currentBoardPlan && activePlan && currentBoardPlan.id === activePlan.id,
  );
  const saveButtonLabel = currentBoardPlan && hasUnsavedBackendChanges && isCurrentBoardActive
    ? "Save Changes"
    : "Save as Active";
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);

  useEffect(() => {
    if (pendingDayIndexRef.current !== null) {
      setSelectedDayIndex(pendingDayIndexRef.current);
      pendingDayIndexRef.current = null;
      return;
    }

    const todayIndex = weekDates.findIndex((date) => formatDateKey(date) === todayKey);
    setSelectedDayIndex(todayIndex >= 0 ? todayIndex : 0);
  }, [weekStartKey]);

  function handlePickDateFromCalendar(date: Date) {
    const { offset, dayIndex } = computeWeekOffsetAndIndex(date);

    if (offset === weekOffset) {
      setSelectedDayIndex(dayIndex);
    } else {
      pendingDayIndexRef.current = dayIndex;
      setWeekOffset(offset);
    }

    setIsMonthPickerOpen(false);
  }

  useEffect(() => {
    if (!hasUnsavedBackendChanges) {
      return;
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedBackendChanges]);

  async function selectSchedule(nextScheduleId: string, skipUnsavedConfirm = false) {
    if (nextScheduleId === activeScheduleId) {
      setIsBoardMenuOpen(false);
      return;
    }

    if (!skipUnsavedConfirm && hasUnsavedBackendChanges && !window.confirm("Switch schedules without saving current changes?")) {
      return;
    }

    setErrorMessage(null);
    setSaveMessage(null);
    setActiveScheduleId(nextScheduleId);
    setSelectedCellKey(DEFAULT_SELECTED_CELL_KEY);

    const plan = savedPlans.find((item) => item.id === nextScheduleId);

    if (plan) {
      try {
        const saved = await getWorkoutPlanSchedule(plan.id);
        const nextSchedule = applySavedPlanToWeeklySchedule(saved.schedule);
        setSchedule(nextSchedule);
        setSavedPlanDays((current) => ({ ...current, [plan.id]: saved.schedule }));
        setSavedScheduleSnapshots((current) => ({ ...current, [plan.id]: JSON.stringify(nextSchedule) }));
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Unable to load saved schedule.");
      } finally {
        setIsBoardMenuOpen(false);
      }
      return;
    }

    const nextDraftSchedule = draftSchedules[nextScheduleId] ?? createEmptySchedule();
    setSchedule(nextDraftSchedule);
    setSavedScheduleSnapshots((current) => ({ ...current, [nextScheduleId]: JSON.stringify(createEmptySchedule()) }));
    setIsBoardMenuOpen(false);
  }

  useEffect(() => {
    if (currentBoardPlan) {
      return;
    }

    setDraftSchedules((current) => ({ ...current, [activeScheduleId]: schedule }));
  }, [activeScheduleId, currentBoardPlan, schedule]);

  function handleAddScheduleBoard() {
    const newBoardId = createScheduleBoardId();
    setDraftScheduleIds((current) => [...current, newBoardId]);
    setActiveScheduleId(newBoardId);
    setSchedule(createEmptySchedule());
    setSavedScheduleSnapshots((current) => ({ ...current, [newBoardId]: JSON.stringify(createEmptySchedule()) }));
    setSaveMessage(null);
  }

  function requestDeleteScheduleBoard(boardId: string) {
    if (scheduleItems.length <= 1) {
      return;
    }

    const plan = savedPlans.find((item) => item.id === boardId);
    const isCurrent = activeScheduleId === boardId;
    const scheduleToDelete = isCurrent ? schedule : draftSchedules[boardId] ?? createEmptySchedule();
    const hasDraftChanges = JSON.stringify(scheduleToDelete) !== JSON.stringify(createEmptySchedule());
    setErrorMessage(null);
    setSaveMessage(null);

    if (plan) {
      setDeletePrompt({
        scheduleId: boardId,
        title: "Delete saved schedule?",
        message: "This will delete the saved workout plan from the server.",
      });
      return;
    }

    if (hasDraftChanges) {
      setDeletePrompt({
        scheduleId: boardId,
        title: "Delete unsaved draft?",
        message: "This draft has unsaved changes. Deleting it will discard those changes.",
      });
      return;
    }

    void deleteScheduleBoard(boardId);
  }

  async function deleteScheduleBoard(boardId: string) {
    if (scheduleItems.length <= 1) {
      setDeletePrompt(null);
      return;
    }

    const plan = savedPlans.find((item) => item.id === boardId);
    const isCurrent = activeScheduleId === boardId;
    setDeletingScheduleId(boardId);
    setErrorMessage(null);
    setSaveMessage(null);

    if (plan) {
      try {
        await deleteWorkoutPlan(plan.id);
        setSavedPlans((current) => current.filter((savedPlan) => savedPlan.id !== plan.id));
        setSavedPlanDays((current) => {
          const next = { ...current };
          delete next[plan.id];
          return next;
        });
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Unable to delete schedule.");
        setDeletingScheduleId(null);
        setDeletePrompt(null);
        return;
      }
    }

    setDraftScheduleIds((current) => current.filter((id) => id !== boardId));
    setDraftSchedules((current) => {
      const next = { ...current };
      delete next[boardId];
      return next;
    });
    setSavedScheduleSnapshots((current) => {
      const next = { ...current };
      delete next[boardId];
      return next;
    });

    if (isCurrent) {
      const nextItems = scheduleItems.filter((item) => item.id !== boardId);
      const nextId = nextItems[0]?.id;

      if (nextId) {
        await selectSchedule(nextId, true);
      } else {
        const fallbackDraftId = DEFAULT_DRAFT_SCHEDULE_IDS[0];
        const emptySchedule = createEmptySchedule();
        setDraftScheduleIds([fallbackDraftId]);
        setActiveScheduleId(fallbackDraftId);
        setSchedule(emptySchedule);
        setSavedScheduleSnapshots((current) => ({ ...current, [fallbackDraftId]: JSON.stringify(emptySchedule) }));
      }
    }

    setDeletingScheduleId(null);
    setDeletePrompt(null);
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

  const availableGuidedFocusGroups = useMemo(() => {
    const catalogGroups = new Set(exercises.map((exercise) => exercise.muscle_group).filter(Boolean));
    return GUIDED_FOCUS_GROUPS.filter((group) => catalogGroups.has(group));
  }, [exercises]);

  const guidedSelectedDays = useMemo(
    () =>
      scheduleDays
        .map((day) => day.value)
        .filter((day) => guidedDayPeriods[day] === "morning" || guidedDayPeriods[day] === "afternoon"),
    [guidedDayPeriods],
  );

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
    const scrollTarget = isCompactLayout ? calendarSectionsRef.current : scheduleGridRef.current;
    scrollTarget?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function toggleGuidedFocusGroup(group: string) {
    setGuidedFocusGroups((current) =>
      current.includes(group)
        ? current.filter((item) => item !== group)
        : [...current, group],
    );
    setGuidedMessage(null);
  }

  function toggleGuidedDayPeriod(day: number, period: SchedulePeriod) {
    setGuidedDayPeriods((current) => {
      const next = { ...current };

      if (next[day] === period) {
        delete next[day];
      } else {
        next[day] = period;
      }

      return next;
    });
    setGuidedMessage(null);
  }

  function selectGuidedTrainingDay(day: number) {
    setGuidedDayPeriods((current) => {
      if (current[day]) {
        const next = { ...current };
        delete next[day];
        return next;
      }

      return {
        ...current,
        [day]: "morning",
      };
    });
    setGuidedMessage(null);
  }

  function pickGuidedExercisesForGroup(group: string, usedExerciseIds: Set<string>, count: number) {
    const maxDifficultyRank = GUIDED_LEVEL_RANK[guidedFitnessLevel];
    const candidates = exercises
      .filter((exercise) => exercise.muscle_group === group)
      .filter((exercise) => getExerciseDifficultyRank(exercise.difficulty) <= maxDifficultyRank);

    const fallbackCandidates = candidates.length > 0
      ? candidates
      : exercises.filter((exercise) => exercise.muscle_group === group);

    return [...fallbackCandidates]
      .map((exercise) => {
        const tags = exercise.goal_tags ?? [];
        const goalScore = tags.includes(guidedGoal) ? 4 : 0;
        const unusedScore = usedExerciseIds.has(exercise.id) ? 0 : 2;
        const exactLevelScore = exercise.difficulty === guidedFitnessLevel ? 1 : 0;
        return { exercise, score: goalScore + unusedScore + exactLevelScore };
      })
      .sort((left, right) =>
        right.score !== left.score
          ? right.score - left.score
          : left.exercise.name.localeCompare(right.exercise.name),
      )
      .slice(0, count)
      .map(({ exercise }) => exercise);
  }

  function handleGenerateGuidedPlan() {
    setGuidedMessage(null);
    setSmartError(null);

    if (isLoading) {
      setGuidedMessage("Exercise catalog is still loading.");
      return;
    }

    if (exercises.length === 0) {
      setGuidedMessage("No exercises are available to generate a schedule.");
      return;
    }

    if (guidedSelectedDays.length === 0) {
      setGuidedMessage("Please select at least one training day.");
      return;
    }

    const nextSchedule = createEmptySchedule();
    const usedExerciseIds = new Set<string>();
    const volume = GUIDED_VOLUME[guidedGoal][guidedFitnessLevel];
    const guidedDaysPerWeek = Math.min(Math.max(guidedSelectedDays.length, 2), 6);
    const exercisesPerSession =
      guidedFitnessLevel === "advanced" ? 6 : guidedFitnessLevel === "intermediate" ? 5 : 4;

    guidedSelectedDays.forEach((day, dayIndex) => {
      const groups = getGuidedGroupsForDay(
        dayIndex,
        guidedDaysPerWeek,
        guidedFocusGroups,
        guidedGoal,
      );
      const perGroupCount = Math.max(1, Math.ceil(exercisesPerSession / groups.length));
      const selectedExercises: Exercise[] = [];

      groups.forEach((group) => {
        pickGuidedExercisesForGroup(group, usedExerciseIds, perGroupCount).forEach((exercise) => {
          if (selectedExercises.length < exercisesPerSession) {
            selectedExercises.push(exercise);
            usedExerciseIds.add(exercise.id);
          }
        });
      });

      const period = guidedDayPeriods[day] ?? "morning";
      const key = getScheduleCellKey(day, period);
      nextSchedule[key] = {
        ...nextSchedule[key],
        entries: selectedExercises.map((exercise) => ({
          id: `${exercise.id}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          exerciseId: exercise.id,
          sets: volume.sets,
          reps: volume.reps,
          restSeconds: volume.restSeconds,
        })),
      };
    });

    setSchedule(nextSchedule);
    setSelectedCellKey(
      getScheduleCellKey(
        guidedSelectedDays[0],
        guidedDayPeriods[guidedSelectedDays[0]] ?? "morning",
      ),
    );
    setSaveMessage(null);
    setGuidedMessage(
      `Generated ${guidedSelectedDays.length} session(s). Review the schedule, then click Save as Active to keep it as your active plan.`,
    );
    const scrollTarget = isCompactLayout ? calendarSectionsRef.current : scheduleGridRef.current;
    window.setTimeout(() => scrollTarget?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  function handleSelectDay(index: number) {
    setSelectedDayIndex(index);
    const currentPeriod = selectedCellKey.split("-")[1] as SchedulePeriod;
    const period: SchedulePeriod = currentPeriod === "afternoon" ? "afternoon" : "morning";
    setSelectedCellKey(getScheduleCellKey(scheduleDays[index].value, period));
  }

  function handleAddSessionForPeriod(period: SchedulePeriod) {
    setSelectedCellKey(getScheduleCellKey(scheduleDays[selectedDayIndex].value, period));
    exerciseLibraryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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
      if (!resolved.is_fitness_related || !resolved.goal) {
        setSmartError(
          resolved.redirect_message ||
            "Please describe a workout goal, such as building muscle, losing weight, or improving endurance.",
        );
        return;
      }

      const goal = resolved.goal;

      const generated = await generateSmartWorkoutPlan({
        title: `Smart plan ${new Date().toLocaleDateString()}`,
        goal,
        fitnessLevel: DEFAULT_FITNESS_LEVEL,
        daysPerWeek: resolved.preferred_slots.length || daysPerWeek,
        preferredSlots: resolved.preferred_slots,
        focusMuscleGroups: resolved.focus_muscle_groups,
        sourceText: goalText,
      });

      const nextSchedule = applyGeneratedPlanToWeeklySchedule(generated.schedule, (exerciseId) =>
        getExerciseById(exercises, exerciseId),
      );
      setSchedule(nextSchedule);
      setSmartMessage(
        resolved.fallback
          ? `Generated a schedule for the goal "${formatLabel(goal)}" (AI was temporarily unavailable, used a fallback suggestion).`
          : `Generated a schedule for the goal "${formatLabel(goal)}". Click Save as Active if you want to keep this schedule.`,
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

    if (!hasScheduleExercises) {
      setErrorMessage("Add at least one exercise before setting this schedule active.");
      setIsSaving(false);
      return;
    }

    try {
      if (currentBoardPlan && !hasUnsavedBackendChanges) {
        const activated = await activateWorkoutPlan(currentBoardPlan.id);
        setSavedPlans((current) =>
          current.map((plan) => ({
            ...plan,
            is_active: plan.id === activated.id,
          })),
        );
        setSaveMessage("This saved schedule is now active.");
        return;
      }

      if (currentBoardPlan && hasUnsavedBackendChanges) {
        const savedDays = savedPlanDays[currentBoardPlan.id] ?? (await getWorkoutPlanSchedule(currentBoardPlan.id)).schedule;
        await updateSavedWeeklySchedule({
          planId: currentBoardPlan.id,
          savedDays,
          schedule,
        });
        const activated = isCurrentBoardActive
          ? currentBoardPlan
          : await activateWorkoutPlan(currentBoardPlan.id);
        setSavedPlans((current) =>
          current.map((plan) => ({
            ...plan,
            is_active: plan.id === activated.id,
          })),
        );
        setSavedPlanDays((current) => ({ ...current, [currentBoardPlan.id]: savedDays }));
        setSavedScheduleSnapshots((current) => ({ ...current, [currentBoardPlan.id]: currentScheduleSnapshot }));
        setSaveMessage("Saved changes. This schedule is now active.");
        return;
      }

      const saved = await saveCustomWeeklySchedule({
        title: `Custom weekly schedule ${new Date().toLocaleDateString()}`,
        goal: "Custom schedule",
        fitnessLevel: DEFAULT_FITNESS_LEVEL,
        schedule,
      });

      await loadSavedPlans();
      setActiveScheduleId(saved.plan.id);
      setDraftScheduleIds((current) => current.filter((id) => id !== activeScheduleId));
      setDraftSchedules((current) => {
        const next = { ...current };
        delete next[activeScheduleId];
        return next;
      });
      setSavedPlanDays((current) => ({ ...current, [saved.plan.id]: saved.schedule }));
      setSavedScheduleSnapshots((current) => ({ ...current, [saved.plan.id]: currentScheduleSnapshot }));
      setSaveMessage("Saved. This schedule is now used for workout reminders.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save schedule.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AppShell activeItem="schedule">
      {deletePrompt ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-schedule-title"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 120,
            display: "grid",
            placeItems: "center",
            background: "rgba(0,0,0,0.62)",
            padding: 18,
          }}
        >
          <div
            style={{
              width: "min(420px, 100%)",
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "#171717",
              boxShadow: "0 24px 80px rgba(0,0,0,0.55)",
              padding: 20,
            }}
          >
            <div id="delete-schedule-title" style={{ fontSize: 20, fontWeight: 900, marginBottom: 8 }}>
              {deletePrompt.title}
            </div>
            <div style={{ color: "#b8c2cf", fontSize: 14, lineHeight: 1.5, marginBottom: 18 }}>
              {deletePrompt.message}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => setDeletePrompt(null)}
                disabled={deletingScheduleId !== null}
                style={{
                  minHeight: 38,
                  borderRadius: 999,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "#222222",
                  color: "#f5f5f5",
                  padding: "0 16px",
                  fontWeight: 900,
                  cursor: deletingScheduleId !== null ? "not-allowed" : "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void deleteScheduleBoard(deletePrompt.scheduleId)}
                disabled={deletingScheduleId !== null}
                style={{
                  minHeight: 38,
                  borderRadius: 999,
                  border: "1px solid rgba(248,113,113,0.28)",
                  background: "#4a1919",
                  color: "#fecaca",
                  padding: "0 16px",
                  fontWeight: 900,
                  cursor: deletingScheduleId !== null ? "not-allowed" : "pointer",
                  opacity: deletingScheduleId !== null ? 0.7 : 1,
                }}
              >
                {deletingScheduleId !== null ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
            <button
              type="button"
              onClick={() => setIsMonthPickerOpen(true)}
              style={{
                minWidth: 178,
                textAlign: "center",
                border: "none",
                background: "transparent",
                color: "inherit",
                font: "inherit",
                cursor: "pointer",
              }}
            >
              {weekRangeLabel}
            </button>
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
              <span>Schedule {activeScheduleIndex + 1}</span>
              {isCurrentScheduleActive ? (
                <span
                  style={{
                    borderRadius: 999,
                    background: "rgba(34,197,94,0.18)",
                    color: "#86efac",
                    padding: "3px 8px",
                    fontSize: 11,
                    fontWeight: 900,
                  }}
                >
                  Active
                </span>
              ) : currentBoardPlan && hasUnsavedBackendChanges ? (
                <span
                  style={{
                    borderRadius: 999,
                    background: "rgba(245,158,11,0.16)",
                    color: "#fde68a",
                    padding: "3px 8px",
                    fontSize: 11,
                    fontWeight: 900,
                  }}
                >
                  Unsaved
                </span>
              ) : currentBoardPlan ? (
                <span
                  style={{
                    borderRadius: 999,
                    background: "rgba(96,165,250,0.14)",
                    color: "#bfdbfe",
                    padding: "3px 8px",
                    fontSize: 11,
                    fontWeight: 900,
                  }}
                >
                  Saved
                </span>
              ) : (
                <span
                  style={{
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.08)",
                    color: "#cfd5df",
                    padding: "3px 8px",
                    fontSize: 11,
                    fontWeight: 900,
                  }}
                >
                  Draft
                </span>
              )}
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
                {scheduleItems.map((item, index) => {
                  const isSelected = activeScheduleId === item.id;
                  const boardPlan = item.plan;
                  const isActivePlan = Boolean(boardPlan?.is_active);

                  return (
                    <div
                      key={item.id}
                      onClick={() => void selectSchedule(item.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                        padding: "10px 10px 10px 14px",
                        background: isSelected ? "rgba(96,165,250,0.16)" : "transparent",
                        cursor: "pointer",
                      }}
                    >
                      <span
                        style={{
                          color: isSelected ? "#60a5fa" : "#f5f5f5",
                          fontSize: 14,
                          fontWeight: 700,
                        }}
                      >
                        Schedule {index + 1}
                      </span>
                      {isActivePlan ? (
                        <span
                          style={{
                            marginLeft: "auto",
                            borderRadius: 999,
                            background: "rgba(34,197,94,0.18)",
                            color: "#86efac",
                            padding: "2px 7px",
                            fontSize: 10,
                            fontWeight: 900,
                          }}
                        >
                          Active
                        </span>
                      ) : boardPlan ? (
                        <span
                          style={{
                            marginLeft: "auto",
                            borderRadius: 999,
                            background: "rgba(96,165,250,0.14)",
                            color: "#bfdbfe",
                            padding: "2px 7px",
                            fontSize: 10,
                            fontWeight: 900,
                          }}
                        >
                          Saved
                        </span>
                      ) : null}
                      {scheduleItems.length > 1 ? (
                        <button
                          type="button"
                          disabled={deletingScheduleId !== null}
                          onClick={(event) => {
                            event.stopPropagation();
                            requestDeleteScheduleBoard(item.id);
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
                            cursor: deletingScheduleId !== null ? "not-allowed" : "pointer",
                            opacity: deletingScheduleId === item.id ? 0.5 : 1,
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
            {isSaving ? "Saving" : saveButtonLabel}
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

      <div
        style={{
          marginTop: -8,
          marginBottom: 18,
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
          color: "#9ca8b7",
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        <span>
          {activePlan ? `Active schedule: ${activePlan.title}` : "No active schedule"}
        </span>
        <span style={{ color: "rgba(255,255,255,0.24)" }}>|</span>
        <span>
          {hasUnsavedBackendChanges
            ? "Current schedule has unsaved changes."
            : currentBoardPlan
              ? "Current schedule is saved."
              : "Current schedule is a local draft until you Save as Active."}
        </span>
      </div>

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

      <section style={{ ...panelStyle, marginBottom: 18 }}>
        <div
          style={{
            display: "flex",
            alignItems: "start",
            justifyContent: "space-between",
            gap: 14,
            marginBottom: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 5 }}>Plan builder</div>
            <div style={{ color: "#9ca8b7", fontSize: 13 }}>
              Pick your training options and generate a schedule from the exercise catalog.
            </div>
          </div>

          <button
            type="button"
            onClick={handleGenerateGuidedPlan}
            disabled={isLoading}
            style={{
              ...startButtonStyle,
              width: "auto",
              opacity: isLoading ? 0.66 : 1,
              cursor: isLoading ? "wait" : "pointer",
            }}
          >
            <Sparkles size={17} />
            Generate plan
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile
              ? "minmax(0, 1fr)"
              : "repeat(2, minmax(0, 1fr))",
            gap: 12,
            marginBottom: 14,
          }}
        >
          <label style={{ display: "grid", gap: 7 }}>
            <span style={{ color: "#9ca8b7", fontSize: 12, textTransform: "uppercase" }}>
              Fitness level
            </span>
            <select
              value={guidedFitnessLevel}
              onChange={(event) => {
                setGuidedFitnessLevel(event.target.value as GuidedFitnessLevel);
                setGuidedMessage(null);
              }}
              style={{
                minHeight: 44,
                borderRadius: 12,
                background: "#1f1f1f",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#f5f5f5",
                padding: "0 12px",
                fontSize: 14,
              }}
            >
              {GUIDED_FITNESS_LEVELS.map((level) => (
                <option key={level.value} value={level.value}>
                  {level.label}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 7 }}>
            <span style={{ color: "#9ca8b7", fontSize: 12, textTransform: "uppercase" }}>
              Goal
            </span>
            <select
              value={guidedGoal}
              onChange={(event) => {
                setGuidedGoal(event.target.value as GuidedGoal);
                setGuidedMessage(null);
              }}
              style={{
                minHeight: 44,
                borderRadius: 12,
                background: "#1f1f1f",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#f5f5f5",
                padding: "0 12px",
                fontSize: 14,
              }}
            >
              {GUIDED_GOALS.map((goal) => (
                <option key={goal.value} value={goal.value}>
                  {goal.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <div style={{ color: "#9ca8b7", fontSize: 12, textTransform: "uppercase", marginBottom: 8 }}>
              Focus areas
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {availableGuidedFocusGroups.map((group) => {
                const isSelected = guidedFocusGroups.includes(group);
                return (
                  <button
                    key={group}
                    type="button"
                    onClick={() => toggleGuidedFocusGroup(group)}
                    style={{
                      borderRadius: 999,
                      border: isSelected
                        ? "1px solid rgba(255,122,26,0.42)"
                        : "1px solid rgba(255,255,255,0.08)",
                      background: isSelected ? "rgba(255,122,26,0.14)" : "rgba(255,255,255,0.03)",
                      color: isSelected ? "#ffb15f" : "#cfd5df",
                      padding: "8px 12px",
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                  >
                    {formatLabel(group)}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div style={{ color: "#9ca8b7", fontSize: 12, textTransform: "uppercase", marginBottom: 8 }}>
              Training days ({guidedSelectedDays.length})
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 8 }}>
              {scheduleDays.map((day) => {
                const selectedPeriod = guidedDayPeriods[day.value];
                return (
                  <div
                    key={day.value}
                    onClick={() => selectGuidedTrainingDay(day.value)}
                    style={{
                      minHeight: 74,
                      borderRadius: 12,
                      border: selectedPeriod
                        ? "1px solid rgba(96,165,250,0.5)"
                        : "1px solid rgba(255,255,255,0.08)",
                      background: selectedPeriod ? "rgba(96,165,250,0.12)" : "rgba(255,255,255,0.03)",
                      padding: 7,
                      display: "grid",
                      gap: 6,
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        color: selectedPeriod ? "#bfdbfe" : "#cfd5df",
                        fontSize: 12,
                        fontWeight: 900,
                        textAlign: "center",
                      }}
                    >
                      {day.shortLabel}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 5 }}>
                      {schedulePeriods.map((period) => {
                        const isPeriodSelected = selectedPeriod === period.value;
                        return (
                          <button
                            key={period.value}
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleGuidedDayPeriod(day.value, period.value);
                            }}
                            style={{
                              minHeight: 30,
                              borderRadius: 8,
                              border: isPeriodSelected
                                ? "1px solid rgba(255,122,26,0.5)"
                                : "1px solid rgba(255,255,255,0.08)",
                              background: isPeriodSelected
                                ? "rgba(255,122,26,0.18)"
                                : "rgba(255,255,255,0.03)",
                              color: isPeriodSelected ? "#ffb15f" : "#9ca8b7",
                              fontSize: 11,
                              fontWeight: 900,
                              cursor: "pointer",
                            }}
                          >
                            {period.value === "morning" ? "AM" : "PM"}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {guidedMessage ? (
          <div
            style={{
              marginTop: 12,
              color: guidedMessage.startsWith("Generated") ? "#bbf7d0" : "#fecaca",
              fontSize: 13,
            }}
          >
            {guidedMessage}
          </div>
        ) : null}
      </section>

      {isCompactLayout ? (
        <div ref={calendarSectionsRef} style={{ maxWidth: 720, margin: "0 auto", width: "100%" }}>
          <WeekDateSelector
            weekDates={weekDates}
            selectedIndex={selectedDayIndex}
            todayKey={todayKey}
            weekOffset={weekOffset}
            onSelectDay={handleSelectDay}
            onPrevWeek={() => setWeekOffset((current) => current - 1)}
            onNextWeek={() => setWeekOffset((current) => current + 1)}
            onResetWeek={() => setWeekOffset(0)}
            formatDateKey={formatDateKey}
          />

          <div
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: "#ffffff",
              marginBottom: 18,
            }}
          >
            {weekDates[selectedDayIndex].toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </div>

          {schedulePeriods.map((period) => {
            const key = getScheduleCellKey(scheduleDays[selectedDayIndex].value, period.value);
            const cell = schedule[key];

            return (
              <ScheduleSection
                key={period.value}
                label={period.label}
                time={cell.time}
                entries={cell.entries}
                getExercise={(exerciseId) => getExerciseById(exercises, exerciseId)}
                onAddSession={() => handleAddSessionForPeriod(period.value)}
                onRemoveEntry={(entryId) =>
                  removeEntry(scheduleDays[selectedDayIndex].value, period.value, entryId)
                }
                onMoveEntry={(entryId, direction) =>
                  moveEntryInCell(scheduleDays[selectedDayIndex].value, period.value, entryId, direction)
                }
              />
            );
          })}
        </div>
      ) : (
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
      )}

      <div ref={exerciseLibraryRef}>
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
      </div>

      {isMonthPickerOpen ? (
        <MonthCalendarPicker
          initialMonth={weekDates[selectedDayIndex]}
          selectedDate={weekDates[selectedDayIndex]}
          todayKey={todayKey}
          formatDateKey={formatDateKey}
          onSelectDate={handlePickDateFromCalendar}
          onClose={() => setIsMonthPickerOpen(false)}
        />
      ) : null}

      {isSmartPanelOpen ? (
        <div
          style={{
            position: "fixed",
            right: 24,
            bottom: isCompactLayout ? 172 : 96,
            width: 340,
            maxWidth: "calc(100vw - 32px)",
            maxHeight: isCompactLayout ? "min(560px, calc(100vh - 216px))" : "min(560px, calc(100vh - 140px))",
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
          bottom: isCompactLayout ? 100 : 24,
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
