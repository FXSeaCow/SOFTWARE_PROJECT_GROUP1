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

export type OccupancyStatus = "empty" | "normal" | "busy" | "near_full" | "full";

export type BranchMetadata = {
  branch_id: string;
  branch_name: string;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
  opening_time?: string | null;
  closing_time?: string | null;
};

export type OccupancySummary = {
  current_occupancy: number;
  capacity: number;
  available_slots: number;
  occupancy_rate: number;
  status: OccupancyStatus;
  is_full: boolean;
  is_crowded: boolean;
};

export type BranchOccupancy = BranchMetadata & OccupancySummary;

export type CurrentOccupancy = OccupancySummary & {
  total_branches: number;
  branches: BranchOccupancy[];
};

export type GymSession = {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  branch_id: string;
  branch_name: string;
  checked_in_at: string;
  checked_out_at: string | null;
  duration_minutes: number | null;
};

export type CheckInResult = {
  session: GymSession;
  member: { id: string; full_name: string; email: string };
  branch: BranchMetadata;
  source: string;
  occupancy: BranchOccupancy;
  crowding_alert: unknown;
};

export type CheckOutResult = {
  session: GymSession;
  member: { id: string; full_name: string; email: string };
  branch: BranchMetadata;
  occupancy: BranchOccupancy;
};

export async function getCurrentOccupancy(branchId?: string): Promise<CurrentOccupancy | BranchOccupancy> {
  const query = branchId ? `?branch_id=${branchId}` : "";
  const response = await apiClient<ApiResponse<CurrentOccupancy | BranchOccupancy>>(
    `/occupancy/current${query}`,
  );
  return response.data;
}

export async function checkInGym(branchId: string, qrCodeToken?: string): Promise<CheckInResult> {
  const response = await apiClient<ApiResponse<CheckInResult>>("/occupancy/checkin", {
    method: "POST",
    body: qrCodeToken ? { branch_id: branchId, qr_code_token: qrCodeToken } : { branch_id: branchId },
  });
  return response.data;
}

export async function checkOutGym(qrCodeToken?: string): Promise<CheckOutResult> {
  const response = await apiClient<ApiResponse<CheckOutResult>>("/occupancy/checkout", {
    method: "POST",
    body: qrCodeToken ? { qr_code_token: qrCodeToken } : {},
  });
  return response.data;
}

export async function getMyGymSessions(
  params: { status?: "open" | "closed" | "all"; branchId?: string; limit?: number; page?: number } = {},
): Promise<{ sessions: GymSession[]; total: number }> {
  const query = new URLSearchParams();
  query.set("status", params.status ?? "all");
  if (params.branchId) query.set("branch_id", params.branchId);
  query.set("page", String(params.page ?? 1));
  query.set("limit", String(params.limit ?? 10));

  const response = await apiClient<PaginatedApiResponse<GymSession[]>>(
    `/occupancy/me/sessions?${query.toString()}`,
  );
  return { sessions: response.data, total: response.pagination.total };
}

export async function listAdminGymSessions(
  params: {
    status?: "open" | "closed" | "all";
    branchId?: string;
    userId?: string;
    fromDate?: string;
    toDate?: string;
    limit?: number;
    page?: number;
  } = {},
): Promise<{ sessions: GymSession[]; total: number }> {
  const query = new URLSearchParams();
  query.set("status", params.status ?? "all");
  if (params.branchId) query.set("branch_id", params.branchId);
  if (params.userId) query.set("user_id", params.userId);
  if (params.fromDate) query.set("from_date", params.fromDate);
  if (params.toDate) query.set("to_date", params.toDate);
  query.set("page", String(params.page ?? 1));
  query.set("limit", String(params.limit ?? 20));

  const response = await apiClient<PaginatedApiResponse<GymSession[]>>(
    `/occupancy/admin/sessions?${query.toString()}`,
  );
  return { sessions: response.data, total: response.pagination.total };
}

export type HourlyOccupancyPoint = { hour: string; occupancy: number };

export type DailyOccupancyReport = {
  date: string;
  capacity: number;
  total_visits: number;
  unique_members: number;
  open_sessions: number;
  peak_hour: { hour: string | null; occupancy: number };
  average_occupancy: number;
  average_occupancy_rate: number;
  hourly_occupancy: HourlyOccupancyPoint[];
  branch: BranchMetadata | null;
  branches_count: number;
};

export async function getAdminDailyReport(
  params: { date?: string; branchId?: string } = {},
): Promise<DailyOccupancyReport> {
  const query = new URLSearchParams();
  if (params.date) query.set("date", params.date);
  if (params.branchId) query.set("branch_id", params.branchId);

  const response = await apiClient<ApiResponse<DailyOccupancyReport>>(
    `/occupancy/admin/daily-report?${query.toString()}`,
  );
  return response.data;
}

export async function resetOpenSessions(
  branchId?: string,
): Promise<{ closed_count: number; sessions: GymSession[]; branch: BranchMetadata | null; occupancy: CurrentOccupancy }> {
  const response = await apiClient<
    ApiResponse<{ closed_count: number; sessions: GymSession[]; branch: BranchMetadata | null; occupancy: CurrentOccupancy }>
  >("/occupancy/admin/reset-open-sessions", {
    method: "POST",
    body: branchId ? { branch_id: branchId } : {},
  });
  return response.data;
}
