import React, { useEffect, useState } from "react";
import { CalendarDays, CheckCircle2, Dumbbell, Flame, Trophy } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { MainMenuStatCard } from "../components/main-menu/MainMenuStatCard";
import { GoalEntry, ProgressGoalTracking } from "../components/progress/ProgressGoalTracking";
import { MuscleBalanceEntry, ProgressMuscleBalance } from "../components/progress/ProgressMuscleBalance";
import { ProgressSuggestedWorkout } from "../components/progress/ProgressSuggestedWorkout";
import { DayActivity, ProgressWeeklyActivity } from "../components/progress/ProgressWeeklyActivity";
import { ProgressWorkoutHistory, WorkoutHistoryEntry } from "../components/progress/ProgressWorkoutHistory";
import { AppShell } from "../layouts/AppShell";
import {
  ActiveSchedule,
  CheckinEntry,
  GymBranch,
  ScheduleDay,
  StreakSummary,
  getActiveSchedule,
  getGymBranches,
  getMyCheckins,
  getMyStreak,
  recordMyCheckin,
} from "../services/progressService";

const weeklyLabels = ["M", "T", "W", "T", "F", "S", "S"];
const muscleAccentPalette = ["#ff7a1a", "#4fa3ff", "#3ddc97", "#ffd166", "#f04a4a", "#c084fc", "#38bdf8"];

// Goal tracking has no backing API yet (no goals module on the backend) — kept as
// placeholder data until that endpoint exists.
const goals: GoalEntry[] = [
  { label: "Complete 20 workouts this month", currentLabel: "14 / 20", progressPercent: 70 },
  { label: "Bench press 80kg", currentLabel: "72 / 80 kg", progressPercent: 90 },
  { label: "Run 50km this month", currentLabel: "31 / 50 km", progressPercent: 62 },
];

function formatLabel(value: string): string {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getMondayOfWeek(date: Date): Date {
  const monday = new Date(date);
  const daysSinceMonday = (date.getDay() + 6) % 7;
  monday.setDate(date.getDate() - daysSinceMonday);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function buildWeekDates(monday: Date): string[] {
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + index);
    return formatDateLocal(day);
  });
}

function computeMuscleBalance(schedule: ScheduleDay[]): MuscleBalanceEntry[] {
  const counts = new Map<string, number>();
  let total = 0;

  schedule.forEach((day) => {
    day.exercises.forEach((exercise) => {
      counts.set(exercise.muscle_group, (counts.get(exercise.muscle_group) ?? 0) + 1);
      total += 1;
    });
  });

  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .map(([muscleGroup, count], index) => ({
      muscleGroup: formatLabel(muscleGroup),
      percent: total ? Math.round((count / total) * 100) : 0,
      accent: muscleAccentPalette[index % muscleAccentPalette.length],
    }));
}

function findSuggestedDay(schedule: ScheduleDay[]): ScheduleDay | null {
  const jsDay = new Date().getDay();
  const todayDayOfWeek = jsDay === 0 ? 7 : jsDay;

  for (let offset = 0; offset < 7; offset += 1) {
    const dayOfWeek = ((todayDayOfWeek - 1 + offset) % 7) + 1;
    const day = schedule.find((entry) => entry.day_of_week === dayOfWeek);
    if (day && !day.is_rest_day && day.exercises.length > 0) {
      return day;
    }
  }

  return null;
}

