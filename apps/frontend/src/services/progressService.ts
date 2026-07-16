import { apiClient } from "./apiClient";

type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
};

type PaginatedApiResponse<T> = ApiResponse<T> & {
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

export type StreakSummary = {
  id: string;
  user_id: string;
  current_streak: number;
  longest_streak: number;
  last_active_date: string | null;
  total_checkins: number;
  status: "not_started" | "active" | "at_risk" | "broken" | string;
  is_at_risk: boolean;
  is_broken: boolean;
};

export type CheckinEntry = {
  id: string;
  user_id: string;
  branch_id: string;
  branch_name: string;
  checkin_date: string;
  checked_in_at: string;
  counted_for_streak: boolean;
};

export type ScheduleExercise = {
  entry_id: string;
  exercise_id: string;
  exercise_name: string;
  muscle_group: string;
  equipment?: string | null;
  difficulty: string;
  sets: number;
  reps: number;
  rest_seconds?: number | null;
  order_index: number;
  notes?: string | null;
};

export type ScheduleDay = {
  day_id: string;
  day_of_week: number;
  day_label: string;
  is_rest_day: boolean;
  exercises: ScheduleExercise[];
};

export type ActivePlan = {
  id: string;
  title: string;
  goal: string;
  fitness_level: string;
};

export type ActiveSchedule = {
  plan: ActivePlan;
  schedule: ScheduleDay[];
};

export type GymBranch = {
  branch_id: string;
  branch_name: string;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
  opening_time?: string | null;
  closing_time?: string | null;
  current_occupancy?: number;
  capacity?: number;
  occupancy_rate?: number;
  is_crowded?: boolean;
};

export async function getMyStreak(): Promise<StreakSummary> {
  const response = await apiClient<ApiResponse<StreakSummary>>("/streaks/me");
  return response.data;
}

export async function getMyCheckins(
  params: { fromDate?: string; toDate?: string; limit?: number } = {},
): Promise<CheckinEntry[]> {
  const query = new URLSearchParams();

  if (params.fromDate) {
    query.set("from_date", params.fromDate);
  }

  if (params.toDate) {
    query.set("to_date", params.toDate);
  }

  query.set("limit", String(params.limit ?? 10));

  const response = await apiClient<PaginatedApiResponse<CheckinEntry[]>>(
    `/streaks/me/checkins?${query.toString()}`,
  );
  return response.data;
}

export async function getActiveSchedule(): Promise<ActiveSchedule> {
  const response = await apiClient<ApiResponse<ActiveSchedule>>("/workouts/active");
  return response.data;
}

export async function getGymBranches(): Promise<GymBranch[]> {
  const response = await apiClient<ApiResponse<GymBranch[]>>("/occupancy/branches");
  return response.data;
}

export async function recordMyCheckin(branchId: string, checkinDate?: string): Promise<CheckinEntry> {
  const response = await apiClient<ApiResponse<{ checkin: CheckinEntry }>>("/streaks/checkins", {
    method: "POST",
    body: {
      branch_id: branchId,
      ...(checkinDate ? { checkin_date: checkinDate } : {}),
    },
  });

  return response.data.checkin;
}
