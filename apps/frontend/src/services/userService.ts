import { apiClient } from "./apiClient";

type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
};

export type UserProfile = {
  id: string;
  email: string;
  full_name: string;
  phone?: string | null;
  role?: string;
  created_at?: string;
  updated_at?: string;
};

export type UserQrCode = {
  qrCode: string;
};

type ChangePasswordPayload = {
  current_password: string;
  new_password: string;
  confirm_new_password: string;
};

export async function getMyProfile(): Promise<UserProfile> {
  const response = await apiClient<ApiResponse<UserProfile>>("/users/me");
  return response.data;
}

export type UpdateProfilePayload = {
  full_name?: string;
  phone?: string | null;
};

export async function updateMyProfile(payload: UpdateProfilePayload): Promise<UserProfile> {
  const response = await apiClient<ApiResponse<UserProfile>>("/users/me", {
    method: "PATCH",
    body: payload,
  });

  return response.data;
}

export async function getMyQrCode(): Promise<UserQrCode> {
  const response = await apiClient<ApiResponse<UserQrCode>>("/users/me/qr");
  return response.data;
}

export async function changeMyPassword(payload: ChangePasswordPayload): Promise<string> {
  const response = await apiClient<ApiResponse<null>>("/users/me/password", {
    method: "PATCH",
    body: payload,
  });

  return response.message;
}
