import { apiClient } from "./apiClient";

type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
};

type ChangePasswordPayload = {
  current_password: string;
  new_password: string;
  confirm_new_password: string;
};

export async function changeMyPassword(payload: ChangePasswordPayload): Promise<string> {
  const response = await apiClient<ApiResponse<null>>("/users/me/password", {
    method: "PATCH",
    body: payload,
  });

  return response.message;
}
