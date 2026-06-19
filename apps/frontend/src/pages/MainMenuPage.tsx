import React, { useState } from "react";
import { CalendarDays, ChevronRight, Dumbbell, Flame, Target, Trophy, Activity } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { MainMenuBottomNav } from "../components/main-menu/MainMenuBottomNav";
import { MainMenuCategoryCard } from "../components/main-menu/MainMenuCategoryCard";
import { MainMenuHeader } from "../components/main-menu/MainMenuHeader";
import { MainMenuHeroCard } from "../components/main-menu/MainMenuHeroCard";
import { MainMenuSearchBar } from "../components/main-menu/MainMenuSearchBar";
import { MainMenuStatCard } from "../components/main-menu/MainMenuStatCard";
import { MainMenuWeeklyGoal } from "../components/main-menu/MainMenuWeeklyGoal";
import { panelStyle } from "../components/main-menu/styles";
import { DashboardLayout } from "../layouts/DashboardLayout";
import { getCurrentUser, logout } from "../services/authService";

type StatItem = {
  label: string;
  value: string;
  icon: React.ReactNode;
};

type CategoryItem = {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  accent: string;
};

const stats: StatItem[] = [
  { label: "Workouts", value: "128", icon: <Activity size={18} /> },
  { label: "This Week", value: "5", icon: <CalendarDays size={18} /> },
  { label: "Streak", value: "14d", icon: <Flame size={18} /> },
  { label: "Best", value: "3", icon: <Trophy size={18} /> },
];

const categories: CategoryItem[] = [
  {
    title: "Strength",
    subtitle: "Heavy compound sessions",
    icon: <Dumbbell size={20} />,
    accent: "#ff7a1a",
  },
  {
    title: "Cardio",
    subtitle: "Intervals and endurance",
    icon: <Activity size={20} />,
    accent: "#ff9a3d",
  },
  {
    title: "Mobility",
    subtitle: "Recovery and movement",
    icon: <Target size={20} />,
    accent: "#ffb15f",
  },
];

const weeklyGoal = [true, true, true, true, true, false, false];
const weeklyLabels = ["M", "T", "W", "T", "F", "S", "S"];

export function MainMenuPage() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
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
    <DashboardLayout
      bottomNav={
        <MainMenuBottomNav
          profileHref={currentUser ? "/" : "/login"}
          activeItem="home"
        />
      }
    >
      <MainMenuHeader
        displayName={displayName}
        profileInitials={profileInitials}
        isProfileMenuOpen={isProfileMenuOpen}
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
        onLogoutClick={() => {
          logout();
          navigate("/login", { replace: true });
        }}
      />
      <MainMenuSearchBar />

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
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
          />
        ))}
      </section>

      <MainMenuHeroCard startHref={currentUser ? "/" : "/login"} />

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
            />
          ))}
        </div>
      </section>
    </DashboardLayout>
  );
}
