import { apiClient } from "./apiClient";

type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
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
  created_at?: string;
  updated_at?: string;
};

export type CurrentMembership = MembershipRecord & {
  days_remaining: number;
  expiring_soon: boolean;
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

export async function renewMembership(planId: string): Promise<MembershipRecord> {
  const response = await apiClient<ApiResponse<MembershipRecord>>("/memberships/renew", {
    method: "POST",
    body: {
      plan_id: planId,
    },
  });

  return response.data;
}
