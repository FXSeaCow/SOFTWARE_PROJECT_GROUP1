import { apiClient } from "./apiClient";

type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
};

export type Exercise = {
  id: string;
  name: string;
  muscle_group: string;
  equipment?: string | null;
  difficulty: "beginner" | "intermediate" | "advanced" | string;
  description?: string | null;
  goal_tags?: string[] | null;
};

const fallbackExercises: Exercise[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    name: "Push Up",
    muscle_group: "chest",
    equipment: "bodyweight",
    difficulty: "beginner",
    description: "Builds chest, shoulders, and triceps with no equipment.",
    goal_tags: ["strength", "muscle_gain"],
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    name: "Dumbbell Bench Press",
    muscle_group: "chest",
    equipment: "dumbbells",
    difficulty: "intermediate",
    description: "Pressing movement for chest strength and control.",
    goal_tags: ["strength", "muscle_gain"],
  },
  {
    id: "00000000-0000-4000-8000-000000000003",
    name: "Incline Barbell Press",
    muscle_group: "chest",
    equipment: "barbell",
    difficulty: "advanced",
    description: "Upper-chest compound lift for heavier training days.",
    goal_tags: ["strength", "muscle_gain"],
  },
  {
    id: "00000000-0000-4000-8000-000000000004",
    name: "Lat Pulldown",
    muscle_group: "back",
    equipment: "cable machine",
    difficulty: "beginner",
    description: "Develops lats and upper-back pulling strength.",
    goal_tags: ["strength", "posture"],
  },
  {
    id: "00000000-0000-4000-8000-000000000005",
    name: "Seated Cable Row",
    muscle_group: "back",
    equipment: "cable machine",
    difficulty: "intermediate",
    description: "Horizontal pull for mid-back thickness and posture.",
    goal_tags: ["strength", "posture"],
  },
  {
    id: "00000000-0000-4000-8000-000000000006",
    name: "Pull Up",
    muscle_group: "back",
    equipment: "pull-up bar",
    difficulty: "advanced",
    description: "Bodyweight pull for back and arm strength.",
    goal_tags: ["strength", "muscle_gain"],
  },
  {
    id: "00000000-0000-4000-8000-000000000007",
    name: "Bodyweight Squat",
    muscle_group: "legs",
    equipment: "bodyweight",
    difficulty: "beginner",
    description: "Teaches squat pattern and lower-body control.",
    goal_tags: ["strength", "weight_loss"],
  },
  {
    id: "00000000-0000-4000-8000-000000000008",
    name: "Goblet Squat",
    muscle_group: "legs",
    equipment: "dumbbell",
    difficulty: "intermediate",
    description: "Loaded squat variation for quads and glutes.",
    goal_tags: ["strength", "muscle_gain"],
  },
  {
    id: "00000000-0000-4000-8000-000000000009",
    name: "Barbell Back Squat",
    muscle_group: "legs",
    equipment: "barbell",
    difficulty: "advanced",
    description: "Heavy compound lift for complete leg strength.",
    goal_tags: ["strength", "muscle_gain"],
  },
  {
    id: "00000000-0000-4000-8000-000000000010",
    name: "Dumbbell Shoulder Press",
    muscle_group: "shoulders",
    equipment: "dumbbells",
    difficulty: "beginner",
    description: "Overhead press for shoulder strength.",
    goal_tags: ["strength", "muscle_gain"],
  },
  {
    id: "00000000-0000-4000-8000-000000000011",
    name: "Lateral Raise",
    muscle_group: "shoulders",
    equipment: "dumbbells",
    difficulty: "intermediate",
    description: "Isolation movement for side delts.",
    goal_tags: ["muscle_gain", "toning"],
  },
  {
    id: "00000000-0000-4000-8000-000000000012",
    name: "Arnold Press",
    muscle_group: "shoulders",
    equipment: "dumbbells",
    difficulty: "advanced",
    description: "Rotational shoulder press for advanced control.",
    goal_tags: ["strength", "muscle_gain"],
  },
  {
    id: "00000000-0000-4000-8000-000000000013",
    name: "Biceps Curl",
    muscle_group: "arms",
    equipment: "dumbbells",
    difficulty: "beginner",
    description: "Simple curl for biceps strength.",
    goal_tags: ["muscle_gain", "toning"],
  },
  {
    id: "00000000-0000-4000-8000-000000000014",
    name: "Triceps Rope Pushdown",
    muscle_group: "arms",
    equipment: "cable machine",
    difficulty: "intermediate",
    description: "Cable isolation for triceps volume.",
    goal_tags: ["muscle_gain", "toning"],
  },
  {
    id: "00000000-0000-4000-8000-000000000015",
    name: "Close-Grip Bench Press",
    muscle_group: "arms",
    equipment: "barbell",
    difficulty: "advanced",
    description: "Compound triceps-focused press.",
    goal_tags: ["strength", "muscle_gain"],
  },
  {
    id: "00000000-0000-4000-8000-000000000016",
    name: "Plank",
    muscle_group: "core",
    equipment: "bodyweight",
    difficulty: "beginner",
    description: "Core stability hold for trunk control.",
    goal_tags: ["core", "stability"],
  },
  {
    id: "00000000-0000-4000-8000-000000000017",
    name: "Cable Woodchop",
    muscle_group: "core",
    equipment: "cable machine",
    difficulty: "intermediate",
    description: "Rotational core exercise for control.",
    goal_tags: ["core", "stability"],
  },
  {
    id: "00000000-0000-4000-8000-000000000018",
    name: "Hanging Leg Raise",
    muscle_group: "core",
    equipment: "pull-up bar",
    difficulty: "advanced",
    description: "Advanced core flexion exercise.",
    goal_tags: ["core", "strength"],
  },
  {
    id: "00000000-0000-4000-8000-000000000019",
    name: "Treadmill Walk",
    muscle_group: "cardio",
    equipment: "treadmill",
    difficulty: "beginner",
    description: "Low-impact cardio for endurance and calorie burn.",
    goal_tags: ["weight_loss", "endurance"],
  },
  {
    id: "00000000-0000-4000-8000-000000000020",
    name: "Rowing Machine Intervals",
    muscle_group: "cardio",
    equipment: "rowing machine",
    difficulty: "intermediate",
    description: "Full-body cardio intervals.",
    goal_tags: ["weight_loss", "endurance"],
  },
  {
    id: "00000000-0000-4000-8000-000000000021",
    name: "Assault Bike Sprint",
    muscle_group: "cardio",
    equipment: "assault bike",
    difficulty: "advanced",
    description: "High-intensity conditioning sprint.",
    goal_tags: ["weight_loss", "endurance"],
  },
  {
    id: "00000000-0000-4000-8000-000000000022",
    name: "Step Up",
    muscle_group: "full_body",
    equipment: "box",
    difficulty: "beginner",
    description: "Simple full-body movement focused on legs and balance.",
    goal_tags: ["weight_loss", "stability"],
  },
  {
    id: "00000000-0000-4000-8000-000000000023",
    name: "Kettlebell Swing",
    muscle_group: "full_body",
    equipment: "kettlebell",
    difficulty: "intermediate",
    description: "Power movement for hips, core, and conditioning.",
    goal_tags: ["power", "weight_loss"],
  },
  {
    id: "00000000-0000-4000-8000-000000000024",
    name: "Burpee",
    muscle_group: "full_body",
    equipment: "bodyweight",
    difficulty: "advanced",
    description: "High-effort full-body conditioning exercise.",
    goal_tags: ["weight_loss", "endurance"],
  },
];

function filterExercises(exercises: Exercise[], filters: { muscleGroup?: string; difficulty?: string }) {
  return exercises.filter((exercise) => {
    if (filters.muscleGroup && exercise.muscle_group !== filters.muscleGroup) {
      return false;
    }

    if (filters.difficulty && exercise.difficulty !== filters.difficulty) {
      return false;
    }

    return true;
  });
}

export async function getExercises(filters: {
  muscleGroup?: string;
  difficulty?: string;
} = {}): Promise<Exercise[]> {
  const query = new URLSearchParams();

  if (filters.muscleGroup) {
    query.set("muscle_group", filters.muscleGroup);
  }

  if (filters.difficulty) {
    query.set("difficulty", filters.difficulty);
  }

  const suffix = query.toString() ? `?${query.toString()}` : "";
  try {
    const response = await apiClient<ApiResponse<Exercise[]>>(`/workouts/exercises${suffix}`);
    return response.data.length > 0 ? response.data : filterExercises(fallbackExercises, filters);
  } catch {
    return filterExercises(fallbackExercises, filters);
  }
}
