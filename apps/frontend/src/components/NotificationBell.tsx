import React, { useCallback, useEffect, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";

import { iconButtonStyle } from "./main-menu/styles";
import {
  getUnreadNotificationCount,
  listMyNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  UserNotificationRecord,
} from "../services/announcementService";

const NOTIFICATION_REFRESH_INTERVAL_MS = 15000;

function formatDateTime(value?: string | null) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function typeAccent(type: UserNotificationRecord["type"]): React.CSSProperties {
  if (type === "system") {
    return { background: "rgba(239,68,68,0.16)", color: "#fca5a5" };
  }

  if (type === "membership") {
    return { background: "rgba(59,130,246,0.18)", color: "#93c5fd" };
  }

  if (type === "membership_expiry") {
    return { background: "rgba(59,130,246,0.18)", color: "#bfdbfe" };
  }

  if (type === "workout_reminder") {
    return { background: "rgba(34,197,94,0.16)", color: "#bbf7d0" };
  }

  if (type === "streak_warning") {
    return { background: "rgba(20,184,166,0.16)", color: "#99f6e4" };
  }

  if (type === "occupancy_alert") {
    return { background: "rgba(239,68,68,0.16)", color: "#fca5a5" };
  }

  if (type === "schedule") {
    return { background: "rgba(245,158,11,0.16)", color: "#fde68a" };
  }

  return { background: "rgba(255,122,26,0.16)", color: "#ffb15f" };
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<UserNotificationRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  const loadUnreadCount = useCallback(async () => {
    try {
      const nextUnreadCount = await getUnreadNotificationCount();
      setUnreadCount(nextUnreadCount);
    } catch {
      // Keep the previous badge state during transient refresh errors.
    }
  }, []);

  const loadNotifications = useCallback(async ({ showLoading = false } = {}) => {
    if (showLoading) {
      setIsLoading(true);
    }
    setErrorMessage(null);

    try {
      const nextNotifications = await listMyNotifications();
      setNotifications(nextNotifications);
      setUnreadCount(nextNotifications.filter((notification) => !notification.is_read).length);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to load notifications.",
      );
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadUnreadCount();

    const refreshUnreadCount = () => {
      if (document.visibilityState === "visible") {
        void loadUnreadCount();
      }
    };

    const intervalId = window.setInterval(
      refreshUnreadCount,
      NOTIFICATION_REFRESH_INTERVAL_MS,
    );

    window.addEventListener("focus", refreshUnreadCount);
    document.addEventListener("visibilitychange", refreshUnreadCount);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshUnreadCount);
      document.removeEventListener("visibilitychange", refreshUnreadCount);
    };
  }, [loadUnreadCount]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    void loadNotifications({ showLoading: notifications.length === 0 });

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadNotifications();
      }
    }, NOTIFICATION_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [isOpen, loadNotifications, notifications.length]);

  async function handleNotificationClick(notification: UserNotificationRecord) {
    if (notification.is_read) {
      return;
    }

    try {
      const updated = await markNotificationAsRead(notification.id);
      setNotifications((current) =>
        current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)),
      );
      setUnreadCount((current) => Math.max(0, current - 1));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to update notification state.",
      );
    }
  }

  async function handleMarkAllAsRead() {
    setIsMarkingAll(true);
    setErrorMessage(null);

    try {
      await markAllNotificationsAsRead();
      setNotifications((current) =>
        current.map((item) => ({
          ...item,
          is_read: true,
          read_at: item.read_at ?? new Date().toISOString(),
        })),
      );
      setUnreadCount(0);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to mark notifications as read.",
      );
    } finally {
      setIsMarkingAll(false);
    }
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => setIsOpen((current) => !current)}
        style={iconButtonStyle}
      >
        <Bell size={18} />
        {unreadCount > 0 ? (
          <span
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              width: 9,
              height: 9,
              borderRadius: "50%",
              background: "#ff7a1a",
            }}
          />
        ) : null}
      </button>

      {isOpen ? (
        <div
          style={{
            position: "absolute",
            top: 56,
            right: 0,
            width: 380,
            maxWidth: "calc(100vw - 32px)",
            padding: 12,
            display: "grid",
            gap: 12,
            borderRadius: 18,
            background: "rgba(20,20,20,0.98)",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 18px 40px rgba(0,0,0,0.32)",
            zIndex: 30,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontSize: 16, fontWeight: 900 }}>Notifications</div>
              <div style={{ color: "#9ca8b7", fontSize: 13, marginTop: 4 }}>
                {unreadCount} unread
              </div>
            </div>

            <button
              type="button"
              onClick={() => void handleMarkAllAsRead()}
              disabled={isMarkingAll || unreadCount === 0}
              style={{
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12,
                background: "rgba(255,255,255,0.04)",
                color: unreadCount === 0 ? "#6b7280" : "#f5f5f5",
                minHeight: 38,
                padding: "0 12px",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                cursor: unreadCount === 0 ? "default" : "pointer",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              <CheckCheck size={15} />
              {isMarkingAll ? "Updating..." : "Read all"}
            </button>
          </div>

          {errorMessage ? (
            <div
              style={{
                borderRadius: 14,
                padding: "12px 14px",
                background: "rgba(127,29,29,0.32)",
                color: "#fecaca",
                fontSize: 13,
              }}
            >
              {errorMessage}
            </div>
          ) : null}

          <div
            style={{
              display: "grid",
              gap: 10,
              maxHeight: 420,
              overflowY: "auto",
              paddingRight: 2,
            }}
          >
            {isLoading ? (
              <div style={{ color: "#9ca8b7", fontSize: 14, padding: 8 }}>
                Loading notifications...
              </div>
            ) : null}

            {!isLoading && notifications.length === 0 ? (
              <div
                style={{
                  borderRadius: 14,
                  padding: 18,
                  border: "1px dashed rgba(255,255,255,0.12)",
                  color: "#9ca8b7",
                  fontSize: 14,
                }}
              >
                No announcements yet.
              </div>
            ) : null}

            {notifications.map((notification) => (
              <button
                key={notification.id}
                type="button"
                onClick={() => void handleNotificationClick(notification)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  border: notification.is_read
                    ? "1px solid rgba(255,255,255,0.08)"
                    : "1px solid rgba(255,122,26,0.24)",
                  borderRadius: 14,
                  background: notification.is_read
                    ? "rgba(255,255,255,0.02)"
                    : "rgba(255,122,26,0.08)",
                  color: "#f5f5f5",
                  padding: 14,
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "start",
                    justifyContent: "space-between",
                    gap: 10,
                    marginBottom: 10,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>
                      {notification.title}
                    </div>
                    <div style={{ color: "#9ca8b7", fontSize: 12 }}>
                      {notification.created_by_name || "System"} •{" "}
                      {formatDateTime(notification.sent_at)}
                    </div>
                  </div>

                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      minHeight: 24,
                      padding: "0 9px",
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 800,
                      whiteSpace: "nowrap",
                      ...typeAccent(notification.type),
                    }}
                  >
                    {notification.type}
                  </span>
                </div>

                <div
                  style={{
                    color: notification.is_read ? "#cbd5e1" : "#f5f5f5",
                    fontSize: 13,
                    lineHeight: 1.6,
                  }}
                >
                  {notification.body}
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
