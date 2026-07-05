import React, { useEffect, useMemo, useState } from "react";
import { BadgeInfo, Dumbbell, Search, Sparkles, Target } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { MainMenuHeader } from "../components/main-menu/MainMenuHeader";
import { panelStyle, searchBarStyle, startButtonStyle } from "../components/main-menu/styles";
import { AppShell } from "../layouts/AppShell";
import { getCurrentUser, logout } from "../services/authService";
import { Exercise, getExercises } from "../services/workoutService";

const difficultyOptions = ["all", "beginner", "intermediate", "advanced"] as const;

function formatLabel(value?: string | null) {
  if (!value) {
    return "Not specified";
  }

  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getDifficultyTone(difficulty: string) {
  if (difficulty === "beginner") {
    return {
      background: "rgba(22,101,52,0.24)",
      border: "1px solid rgba(74,222,128,0.28)",
      color: "#bbf7d0",
    };
  }

  if (difficulty === "intermediate") {
    return {
      background: "rgba(146,64,14,0.24)",
      border: "1px solid rgba(251,191,36,0.28)",
      color: "#fde68a",
    };
  }

  return {
    background: "rgba(127,29,29,0.24)",
    border: "1px solid rgba(248,113,113,0.28)",
    color: "#fecaca",
  };
}

export function WorkoutPage() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const isAdmin = currentUser?.role === "admin";
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedDifficulty, setSelectedDifficulty] =
    useState<(typeof difficultyOptions)[number]>("all");
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const displayName = currentUser?.name?.trim()
    ? currentUser.name.toUpperCase()
    : currentUser?.email
      ? currentUser.email.split("@")[0].replace(/[._-]+/g, " ").toUpperCase()
      : "TRAIN";
  const profileInitials = currentUser?.name
    ? currentUser.name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("")
    : currentUser?.email
      ? currentUser.email.slice(0, 2).toUpperCase()
      : "TR";

  useEffect(() => {
    async function loadExercises() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const nextExercises = await getExercises();
        setExercises(nextExercises);
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Unable to load exercise catalog.",
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadExercises();
  }, []);

  const muscleGroups = useMemo(() => {
    return Array.from(
      new Set(exercises.map((exercise) => exercise.muscle_group).filter(Boolean)),
    ).sort((left, right) => left.localeCompare(right));
  }, [exercises]);

  const visibleExercises = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return exercises.filter((exercise) => {
      if (
        selectedDifficulty !== "all" &&
        exercise.difficulty.toLowerCase() !== selectedDifficulty
      ) {
        return false;
      }

      if (
        selectedMuscleGroup !== "all" &&
        exercise.muscle_group.toLowerCase() !== selectedMuscleGroup
      ) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const haystack = [
        exercise.name,
        exercise.muscle_group,
        exercise.equipment ?? "",
        exercise.description ?? "",
        ...(exercise.goal_tags ?? []),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [exercises, searchTerm, selectedDifficulty, selectedMuscleGroup]);

  return (
    <AppShell activeItem="train">
      <MainMenuHeader
        displayName={displayName}
        profileInitials={profileInitials || "TR"}
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

      <section
        style={{
          display: "flex",
          alignItems: "end",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 18,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 13,
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.48)",
              marginBottom: 8,
            }}
          >
            Exercise library
          </div>
          <h2
            style={{
              margin: 0,
              fontSize: "clamp(1.9rem, 3.6vw, 2.8rem)",
              lineHeight: 0.95,
              fontWeight: 900,
              letterSpacing: "-0.05em",
              textTransform: "uppercase",
            }}
          >
            Browse the exercise catalog
          </h2>
        </div>

        <button
          type="button"
          onClick={() => navigate("/")}
          style={{
            ...startButtonStyle,
            width: "auto",
          }}
        >
          Back Home
        </button>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 14,
          marginBottom: 18,
        }}
      >
        <div style={panelStyle}>
          <div style={{ color: "#9ca8b7", fontSize: 13, textTransform: "uppercase", marginBottom: 8 }}>
            Total exercises
          </div>
          <div style={{ fontSize: 30, fontWeight: 900 }}>{exercises.length}</div>
        </div>
        <div style={panelStyle}>
          <div style={{ color: "#9ca8b7", fontSize: 13, textTransform: "uppercase", marginBottom: 8 }}>
            Muscle groups
          </div>
          <div style={{ fontSize: 30, fontWeight: 900 }}>{muscleGroups.length}</div>
        </div>
        <div style={panelStyle}>
          <div style={{ color: "#9ca8b7", fontSize: 13, textTransform: "uppercase", marginBottom: 8 }}>
            Visible now
          </div>
          <div style={{ fontSize: 30, fontWeight: 900 }}>{visibleExercises.length}</div>
        </div>
      </section>

      <section style={{ ...panelStyle, marginBottom: 18 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.8fr) repeat(2, minmax(180px, 1fr))",
            gap: 14,
          }}
        >
          <label style={{ display: "block" }}>
            <div style={{ color: "#9ca8b7", fontSize: 13, textTransform: "uppercase", marginBottom: 8 }}>
              Search
            </div>
            <div style={searchBarStyle}>
              <Search size={18} color="#9ca8b7" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by name, equipment, tag..."
                style={{
                  flex: 1,
                  minWidth: 0,
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  color: "#f5f5f5",
                  fontSize: 15,
                }}
              />
            </div>
          </label>

          <label style={{ display: "block" }}>
            <div style={{ color: "#9ca8b7", fontSize: 13, textTransform: "uppercase", marginBottom: 8 }}>
              Difficulty
            </div>
            <select
              value={selectedDifficulty}
              onChange={(event) =>
                setSelectedDifficulty(event.target.value as (typeof difficultyOptions)[number])
              }
              style={{
                width: "100%",
                minHeight: 56,
                borderRadius: 18,
                background: "#1f1f1f",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#f5f5f5",
                padding: "0 16px",
                fontSize: 15,
              }}
            >
              {difficultyOptions.map((difficulty) => (
                <option key={difficulty} value={difficulty}>
                  {difficulty === "all" ? "All levels" : formatLabel(difficulty)}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "block" }}>
            <div style={{ color: "#9ca8b7", fontSize: 13, textTransform: "uppercase", marginBottom: 8 }}>
              Muscle group
            </div>
            <select
              value={selectedMuscleGroup}
              onChange={(event) => setSelectedMuscleGroup(event.target.value)}
              style={{
                width: "100%",
                minHeight: 56,
                borderRadius: 18,
                background: "#1f1f1f",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#f5f5f5",
                padding: "0 16px",
                fontSize: 15,
              }}
            >
              <option value="all">All groups</option>
              {muscleGroups.map((group) => (
                <option key={group} value={group.toLowerCase()}>
                  {formatLabel(group)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {errorMessage ? (
        <div
          style={{
            ...panelStyle,
            background: "rgba(127,29,29,0.32)",
            color: "#fecaca",
            marginBottom: 18,
          }}
        >
          {errorMessage}
        </div>
      ) : null}

      {isLoading ? (
        <div style={panelStyle}>Loading exercise catalog...</div>
      ) : (
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          {visibleExercises.map((exercise) => {
            const tone = getDifficultyTone(exercise.difficulty.toLowerCase());

            return (
              <article
                key={exercise.id}
                style={{
                  ...panelStyle,
                  padding: 18,
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "start",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 12,
                        textTransform: "uppercase",
                        letterSpacing: "0.12em",
                        color: "#9ca8b7",
                        marginBottom: 8,
                      }}
                    >
                      {formatLabel(exercise.muscle_group)}
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1.1 }}>
                      {exercise.name}
                    </div>
                  </div>

                  <div
                    style={{
                      ...tone,
                      borderRadius: 999,
                      padding: "8px 12px",
                      fontSize: 12,
                      fontWeight: 800,
                      textTransform: "uppercase",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatLabel(exercise.difficulty)}
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      padding: 12,
                      borderRadius: 14,
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <div style={{ color: "#9ca8b7", fontSize: 12, textTransform: "uppercase", marginBottom: 6 }}>
                      Equipment
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
                      <Dumbbell size={16} color="#ff9a3d" />
                      <span>{formatLabel(exercise.equipment)}</span>
                    </div>
                  </div>

                  <div
                    style={{
                      padding: 12,
                      borderRadius: 14,
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <div style={{ color: "#9ca8b7", fontSize: 12, textTransform: "uppercase", marginBottom: 6 }}>
                      Goal tags
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
                      <Target size={16} color="#ff9a3d" />
                      <span>{exercise.goal_tags?.length ?? 0} tags</span>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    padding: 14,
                    borderRadius: 14,
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    color: "#d7dde7",
                    fontSize: 14,
                    lineHeight: 1.6,
                    minHeight: 88,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      color: "#9ca8b7",
                      fontSize: 12,
                      textTransform: "uppercase",
                      marginBottom: 8,
                    }}
                  >
                    <BadgeInfo size={15} />
                    <span>Description</span>
                  </div>
                  {exercise.description?.trim() || "No description available for this exercise yet."}
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {(exercise.goal_tags ?? []).length > 0 ? (
                    (exercise.goal_tags ?? []).map((tag) => (
                      <span
                        key={tag}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "8px 10px",
                          borderRadius: 999,
                          background: "rgba(255,122,26,0.12)",
                          border: "1px solid rgba(255,122,26,0.24)",
                          color: "#ffd7b0",
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        <Sparkles size={12} />
                        {formatLabel(tag)}
                      </span>
                    ))
                  ) : (
                    <span style={{ color: "#9ca8b7", fontSize: 13 }}>No goal tags assigned</span>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}

      {!isLoading && !errorMessage && visibleExercises.length === 0 ? (
        <div style={{ ...panelStyle, marginTop: 18, color: "#9ca8b7" }}>
          No exercises match the current filters.
        </div>
      ) : null}
    </AppShell>
  );
}
