import React from "react";
import {
  CalendarDays,
  Dumbbell,
  Home,
  LineChart,
} from "lucide-react";

export type SidebarItemId = "home" | "train" | "progress" | "schedule" | "none";

type SidebarNavItem = {
  id: SidebarItemId;
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
  hidden?: boolean;
};

export function Sidebar({
  activeItem,
  rightSlot,
  onHomeClick,
  onTrainClick,
  onProgressClick,
  onScheduleClick,
}: {
  activeItem: SidebarItemId;
  rightSlot?: React.ReactNode;
  onHomeClick: () => void;
  onTrainClick?: () => void;
  onProgressClick?: () => void;
  onScheduleClick?: () => void;
}) {
  const navItems: SidebarNavItem[] = [
    { id: "home", label: "Home", icon: <Home size={18} />, onClick: onHomeClick },
    { id: "train", label: "Train", icon: <Dumbbell size={18} />, onClick: onTrainClick },
    { id: "progress", label: "Progress", icon: <LineChart size={18} />, onClick: onProgressClick },
    { id: "schedule", label: "Schedule", icon: <CalendarDays size={18} />, onClick: onScheduleClick },
  ];

  return (
    <aside
      style={{
        position: "relative",
        padding: 0,
        background: "rgba(8,8,8,0.94)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 12px 30px rgba(0,0,0,0.28)",
        backdropFilter: "blur(12px)",
        zIndex: 1,
        marginBottom: 18,
      }}
    >
      <div
        style={{
          maxWidth: 1440,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          padding: "14px 12px",
        }}
      >
        <div style={{ flexShrink: 0 }}>
          <div
            style={{
              color: "#ff7a1a",
              fontSize: 24,
              fontWeight: 900,
              letterSpacing: "-0.05em",
              marginBottom: 2,
            }}
          >
            GYM
          </div>
          <div
            style={{
              color: "#f5f5f5",
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            Management
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            flex: 1,
            flexWrap: "wrap",
          }}
        >
          {navItems.map((item) => {
            const isActive = item.id === activeItem;

            return (
              <button
                key={item.id}
                type="button"
                onClick={item.onClick}
                style={{
                  minHeight: 48,
                  borderRadius: 16,
                  border: isActive
                    ? "1px solid rgba(255,122,26,0.5)"
                    : "1px solid rgba(255,255,255,0.08)",
                  background: isActive
                    ? "linear-gradient(90deg, rgba(255,122,26,0.2), rgba(255,122,26,0.06))"
                    : "rgba(255,255,255,0.02)",
                  color: isActive ? "#ffb15f" : "#d1d5db",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "0 18px",
                  fontSize: 14,
                  fontWeight: isActive ? 800 : 700,
                  cursor: item.onClick ? "pointer" : "default",
                  textAlign: "left",
                }}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {rightSlot ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexShrink: 0,
            }}
          >
            {rightSlot}
          </div>
        ) : null}

      </div>
    </aside>
  );
}
