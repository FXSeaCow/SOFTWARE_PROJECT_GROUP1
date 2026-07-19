import { Exercise } from "./workoutService";
import { apiClient } from "./apiClient";

export type SchedulePeriod = "morning" | "afternoon";

export type ScheduleEntry = {
  id: string;
  exerciseId: string;
  sets: number;
  reps: number;
  restSeconds: number;
};

type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
};

export type ScheduleCell = {
  time: string;
  entries: ScheduleEntry[];
};

export type WeeklySchedule = Record<string, ScheduleCell>;

const DEFAULT_TIMES: Record<SchedulePeriod, string> = {
  morning: "07:00",
  afternoon: "17:30",
};

export const scheduleDays = [
  { value: 1, shortLabel: "Mon", label: "Monday" },
  { value: 2, shortLabel: "Tue", label: "Tuesday" },
  { value: 3, shortLabel: "Wed", label: "Wednesday" },
  { value: 4, shortLabel: "Thu", label: "Thursday" },
  { value: 5, shortLabel: "Fri", label: "Friday" },
  { value: 6, shortLabel: "Sat", label: "Saturday" },
  { value: 7, shortLabel: "Sun", label: "Sunday" },
] as const;

export const schedulePeriods: Array<{ value: SchedulePeriod; label: string }> = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
];

export function getScheduleCellKey(day: number, period: SchedulePeriod) {
  return `${day}-${period}`;
}

export function createEmptySchedule(): WeeklySchedule {
  const schedule: WeeklySchedule = {};

  scheduleDays.forEach((day) => {
    schedulePeriods.forEach((period) => {
      schedule[getScheduleCellKey(day.value, period.value)] = {
        time: DEFAULT_TIMES[period.value],
        entries: [],
      };
    });
  });

  return schedule;
}

export function getScheduleStorageKey(userId?: string) {
  return `gym-web.schedule.${userId || "guest"}`;
}

export function loadWeeklySchedule(userId?: string): WeeklySchedule {
  const fallback = createEmptySchedule();
  const rawSchedule = localStorage.getItem(getScheduleStorageKey(userId));

  if (!rawSchedule) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(rawSchedule) as Partial<WeeklySchedule>;

    return Object.keys(fallback).reduce<WeeklySchedule>((nextSchedule, key) => {
      const cell = parsed[key];
      nextSchedule[key] = {
        time: typeof cell?.time === "string" && cell.time ? cell.time : fallback[key].time,
        entries: Array.isArray(cell?.entries) ? cell.entries : [],
      };
      return nextSchedule;
    }, {});
  } catch {
    localStorage.removeItem(getScheduleStorageKey(userId));
    return fallback;
  }
}

export function saveWeeklySchedule(userId: string | undefined, schedule: WeeklySchedule) {
  localStorage.setItem(getScheduleStorageKey(userId), JSON.stringify(schedule));
}

export function createScheduleEntry(exercise: Exercise): ScheduleEntry {
  return {
    id: `${exercise.id}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    exerciseId: exercise.id,
    sets: 3,
    reps: 10,
    restSeconds: 60,
  };
}

type WorkoutDayResponse = {
  id?: string;
  day_id?: string;
  day_of_week: number;
};

type CreateWorkoutPlanResponse = {
  plan: {
    id: string;
    title: string;
  };
  schedule: WorkoutDayResponse[];
};

export async function saveCustomWeeklySchedule({
  title,
  goal,
  fitnessLevel,
  schedule,
}: {
  title: string;
  goal?: string;
  fitnessLevel: "beginner" | "intermediate" | "advanced";
  schedule: WeeklySchedule;
}) {
  const created = await apiClient<ApiResponse<CreateWorkoutPlanResponse>>("/workouts", {
    method: "POST",
    body: {
      title,
      goal: goal || null,
      fitness_level: fitnessLevel,
    },
  });

  const planId = created.data.plan.id;

  for (const day of created.data.schedule) {
    const dayId = day.day_id || day.id;
    if (!dayId) {
      continue;
    }

    const entries = schedulePeriods.flatMap((period) => {
      const cell = schedule[getScheduleCellKey(day.day_of_week, period.value)];

      return cell.entries.map((entry) => ({
        exercise_id: entry.exerciseId,
        sets: entry.sets,
        reps: entry.reps,
        rest_seconds: entry.restSeconds,
        scheduled_period: period.value,
        scheduled_time: cell.time,
      }));
    });

    await apiClient<ApiResponse<unknown>>(`/workouts/${planId}/days/${dayId}`, {
      method: "PATCH",
      body: {
        is_rest_day: entries.length === 0,
      },
    });

    await apiClient<ApiResponse<unknown>>(`/workouts/${planId}/days/${dayId}/exercises`, {
      method: "PUT",
      body: {
        exercises: entries,
      },
    });
  }

  return created.data;
}
