import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

import { getCurrentUser, logout } from "../services/authService";
import { NotificationBell } from "./NotificationBell";
import { UnifiedTopBar } from "./UnifiedTopBar";
import { MainMenuSearchBar } from "./main-menu/MainMenuSearchBar";
import { iconButtonStyle } from "./main-menu/styles";

export type AdminTopBarItem = "overview" | "payments" | "users" | "announcements";

type AdminNavItem = {
  id: "main-menu" | AdminTopBarItem;
  label: string;
  onClick: () => void;
};

export function AdminTopBar({
  activeItem,
  isMobileLayout,
}: {
  activeItem: AdminTopBarItem;
  isMobileLayout: boolean;
}) {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  const profileInitials = currentUser?.name
    ? currentUser.name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("")
    : currentUser?.email
      ? currentUser.email.slice(0, 2).toUpperCase()
      : "AD";

  const navItems: AdminNavItem[] = [
    { id: "main-menu", label: "Main Menu", onClick: () => navigate("/") },
    { id: "overview", label: "Tổng quan", onClick: () => navigate("/admin") },
    { id: "payments", label: "Thanh toán", onClick: () => navigate("/admin/payments") },
    { id: "users", label: "Hội viên", onClick: () => navigate("/admin/users") },
    { id: "announcements", label: "Thông báo", onClick: () => navigate("/admin/announcements") },
  ];

  return (
    <div style={{ animation: "adminBarEnter 240ms cubic-bezier(0.22, 1, 0.36, 1)" }}>
      <UnifiedTopBar
        items={navItems.map((item) => ({
          id: item.id,
          label: item.label,
          onClick: item.onClick,
          active: item.id === activeItem,
        }))}
        isStacked={isMobileLayout}
        rightSlot={
          <>
            <MainMenuSearchBar />
            <NotificationBell />

            <div style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => {
                  setIsProfileMenuOpen((current) => !current);
                }}
                aria-label="Open profile menu"
                title="Open profile menu"
                style={{
                  ...iconButtonStyle,
                  width: 48,
                  borderRadius: "50%",
                  background: "#ff7a1a",
                  color: "#111111",
                  fontWeight: 900,
                  fontSize: 20,
                }}
              >
                {profileInitials}
              </button>

              {isProfileMenuOpen ? (
                <div
                  style={{
                    position: "absolute",
                    top: 58,
                    right: 0,
                    minWidth: 180,
                    padding: 10,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    borderRadius: 16,
                    background: "rgba(20,20,20,0.98)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    boxShadow: "0 18px 40px rgba(0,0,0,0.3)",
                    zIndex: 20,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      navigate("/");
                    }}
                    style={menuButtonStyle}
                  >
                    Main Menu
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      navigate("/account");
                    }}
                    style={menuButtonStyle}
                  >
                    Account
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      logout();
                      navigate("/login", { replace: true });
                    }}
                    style={{
                      ...menuButtonStyle,
                      border: "none",
                      background: "#ff7a1a",
                      color: "#111111",
                    }}
                  >
                    Log out
                  </button>
                </div>
              ) : null}
            </div>
          </>
        }
      />
    </div>
  );
}

const menuButtonStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 44,
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 12,
  background: "rgba(255,255,255,0.04)",
  color: "#f5f5f5",
  fontSize: 14,
  fontWeight: 800,
  cursor: "pointer",
};
