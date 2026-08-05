import { apiClient } from "./apiClient";

export type StreakStatus = "active" | "at_risk" | "broken" | "not_started";

export type StreakSummary = {
  id: string;
  user_id: string;
  current_streak: number;
  longest_streak: number;
  last_active_date: string | null;
  total_checkins: number;
  status: StreakStatus;
  is_at_risk: boolean;
  is_broken: boolean;
};

export type CheckinRecord = {
  id: string;
  checkin_date: string;
  checked_in_at: string;
  branch_id: string;
};

type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
};

export async function getMyStreak(): Promise<StreakSummary | null> {
  try {
    const response = await apiClient<ApiResponse<StreakSummary>>("/streaks/me");
    return response.data;
  } catch {
    return null;
  }
}

export async function getMyCheckinsInRange(fromDate: string, toDate: string): Promise<CheckinRecord[]> {
  try {
    const response = await apiClient<ApiResponse<CheckinRecord[]>>(
      `/streaks/me/checkins?from_date=${fromDate}&to_date=${toDate}&limit=7`,
    );
    return response.data;
  } catch {
    return [];
  }
}
