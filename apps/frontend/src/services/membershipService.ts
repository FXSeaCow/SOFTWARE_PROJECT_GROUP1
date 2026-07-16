import { apiClient } from "./apiClient";

type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
};

type PaginatedApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

export type MembershipPlan = {
  id: string;
  name: string;
  description: string;
  price: number;
  duration_days: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type MembershipRecord = {
  id: string;
  user_id?: string;
  plan_id: string;
  plan_name: string;
  price: number;
  duration_days: number;
  status: "active" | "expired" | "suspended" | "cancelled";
  start_date: string;
  end_date: string;
  activation_code?: string | null;
  activation_code_issued_at?: string | null;
  activated_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type CurrentMembership = MembershipRecord & {
  days_remaining: number;
  expiring_soon: boolean;
};

export type PendingMembershipCheckout = MembershipRecord & {
  transfer_note: string;
  bank_name: string;
  bank_account_name: string;
  bank_account_number: string;
  payment_qr_code: string;
};

export type AdminMembershipRecord = MembershipRecord & {
  user_name: string;
  user_email: string;
};

export async function getMembershipPlans(): Promise<MembershipPlan[]> {
  const response = await apiClient<ApiResponse<MembershipPlan[]>>("/memberships/plans");
  return response.data;
}

export async function getMyMembership(): Promise<CurrentMembership> {
  const response = await apiClient<ApiResponse<CurrentMembership>>("/memberships/me");
  return response.data;
}

export async function getMyMembershipHistory(): Promise<MembershipRecord[]> {
  const response = await apiClient<ApiResponse<MembershipRecord[]>>("/memberships/me/history");
  return response.data;
}

export async function renewMembership(planId: string): Promise<PendingMembershipCheckout> {
  const response = await apiClient<ApiResponse<PendingMembershipCheckout>>("/memberships/renew", {
    method: "POST",
    body: {
      plan_id: planId,
    },
  });

  return response.data;
}

export async function activateMembership(activationCode: string): Promise<MembershipRecord> {
  const response = await apiClient<ApiResponse<MembershipRecord>>("/memberships/activate", {
    method: "POST",
    body: {
      activation_code: activationCode,
    },
  });

  return response.data;
}

export async function getAdminMembershipPlans(): Promise<MembershipPlan[]> {
  const response = await apiClient<ApiResponse<MembershipPlan[]>>("/memberships/admin/plans");
  return response.data;
}

export async function listAdminMemberships(params: {
  userId?: string;
  status?: MembershipRecord["status"];
  limit?: number;
} = {}): Promise<AdminMembershipRecord[]> {
  const query = new URLSearchParams();

  if (params.userId) {
    query.set("user_id", params.userId);
  }

  if (params.status) {
    query.set("status", params.status);
  }

  query.set("limit", String(params.limit ?? 10));

  const response = await apiClient<PaginatedApiResponse<AdminMembershipRecord[]>>(
    `/memberships/admin?${query.toString()}`,
  );

  return response.data;
}

export async function createAdminMembership(userId: string, planId: string): Promise<MembershipRecord> {
  const response = await apiClient<ApiResponse<MembershipRecord>>("/memberships/admin", {
    method: "POST",
    body: {
      user_id: userId,
      plan_id: planId,
    },
  });

  return response.data;
}

export type CreateMembershipPlanInput = {
  name: string;
  description?: string;
  price: number;
  duration_days: number;
};

export type UpdateMembershipPlanInput = Partial<CreateMembershipPlanInput> & {
  is_active?: boolean;
};

export async function createAdminPlan(input: CreateMembershipPlanInput): Promise<MembershipPlan> {
  const response = await apiClient<ApiResponse<MembershipPlan>>("/memberships/admin/plans", {
    method: "POST",
    body: input,
  });

  return response.data;
}

export async function updateAdminPlan(
  planId: string,
  patch: UpdateMembershipPlanInput,
): Promise<MembershipPlan> {
  const response = await apiClient<ApiResponse<MembershipPlan>>(`/memberships/admin/plans/${planId}`, {
    method: "PATCH",
    body: patch,
  });

  return response.data;
}

export async function updateMembershipStatus(
  membershipId: string,
  status: MembershipRecord["status"],
): Promise<MembershipRecord> {
  const response = await apiClient<ApiResponse<MembershipRecord>>(
    `/memberships/admin/${membershipId}/status`,
    {
      method: "PATCH",
      body: { status },
    },
  );

  return response.data;
}

export async function expireOverdueMemberships(): Promise<{ expired_count: number }> {
  const response = await apiClient<ApiResponse<{ expired_count: number }>>(
    "/memberships/admin/expire-overdue",
    { method: "POST" },
  );

  return response.data;
}
