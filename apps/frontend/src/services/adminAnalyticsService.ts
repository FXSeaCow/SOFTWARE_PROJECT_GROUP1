import { apiClient } from "./apiClient";

type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
};

export type ReportRangeParams = {
  fromDate?: string;
  toDate?: string;
  groupBy?: "day" | "month";
  limit?: number;
};

function buildRangeQuery(params: ReportRangeParams = {}): URLSearchParams {
  const query = new URLSearchParams();
  if (params.fromDate) query.set("from_date", params.fromDate);
  if (params.toDate) query.set("to_date", params.toDate);
  if (params.groupBy) query.set("group_by", params.groupBy);
  if (params.limit) query.set("limit", String(params.limit));
  return query;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export type DashboardOverview = {
  total_users: number;
  total_members: number;
  total_admins: number;
  total_memberships: number;
  active_memberships: number;
  memberships_expiring_soon: number;
  active_branches: number;
  active_gym_sessions: number;
  active_workout_plans: number;
  today_checkins: number;
  pending_payments: number;
  lifetime_revenue: number;
  month_revenue: number;
  today_revenue: number;
};

export type RevenueRow = { period: string; transaction_count: number; total_revenue: number };
export type MembershipOverviewRow = { status: string; member_count: number };
export type CurrentOccupancyRow = {
  branch_id: string;
  branch_name: string;
  active_members_in_gym: number;
  capacity: number;
  available_slots: number;
  occupancy_rate: number;
};

export type AdminDashboard = {
  overview: DashboardOverview;
  recent_revenue: RevenueRow[];
  membership_overview: MembershipOverviewRow[];
  current_occupancy: CurrentOccupancyRow[];
};

export async function getAdminDashboard(
  params: { expiringDays?: number; recentLimit?: number } = {},
): Promise<AdminDashboard> {
  const query = new URLSearchParams();
  if (params.expiringDays) query.set("expiring_days", String(params.expiringDays));
  if (params.recentLimit) query.set("recent_limit", String(params.recentLimit));

  const response = await apiClient<ApiResponse<AdminDashboard>>(`/admin/dashboard?${query.toString()}`);
  return response.data;
}

// ─── Revenue report ─────────────────────────────────────────────────────────

export type RevenueReport = {
  filters: { from_date: string | null; to_date: string | null; group_by: string };
  totals: {
    transaction_count: number;
    total_revenue: number;
    average_transaction_amount: number;
    largest_transaction_amount: number;
  };
  rows: RevenueRow[];
};

export async function getAdminRevenueReport(params: ReportRangeParams = {}): Promise<RevenueReport> {
  const response = await apiClient<ApiResponse<RevenueReport>>(
    `/admin/reports/revenue?${buildRangeQuery(params).toString()}`,
  );
  return response.data;
}

// ─── Memberships report ─────────────────────────────────────────────────────

export type MembershipPlanBreakdownRow = {
  plan_id: string;
  plan_name: string;
  price: number;
  duration_days: number;
  total_memberships: number;
  active_memberships: number;
};

export type MembershipTrendRow = { period: string; new_memberships: number };
export type ExpiringMembershipRow = {
  membership_id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  plan_name: string;
  end_date: string;
  days_remaining: number;
};

export type MembershipsReport = {
  filters: { from_date: string | null; to_date: string | null; group_by: string; expiring_days: number };
  overview: MembershipOverviewRow[];
  plan_breakdown: MembershipPlanBreakdownRow[];
  trend: MembershipTrendRow[];
  expiring_soon: ExpiringMembershipRow[];
};

export async function getAdminMembershipsReport(
  params: ReportRangeParams & { expiringDays?: number } = {},
): Promise<MembershipsReport> {
  const query = buildRangeQuery(params);
  if (params.expiringDays) query.set("expiring_days", String(params.expiringDays));

  const response = await apiClient<ApiResponse<MembershipsReport>>(
    `/admin/reports/memberships?${query.toString()}`,
  );
  return response.data;
}

// ─── Occupancy report ───────────────────────────────────────────────────────

export type OccupancyTrendRow = {
  period: string;
  total_sessions: number;
  unique_members: number;
  average_duration_minutes: number;
};

export type OccupancyBranchRow = {
  branch_id: string;
  branch_name: string;
  capacity: number;
  total_sessions: number;
  unique_members: number;
  open_sessions: number;
  average_duration_minutes: number;
  occupancy_rate: number;
};

export type OccupancyReport = {
  filters: { from_date: string | null; to_date: string | null; group_by: string; branch_id: string | null };
  current: CurrentOccupancyRow[];
  summary: { total_active_members: number; total_capacity: number; branches_count: number };
  by_branch: OccupancyBranchRow[];
  trend: OccupancyTrendRow[];
};

export async function getAdminOccupancyReport(
  params: ReportRangeParams & { branchId?: string } = {},
): Promise<OccupancyReport> {
  const query = buildRangeQuery(params);
  if (params.branchId) query.set("branch_id", params.branchId);

  const response = await apiClient<ApiResponse<OccupancyReport>>(
    `/admin/reports/occupancy?${query.toString()}`,
  );
  return response.data;
}

// ─── User statistics ────────────────────────────────────────────────────────

export type UserStatisticsOverview = {
  total_users: number;
  members: number;
  admins: number;
  new_today: number;
  new_this_month: number;
};

export type RoleBreakdownRow = { role: string; user_count: number };
export type UserTrendRow = { period: string; new_users: number };

export type UserStatistics = {
  filters: { from_date: string | null; to_date: string | null; group_by: string };
  overview: UserStatisticsOverview;
  role_breakdown: RoleBreakdownRow[];
  trend: UserTrendRow[];
};

export async function getAdminUserStatistics(params: ReportRangeParams = {}): Promise<UserStatistics> {
  const response = await apiClient<ApiResponse<UserStatistics>>(
    `/admin/statistics/users?${buildRangeQuery(params).toString()}`,
  );
  return response.data;
}

// ─── Workout statistics ─────────────────────────────────────────────────────

export type WorkoutStatisticsOverview = {
  total_plans: number;
  active_plans: number;
  customized_plans: number;
  total_exercises: number;
  total_checkins: number;
  members_with_checkins: number;
};

export type PlanGoalBreakdownRow = { goal: string; plan_count: number };
export type ExerciseBreakdownRow = { muscle_group: string; difficulty: string; exercise_count: number };
export type WorkoutCheckinTrendRow = { period: string; checkin_count: number; unique_members: number };

export type WorkoutStatistics = {
  filters: { from_date: string | null; to_date: string | null; group_by: string; limit: number };
  overview: WorkoutStatisticsOverview;
  plan_goal_breakdown: PlanGoalBreakdownRow[];
  exercise_breakdown: ExerciseBreakdownRow[];
  checkin_trend: WorkoutCheckinTrendRow[];
};

export async function getAdminWorkoutStatistics(params: ReportRangeParams = {}): Promise<WorkoutStatistics> {
  const response = await apiClient<ApiResponse<WorkoutStatistics>>(
    `/admin/statistics/workouts?${buildRangeQuery(params).toString()}`,
  );
  return response.data;
}

// ─── Streak statistics ──────────────────────────────────────────────────────

export type StreakStatisticsOverview = {
  total_streak_records: number;
  active_streaks: number;
  active_today: number;
  at_risk: number;
  broken: number;
  average_current_streak: number;
  max_current_streak: number;
  max_longest_streak: number;
};

export type StreakStatusBreakdownRow = { status: string; streak_count: number };
export type TopStreakRow = {
  user_id: string;
  full_name: string;
  email: string;
  current_streak: number;
  longest_streak: number;
  last_active_date: string | null;
};
export type StreakCheckinTrendRow = {
  period: string;
  checkin_count: number;
  unique_members: number;
  distinct_checkin_dates: number;
};

export type StreakStatistics = {
  filters: { from_date: string | null; to_date: string | null; group_by: string; limit: number };
  overview: StreakStatisticsOverview;
  status_breakdown: StreakStatusBreakdownRow[];
  top_streaks: TopStreakRow[];
  checkin_trend: StreakCheckinTrendRow[];
};

export async function getAdminStreakStatistics(params: ReportRangeParams = {}): Promise<StreakStatistics> {
  const response = await apiClient<ApiResponse<StreakStatistics>>(
    `/admin/statistics/streaks?${buildRangeQuery(params).toString()}`,
  );
  return response.data;
}

// ─── Payment statistics ─────────────────────────────────────────────────────

export type PaymentStatisticsOverview = {
  total_payments: number;
  pending_payments: number;
  completed_payments: number;
  failed_payments: number;
  refunded_payments: number;
  completed_amount: number;
  pending_amount: number;
  refunded_amount: number;
};

export type PaymentStatusBreakdownRow = { status: string; payment_count: number; amount: number };
export type PaymentProviderBreakdownRow = { provider: string; payment_count: number; amount: number };

export type PaymentStatistics = {
  filters: { from_date: string | null; to_date: string | null; group_by: string };
  overview: PaymentStatisticsOverview;
  status_breakdown: PaymentStatusBreakdownRow[];
  provider_breakdown: PaymentProviderBreakdownRow[];
  revenue_trend: RevenueRow[];
};

export async function getAdminPaymentStatistics(params: ReportRangeParams = {}): Promise<PaymentStatistics> {
  const response = await apiClient<ApiResponse<PaymentStatistics>>(
    `/admin/statistics/payments?${buildRangeQuery(params).toString()}`,
  );
  return response.data;
}
