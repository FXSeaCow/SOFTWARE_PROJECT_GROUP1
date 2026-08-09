import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { MainMenuBottomNav } from "../components/main-menu/MainMenuBottomNav";
import { MainMenuMobileHeader, MobileNavLink } from "../components/main-menu/MainMenuMobileHeader";
import { Sidebar, SidebarItemId } from "../components/Sidebar";
import { TopBarActions } from "../components/TopBarActions";
import { DashboardLayout } from "./DashboardLayout";
import { getCurrentUser } from "../services/authService";

export function AppShell({
  activeItem,
  topBarRightSlot,
  children,
}: {
  activeItem: SidebarItemId;
  topBarRightSlot?: React.ReactNode;
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const isAdmin = currentUser?.role === "admin";
  const [isDesktopLayout, setIsDesktopLayout] = useState(() => window.innerWidth >= 1100);

  useEffect(() => {
    function handleResize() {
      setIsDesktopLayout(window.innerWidth >= 1100);
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const profileInitials = currentUser?.name
    ? currentUser.name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("")
    : currentUser?.email
      ? currentUser.email.slice(0, 2).toUpperCase()
      : "AC";

  const mobileNavLinks: MobileNavLink[] = [
    { id: "home", label: "Home", to: "/", active: activeItem === "home" },
    { id: "train", label: "Train", to: "/exercises", active: activeItem === "train" },
    { id: "membership", label: "Membership", to: "/membership", active: activeItem === "membership" },
    { id: "progress", label: "Progress", to: "/progress", active: activeItem === "progress" },
    { id: "schedule", label: "Schedule", to: "/schedule", active: activeItem === "schedule" },
    ...(isAdmin ? [{ id: "admin", label: "Admin Console", to: "/admin", active: activeItem === "none" }] : []),
  ];

  return (
    <DashboardLayout
      bottomNav={
        isDesktopLayout ? (
          undefined
        ) : (
          <MainMenuBottomNav
            activeItem={
              activeItem === "home" ||
              activeItem === "train" ||
              activeItem === "membership" ||
              activeItem === "progress" ||
              activeItem === "schedule"
                ? activeItem
                : "none"
            }
          />
        )
      }
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr)",
          gap: 0,
          alignItems: "start",
        }}
      >
        {isDesktopLayout ? (
          <Sidebar
            activeItem={activeItem}
            rightSlot={topBarRightSlot ?? <TopBarActions />}
            onHomeClick={() => navigate("/")}
            onTrainClick={() => navigate("/exercises")}
            onMembershipClick={() => navigate("/membership")}
            onProgressClick={() => navigate("/progress")}
            onScheduleClick={() => navigate("/schedule")}
            onAdminClick={() => navigate("/admin")}
            showAdminEntry={isAdmin}
          />
        ) : (
          <MainMenuMobileHeader
            navLinks={mobileNavLinks}
            profileInitials={profileInitials}
            profileHref={currentUser ? "/account" : "/login"}
          />
        )}

        <div>{children}</div>
      </div>
    </DashboardLayout>
  );
}
