import React from "react";
import { UnifiedTopBar } from "./UnifiedTopBar";

export type SidebarItemId = "home" | "train" | "membership" | "progress" | "schedule" | "none";

type SidebarNavItem = {
  id: string;
  label: string;
  onClick?: () => void;
};

export function Sidebar({
  activeItem,
  rightSlot,
  onHomeClick,
  onTrainClick,
  onMembershipClick,
  onProgressClick,
  onScheduleClick,
  onAdminClick,
  showAdminEntry = false,
}: {
  activeItem: SidebarItemId;
  rightSlot?: React.ReactNode;
  onHomeClick: () => void;
  onTrainClick?: () => void;
  onMembershipClick?: () => void;
  onProgressClick?: () => void;
  onScheduleClick?: () => void;
  onAdminClick?: () => void;
  showAdminEntry?: boolean;
}) {
  const navItems: SidebarNavItem[] = [
    { id: "home", label: "Home", onClick: onHomeClick },
    { id: "train", label: "Train", onClick: onTrainClick },
    { id: "membership", label: "Membership", onClick: onMembershipClick },
    { id: "progress", label: "Progress", onClick: onProgressClick },
    { id: "schedule", label: "Schedule", onClick: onScheduleClick },
    ...(showAdminEntry ? [{ id: "admin", label: "Admin Console", onClick: onAdminClick }] : []),
  ];

  return (
    <UnifiedTopBar
      items={navItems.map((item) => ({
        id: item.id,
        label: item.label,
        onClick: item.onClick,
        active: item.id === activeItem,
      }))}
      rightSlot={rightSlot}
    />
  );
}
