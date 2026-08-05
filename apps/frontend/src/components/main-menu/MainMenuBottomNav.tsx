import React from "react";
import { CalendarDays, CreditCard, Dumbbell, Home, LineChart } from "lucide-react";
import { Link } from "react-router-dom";

import { bottomNavItemStyle } from "./styles";

type NavItem = "home" | "train" | "membership" | "progress" | "schedule" | "none";

export function MainMenuBottomNav({
  trainHref = "/exercises",
  membershipHref = "/membership",
  progressHref = "/progress",
  scheduleHref = "/schedule",
  activeItem = "home",
}: {
  trainHref?: string;
  membershipHref?: string;
  progressHref?: string;
  scheduleHref?: string;
  activeItem?: NavItem;
}) {
  return (
    <nav
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(5,5,5,0.96)",
        borderTop: "1px solid #2a2a2a",
        boxShadow: "0 -16px 32px rgba(0,0,0,0.35)",
        padding: "10px 16px calc(14px + env(safe-area-inset-bottom))",
        zIndex: 10,
      }}
    >
      <div
        style={{
          maxWidth: 1440,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
          gap: 8,
          alignItems: "center",
        }}
      >
        <MainMenuBottomNavLink
          label="Home"
          icon={<Home size={21} />}
          to="/"
          active={activeItem === "home"}
        />
        <MainMenuBottomNavLink
          label="Train"
          icon={<Dumbbell size={21} />}
          to={trainHref}
          active={activeItem === "train"}
        />
        <MainMenuBottomNavButton
          label="Membership"
          icon={<CreditCard size={21} />}
          to={membershipHref}
          active={activeItem === "membership"}
        />
        <MainMenuBottomNavButton
          label="Progress"
          icon={<LineChart size={21} />}
          to={progressHref}
          active={activeItem === "progress"}
        />
        <MainMenuBottomNavButton
          label="Schedule"
          icon={<CalendarDays size={21} />}
          to={scheduleHref}
          active={activeItem === "schedule"}
        />
      </div>
    </nav>
  );
}

function MainMenuBottomNavLink({
  label,
  icon,
  to,
  active = false,
}: {
  label: string;
  icon: React.ReactNode;
  to: string;
  active?: boolean;
}) {
  return (
    <Link
      to={to}
      style={{
        textDecoration: "none",
        color: active ? "#ff7a1a" : "rgba(255,255,255,0.28)",
      }}
    >
      <div style={bottomNavItemStyle(active)}>
        {icon}
        <span>{label}</span>
      </div>
    </Link>
  );
}

export function MainMenuBottomNavButton({
  label,
  icon,
  to,
  onClick,
  active = false,
}: {
  label: string;
  icon: React.ReactNode;
  to?: string;
  onClick?: () => void;
  active?: boolean;
}) {
  if (to) {
    return (
      <Link
        to={to}
        style={{
          textDecoration: "none",
          color: active ? "#ff7a1a" : "rgba(255,255,255,0.28)",
        }}
      >
        <div style={bottomNavItemStyle(active)}>
          {icon}
          <span>{label}</span>
        </div>
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...bottomNavItemStyle(active),
        border: "none",
        background: "transparent",
        color: active ? "#ff7a1a" : "rgba(255,255,255,0.28)",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
