import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { MainMenuBottomNav } from "../components/main-menu/MainMenuBottomNav";
import { Sidebar, SidebarItemId } from "../components/Sidebar";
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
  const [isDesktopLayout, setIsDesktopLayout] = useState(() => window.innerWidth >= 1100);

  useEffect(() => {
    function handleResize() {
      setIsDesktopLayout(window.innerWidth >= 1100);
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <DashboardLayout
      bottomNav={
        isDesktopLayout ? (
          undefined
        ) : (
          <MainMenuBottomNav
            profileHref={currentUser ? "/" : "/login"}
            activeItem={
              activeItem === "home" ||
              activeItem === "train" ||
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
            rightSlot={topBarRightSlot}
            onHomeClick={() => navigate("/")}
          />
        ) : null}

        <div>{children}</div>
      </div>
    </DashboardLayout>
  );
}
