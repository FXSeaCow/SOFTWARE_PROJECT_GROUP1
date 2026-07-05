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

export type PaymentRecord = {
  id: string;
  membership_id?: string;
  amount: number;
  status: "pending" | "completed" | "failed" | "refunded";
  provider: "banking" | "cash";
  provider_tx_id?: string | null;
  admin_note?: string | null;
  paid_at?: string | null;
  created_at: string;
  user_name?: string;
  user_email?: string;
  plan_name?: string;
  activation_code?: string | null;
  activation_code_issued_at?: string | null;
};

export async function requestMembershipPayment(
  membershipId: string,
  transferNote: string,
): Promise<PaymentRecord> {
  const response = await apiClient<ApiResponse<PaymentRecord>>("/payments/request", {
    method: "POST",
    body: {
      membership_id: membershipId,
      provider: "banking",
      transfer_note: transferNote,
    },
  });

  return response.data;
}

export async function getMyPayments(): Promise<PaymentRecord[]> {
  const response = await apiClient<PaginatedApiResponse<PaymentRecord[]>>("/payments/me");
  return response.data;
}

export async function listAdminPayments(status = "pending"): Promise<PaymentRecord[]> {
  const query = new URLSearchParams();
  query.set("status", status);
  query.set("limit", "50");

  const response = await apiClient<PaginatedApiResponse<PaymentRecord[]>>(
    `/payments/admin?${query.toString()}`,
  );

  return response.data;
}

export async function confirmAdminPayment(paymentId: string, note?: string): Promise<PaymentRecord> {
  const response = await apiClient<ApiResponse<PaymentRecord>>(`/payments/admin/${paymentId}/confirm`, {
    method: "POST",
    body: {
      note: note ?? "",
    },
  });

  return response.data;
}

export async function rejectAdminPayment(paymentId: string, reason: string): Promise<PaymentRecord> {
  const response = await apiClient<ApiResponse<PaymentRecord>>(`/payments/admin/${paymentId}/reject`, {
    method: "POST",
    body: {
      reason,
    },
  });

  return response.data;
}
