import { apiClient } from "./apiClient";

type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
};

export type AnnouncementType = "announcement" | "system" | "membership" | "schedule";
export type AnnouncementTarget = "all" | "selected";

export type AdminAnnouncementRecord = {
  id: string;
  created_by?: string | null;
  created_by_name?: string | null;
  title: string;
  body: string;
  published_at: string;
  created_at: string;
  recipient_count: number;
  read_count: number;
};

export type CreateAnnouncementPayload = {
  title: string;
  body: string;
  type: AnnouncementType;
  send_to: AnnouncementTarget;
  user_ids: string[];
};

export type UserNotificationRecord = {
  id: string;
  user_id: string;
  announcement_id?: string | null;
  type: AnnouncementType;
  title: string;
  body: string;
  is_read: boolean;
  sent_at: string;
  read_at?: string | null;
  published_at?: string | null;
  created_by_name?: string | null;
};

export async function listMyNotifications(): Promise<UserNotificationRecord[]> {
  const response = await apiClient<ApiResponse<UserNotificationRecord[]>>("/users/me/notifications");
  return response.data;
}

export async function markNotificationAsRead(notificationId: string): Promise<UserNotificationRecord> {
  const response = await apiClient<ApiResponse<UserNotificationRecord>>(
    `/users/me/notifications/${notificationId}/read`,
    {
      method: "PATCH",
    },
  );

  return response.data;
}

export async function markAllNotificationsAsRead(): Promise<{ updated_count: number }> {
  const response = await apiClient<ApiResponse<{ updated_count: number }>>(
    "/users/me/notifications/read-all",
    {
      method: "PATCH",
    },
  );

  return response.data;
}

export async function listAdminAnnouncements(): Promise<AdminAnnouncementRecord[]> {
  const response = await apiClient<ApiResponse<AdminAnnouncementRecord[]>>("/announcements/admin");
  return response.data;
}

export async function createAdminAnnouncement(
  payload: CreateAnnouncementPayload,
): Promise<AdminAnnouncementRecord> {
  const response = await apiClient<ApiResponse<AdminAnnouncementRecord>>("/announcements/admin", {
    method: "POST",
    body: payload,
  });

  return response.data;
}