export function ProgressPage() {
  const navigate = useNavigate();
  const [streak, setStreak] = useState<StreakSummary | null>(null);
  const [weekCheckins, setWeekCheckins] = useState<CheckinEntry[]>([]);
  const [recentCheckins, setRecentCheckins] = useState<CheckinEntry[]>([]);
  const [activeSchedule, setActiveSchedule] = useState<ActiveSchedule | null>(null);
  const [branches, setBranches] = useState<GymBranch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [isSubmittingCheckin, setIsSubmittingCheckin] = useState(false);
  const [checkinMessage, setCheckinMessage] = useState<string | null>(null);
  const [checkinError, setCheckinError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadProgressData() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const monday = getMondayOfWeek(new Date());
        const weekDates = buildWeekDates(monday);

        const [streakResult, weekCheckinsResult, recentCheckinsResult, scheduleResult, branchesResult] = await Promise.all([
          getMyStreak(),
          getMyCheckins({ fromDate: weekDates[0], toDate: weekDates[6], limit: 100 }),
          getMyCheckins({ limit: 6 }),
          getActiveSchedule().catch(() => null),
          getGymBranches().catch(() => []),
        ]);

        setStreak(streakResult);
        setWeekCheckins(weekCheckinsResult);
        setRecentCheckins(recentCheckinsResult);
        setActiveSchedule(scheduleResult);
        setBranches(branchesResult);
        setSelectedBranchId((current) => current || branchesResult[0]?.branch_id || "");
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Unable to load progress data.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadProgressData();
  }, []);

  async function refreshCheckinData() {
    const monday = getMondayOfWeek(new Date());
    const weekDates = buildWeekDates(monday);

    const [streakResult, weekCheckinsResult, recentCheckinsResult] = await Promise.all([
      getMyStreak(),
      getMyCheckins({ fromDate: weekDates[0], toDate: weekDates[6], limit: 100 }),
      getMyCheckins({ limit: 6 }),
    ]);

    setStreak(streakResult);
    setWeekCheckins(weekCheckinsResult);
    setRecentCheckins(recentCheckinsResult);
  }

  if (isLoading) {
    return (
      <AppShell activeItem="progress">
        <div style={{ color: "#8d98a7", fontSize: 16 }}>Loading progress...</div>
      </AppShell>
    );
  }

  if (errorMessage) {
    return (
      <AppShell activeItem="progress">
        <div style={{ color: "#f87171", fontSize: 16 }}>{errorMessage}</div>
      </AppShell>
    );
  }

  const monday = getMondayOfWeek(new Date());
  const weekDates = buildWeekDates(monday);
  const today = formatDateLocal(new Date());
  const weeklyActivity: DayActivity[] = weekDates.map((date, index) => ({
    label: weeklyLabels[index],
    value: weekCheckins.filter((checkin) => checkin.checkin_date === date).length,
  }));
  const daysActiveThisWeek = new Set(weekCheckins.map((checkin) => checkin.checkin_date)).size;
  const todayCheckin = recentCheckins.find((checkin) => checkin.checkin_date === today);
  const branchOptions = branches.map((branch) => ({
    id: branch.branch_id,
    name: branch.branch_name,
  }));

  async function handleCheckin() {
    if (!selectedBranchId || isSubmittingCheckin || todayCheckin) {
      return;
    }

    setIsSubmittingCheckin(true);
    setCheckinError(null);
    setCheckinMessage(null);

    try {
      const checkin = await recordMyCheckin(selectedBranchId);
      await refreshCheckinData();
      setCheckinMessage(`Checked in successfully at ${checkin.branch_name}.`);
    } catch (error) {
      setCheckinError(error instanceof Error ? error.message : "Unable to check in right now.");
    } finally {
      setIsSubmittingCheckin(false);
    }
  }

  const overviewStats = [
    {
      label: "Current streak",
      value: `${streak?.current_streak ?? 0}d`,
      icon: <Flame size={18} />,
      note: streak?.is_at_risk ? "At risk — check in today" : "Keep it up!",
    },
    {
      label: "Longest streak",
      value: `${streak?.longest_streak ?? 0}d`,
      icon: <Trophy size={18} />,
      note: "Personal best",
    },
    {
      label: "Total check-ins",
      value: `${streak?.total_checkins ?? 0}`,
      icon: <CheckCircle2 size={18} />,
      note: "All-time visits",
    },
    {
      label: "This week",
      value: `${daysActiveThisWeek} / 7`,
      icon: <CalendarDays size={18} />,
      note: "Days checked in",
    },
  ];

  const workoutHistory: WorkoutHistoryEntry[] = recentCheckins.map((checkin) => ({
    date: new Date(`${checkin.checkin_date}T00:00:00`).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    time: new Date(checkin.checked_in_at).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    }),
    branchName: checkin.branch_name,
  }));

  const muscleBalance = activeSchedule ? computeMuscleBalance(activeSchedule.schedule) : [];
  const suggestedDay = activeSchedule ? findSuggestedDay(activeSchedule.schedule) : null;

  return (
    <AppShell activeItem="progress">
      <div style={{ color: "#8d98a7", fontSize: 16, marginTop: -6, marginBottom: 20 }}>
        Track your training progress
      </div>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
          marginBottom: 24,
        }}
      >
        {overviewStats.map((item) => (
          <MainMenuStatCard
            key={item.label}
            label={item.label}
            value={item.value}
            icon={item.icon}
            note={item.note}
          />
        ))}
      </section>

      <ProgressWeeklyActivity
        days={weeklyActivity}
        summary={`${daysActiveThisWeek} check-ins this week`}
        branchOptions={branchOptions}
        selectedBranchId={selectedBranchId}
        onBranchChange={setSelectedBranchId}
        onCheckin={() => void handleCheckin()}
        isSubmitting={isSubmittingCheckin}
        checkinMessage={checkinMessage ?? (todayCheckin ? `You already checked in today at ${todayCheckin.branch_name}.` : null)}
        checkinError={checkinError}
        hasCheckedInToday={Boolean(todayCheckin)}
      />

      <ProgressWorkoutHistory entries={workoutHistory} />

      {muscleBalance.length > 0 ? (
        <ProgressMuscleBalance entries={muscleBalance} />
      ) : (
        <section
          className="interactive-card dashboard-card-enter"
          style={{
            borderRadius: 18,
            border: "1px solid rgba(255,255,255,0.08)",
            padding: 20,
            marginBottom: 24,
            color: "#8d98a7",
            fontSize: 14,
          }}
        >
          Activate a workout plan to see your muscle group balance.
        </section>
      )}

      <ProgressGoalTracking goals={goals} />

      <ProgressSuggestedWorkout
        title={suggestedDay ? suggestedDay.day_label : "No active workout plan"}
        subtitle={
          suggestedDay
            ? suggestedDay.exercises
                .slice(0, 3)
                .map((exercise) => exercise.exercise_name)
                .join(", ")
            : "Generate or activate a workout plan to get a personalized suggestion."
        }
        icon={<Dumbbell size={22} />}
        accent="#ffd166"
        reason={suggestedDay ? `${suggestedDay.exercises.length} exercises` : ""}
        onStart={() => navigate("/exercises")}
      />
    </AppShell>
  );
}
