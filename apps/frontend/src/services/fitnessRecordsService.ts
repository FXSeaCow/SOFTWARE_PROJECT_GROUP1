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

export type FitnessRecord = {
  id: string;
  user_id: string;
  recorded_date: string;
  recorded_at: string;
  weight_kg: number | null;
  height_cm: number | null;
  bmi: number | null;
  bmi_category: string | null;
  healthy_weight_range: { min: number; max: number } | null;
  body_fat_pct: number | null;
  body_fat_percent: number | null;
  notes: string | null;
  created_at: string;
};

export type MetricComparison = {
  previous: number | null;
  current: number | null;
  change: number | null;
  direction: "increased" | "decreased" | "unchanged" | null;
};

export type RecordsComparison = {
  from_record_id: string;
  to_record_id: string;
  from_date: string;
  to_date: string;
  weight: MetricComparison;
  bmi: MetricComparison;
  body_fat: MetricComparison;
};

export type TrendPoint = {
  record_id: string;
  recorded_date: string;
  recorded_at: string;
  weight_kg: number | null;
  bmi: number | null;
  body_fat_pct: number | null;
  body_fat_percent: number | null;
};

export type FitnessProgress = {
  record_count: number;
  first_record: FitnessRecord | null;
  latest_record: FitnessRecord | null;
  overall_change: RecordsComparison | null;
  latest_change: RecordsComparison | null;
  trend: TrendPoint[];
  message: string;
};

export type CreateFitnessRecordInput = {
  weight_kg: number;
  height_cm: number;
  body_fat_pct?: number;
  recorded_date?: string;
  notes?: string;
};

export async function listMyFitnessRecords(
  params: { fromDate?: string; toDate?: string; page?: number; limit?: number } = {},
): Promise<{ records: FitnessRecord[]; total: number }> {
  const query = new URLSearchParams();

  if (params.fromDate) query.set("from_date", params.fromDate);
  if (params.toDate) query.set("to_date", params.toDate);
  query.set("page", String(params.page ?? 1));
  query.set("limit", String(params.limit ?? 20));

  const response = await apiClient<PaginatedApiResponse<FitnessRecord[]>>(
    `/fitness-records/me?${query.toString()}`,
  );

  return { records: response.data, total: response.pagination.total };
}

export async function getLatestFitnessRecord(): Promise<FitnessRecord | null> {
  try {
    const response = await apiClient<ApiResponse<FitnessRecord>>("/fitness-records/me/latest");
    return response.data;
  } catch {
    return null;
  }
}

export async function getMyFitnessProgress(
  params: { fromDate?: string; toDate?: string; limit?: number; goal?: string } = {},
): Promise<FitnessProgress> {
  const query = new URLSearchParams();

  if (params.fromDate) query.set("from_date", params.fromDate);
  if (params.toDate) query.set("to_date", params.toDate);
  if (params.limit) query.set("limit", String(params.limit));
  if (params.goal) query.set("goal", params.goal);

  const response = await apiClient<ApiResponse<FitnessProgress>>(
    `/fitness-records/me/progress?${query.toString()}`,
  );

  return response.data;
}

export async function createFitnessRecord(input: CreateFitnessRecordInput): Promise<FitnessRecord> {
  const response = await apiClient<ApiResponse<FitnessRecord>>("/fitness-records", {
    method: "POST",
    body: input,
  });

  return response.data;
}

export async function deleteFitnessRecord(recordId: string): Promise<void> {
  await apiClient<ApiResponse<null>>(`/fitness-records/${recordId}`, {
    method: "DELETE",
  });
}

export type UpdateFitnessRecordInput = Partial<CreateFitnessRecordInput>;

export async function updateFitnessRecord(
  recordId: string,
  patch: UpdateFitnessRecordInput,
): Promise<FitnessRecord> {
  const response = await apiClient<ApiResponse<FitnessRecord>>(`/fitness-records/${recordId}`, {
    method: "PATCH",
    body: patch,
  });

  return response.data;
}

export type AdminFitnessRecord = FitnessRecord & {
  user_name?: string;
  user_email?: string;
};

export async function listAdminFitnessRecords(
  params: { userId?: string; fromDate?: string; toDate?: string; page?: number; limit?: number } = {},
): Promise<{ records: AdminFitnessRecord[]; total: number }> {
  const query = new URLSearchParams();

  if (params.userId) query.set("user_id", params.userId);
  if (params.fromDate) query.set("from_date", params.fromDate);
  if (params.toDate) query.set("to_date", params.toDate);
  query.set("page", String(params.page ?? 1));
  query.set("limit", String(params.limit ?? 20));

  const response = await apiClient<PaginatedApiResponse<AdminFitnessRecord[]>>(
    `/fitness-records/admin?${query.toString()}`,
  );

  return { records: response.data, total: response.pagination.total };
}

export async function getAdminUserFitnessProgress(
  userId: string,
  params: { limit?: number } = {},
): Promise<FitnessProgress> {
  const query = new URLSearchParams();
  if (params.limit) query.set("limit", String(params.limit));

  const response = await apiClient<ApiResponse<FitnessProgress>>(
    `/fitness-records/admin/users/${userId}/progress?${query.toString()}`,
  );

  return response.data;
}
