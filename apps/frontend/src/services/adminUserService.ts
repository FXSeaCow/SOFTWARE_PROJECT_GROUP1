import { apiClient } from "./apiClient";

export type AdminUserRole = "member" | "admin";
export type AdminUserStatus = "active" | "locked";
export type MembershipStatus = "active" | "expired" | "suspended" | "cancelled" | "none";

export type AdminUserRecord = {
  id: string;
  full_name: string;
  email: string;
  role: AdminUserRole;
  account_status: AdminUserStatus;
  membership_status: MembershipStatus;
  created_at: string;
  updated_at?: string;
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

type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
};

type ListUsersParams = {
  search?: string;
};

export type AdminUsersListResult = {
  users: AdminUserRecord[];
  total: number;
};

export async function listAdminUsers(
  params: ListUsersParams = {},
): Promise<AdminUsersListResult> {
  const listQuery = new URLSearchParams();
  const totalQuery = new URLSearchParams();

  if (params.search?.trim()) {
    listQuery.set("search", params.search.trim());
  }

  listQuery.set("limit", "100");
  totalQuery.set("limit", "1");

  const [listResponse, totalResponse] = await Promise.all([
    apiClient<PaginatedApiResponse<AdminUserRecord[]>>(`/users?${listQuery.toString()}`),
    apiClient<PaginatedApiResponse<AdminUserRecord[]>>(`/users?${totalQuery.toString()}`),
  ]);

  return {
    users: listResponse.data,
    total: totalResponse.pagination.total,
  };
}

export async function updateAdminUserRole(
  userId: string,
  role: AdminUserRole,
): Promise<AdminUserRecord> {
  const response = await apiClient<ApiResponse<AdminUserRecord>>(`/users/${userId}/role`, {
    method: "PATCH",
    body: { role },
  });
  return response.data;
}

export async function toggleAdminUserStatus(user: AdminUserRecord): Promise<AdminUserRecord> {
  const nextStatus: AdminUserStatus = user.account_status === "active" ? "locked" : "active";

  const response = await apiClient<ApiResponse<AdminUserRecord>>(
    `/users/${user.id}/account-status`,
    {
      method: "PATCH",
      body: { account_status: nextStatus },
    },
  );

  return response.data;
}

export async function deleteAdminUser(userId: string): Promise<void> {
  await apiClient<ApiResponse<null>>(`/users/${userId}`, {
    method: "DELETE",
  });
}
