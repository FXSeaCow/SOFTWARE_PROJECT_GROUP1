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
  const response = await apiClient<ApiResponse<Exercise[]>>(`/workouts/exercises${suffix}`);
  return response.data;
}
