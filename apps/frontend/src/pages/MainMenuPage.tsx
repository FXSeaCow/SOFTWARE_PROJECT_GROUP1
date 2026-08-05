import React, { useState } from "react";
import { Activity, CalendarDays, ChevronRight, Dumbbell, Flame, Target, Trophy } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { MainMenuCategoryCard } from "../components/main-menu/MainMenuCategoryCard";
import { MainMenuHeader } from "../components/main-menu/MainMenuHeader";
import { MainMenuHeroCard } from "../components/main-menu/MainMenuHeroCard";
import { MainMenuStatCard } from "../components/main-menu/MainMenuStatCard";
import { MainMenuWeeklyGoal } from "../components/main-menu/MainMenuWeeklyGoal";
import { useIsMobile } from "../hooks/useIsMobile";
import { AppShell } from "../layouts/AppShell";
import { getCurrentUser, logout } from "../services/authService";

type StatItem = {
  label: string;
  value: string;
  icon: React.ReactNode;
  note: string;
};

type CategoryItem = {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  accent: string;
  metric: string;
};

const stats: StatItem[] = [
  { label: "Workouts completed", value: "128", icon: <Activity size={18} />, note: "12% this month" },
  { label: "This week", value: "5", icon: <CalendarDays size={18} />, note: "25% vs last week" },
  { label: "Streak", value: "14d", icon: <Flame size={18} />, note: "Keep it up!" },
  { label: "Best", value: "3", icon: <Trophy size={18} />, note: "Personal best" },
];

const categories: CategoryItem[] = [
  {
    title: "Strength",
    subtitle: "Build muscle and get stronger",
    icon: <Dumbbell size={20} />,
    accent: "#ff7a1a",
    metric: "24 workouts",
  },
  {
    title: "Cardio",
    subtitle: "Improve endurance and stamina",
    icon: <Activity size={20} />,
    accent: "#ff9a3d",
    metric: "18 sessions",
  },
  {
    title: "Mobility",
    subtitle: "Enhance flexibility and recovery",
    icon: <Target size={20} />,
    accent: "#ffb15f",
    metric: "15 routines",
  },
];

const weeklyGoal = [true, true, true, true, true, false, false];
const weeklyLabels = ["M", "T", "W", "T", "F", "S", "S"];

export function MainMenuPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile(768);
  const currentUser = getCurrentUser();
  const isAdmin = currentUser?.role === "admin";
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const displayName = currentUser?.name?.trim()
    ? currentUser.name.toUpperCase()
    : currentUser?.email
      ? currentUser.email.split("@")[0].replace(/[._-]+/g, " ").toUpperCase()
      : "ALEX CARTER";
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

  return (
    <AppShell activeItem="home">
      <MainMenuHeader
        displayName={displayName}
        profileInitials={profileInitials}
        isProfileMenuOpen={isProfileMenuOpen}
        hideActions
        onProfileClick={() => {
          setIsProfileMenuOpen((current) => !current);
        }}
        onMembershipClick={() => {
          setIsProfileMenuOpen(false);
          navigate("/membership");
        }}
        onAccountClick={() => {
          setIsProfileMenuOpen(false);
          navigate("/account");
        }}
        onAdminClick={() => {
          setIsProfileMenuOpen(false);
          navigate("/admin");
        }}
        showAdminEntry={isAdmin}
        onLogoutClick={() => {
          logout();
          navigate("/login", { replace: true });
        }}
      />
      <div style={{ color: "#8d98a7", fontSize: 16, marginTop: -6, marginBottom: 20 }}>
        Home dashboard
      </div>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "repeat(2, minmax(0, 1fr))" : "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
          marginBottom: 18,
        }}
      >
        {stats.map((item) => (
          <MainMenuStatCard
            key={item.label}
            label={item.label}
            value={item.value}
            icon={item.icon}
            note={item.note}
          />
        ))}
      </section>

      <MainMenuHeroCard
        startHref={currentUser ? "/" : "/login"}
        membershipHref={currentUser ? "/membership" : "/login"}
      />

      <MainMenuWeeklyGoal
        goalDays="5 / 6 days"
        completedDays={weeklyGoal}
        labels={weeklyLabels}
        progressPercent={83}
      />

      <section>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              fontSize: 18,
              fontWeight: 900,
              textTransform: "uppercase",
              letterSpacing: "-0.03em",
            }}
          >
            Categories
          </div>
          <button
            type="button"
            onClick={() => navigate("/exercises")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              border: "none",
              background: "transparent",
              color: "#9ca8b7",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            <span>See all</span>
            <ChevronRight size={16} />
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          {categories.map((category) => (
            <MainMenuCategoryCard
              key={category.title}
              title={category.title}
              subtitle={category.subtitle}
              icon={category.icon}
              accent={category.accent}
              metric={category.metric}
              onClick={() => navigate("/exercises")}
            />
          ))}
        </div>
      </section>
    </AppShell>
  );
}
