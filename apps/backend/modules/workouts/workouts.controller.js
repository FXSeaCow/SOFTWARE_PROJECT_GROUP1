/**
 * workouts.controller.js
 * HTTP layer for workout plan operations.
 * Parses req, calls service, sends res. Zero business logic.
 */

const service      = require('./workouts.service');
const asyncHandler = require('../../utils/Asynchandler');
const ApiResponse  = require('../../utils/Apiresponse');

// ─── Exercise catalog ─────────────────────────────────────────────────────────

/**
 * GET /api/workouts/exercises
 * List exercises with optional filters (?muscle_group=chest&difficulty=beginner).
 */
const listExercises = asyncHandler(async (req, res) => {
  const { muscle_group, difficulty } = req.query;
  const exercises = await service.listExercises({ muscle_group, difficulty });
  res.json(ApiResponse.success(exercises));
});

/**
 * GET /api/workouts/exercises/:exerciseId
 * Get a single exercise by ID.
 */
const getExerciseById = asyncHandler(async (req, res) => {
  const exercise = await service.getExerciseById(req.params.exerciseId);
  res.json(ApiResponse.success(exercise));
});

/**
 * POST /api/workouts/admin/exercises
 * Admin adds a new exercise to the catalog.
 */
const createExercise = asyncHandler(async (req, res) => {
  const exercise = await service.createExercise(req.body);
  res.status(201).json(ApiResponse.created(exercise, 'Exercise added to catalog'));
});

/**
 * PATCH /api/workouts/admin/exercises/:exerciseId
 * Admin updates an exercise.
 */
const updateExercise = asyncHandler(async (req, res) => {
  const exercise = await service.updateExercise(req.params.exerciseId, req.body);
  res.json(ApiResponse.success(exercise, 'Exercise updated'));
});

// ─── Goal resolver (Gemini NLP) ───────────────────────────────────────────────

/**
 * POST /api/workouts/resolve-goal
 * Member types anything like "I want to lose belly fat" and gets back
 * a structured goal classification.
 *
 * Response shapes:
 *
 *   Fitness-related, high confidence:
 *     { success: true, data: { goal: 'weight_loss', confidence: 'high', ... } }
 *
 *   Not fitness-related:
 *     { success: false, message: '<friendly redirect from Gemini>', data: { ... } }
 *
 *   Gemini unavailable (fallback):
 *     { success: true, data: { goal: 'general_fitness', fallback: true, ... } }
 */
const resolveGoal = asyncHandler(async (req, res) => {
  const result = await service.resolveGoal(req.body.text);

  if (!result.is_fitness_related) {
    // Return 400 so the frontend knows to show the redirect_message
    // instead of proceeding to plan generation
    return res.status(400).json({
      success: false,
      message: result.redirect_message,
      data:    result,
    });
  }

  res.json(ApiResponse.success(result, 'Goal resolved successfully'));
});

// ─── Workout plans ────────────────────────────────────────────────────────────

/**
 * POST /api/workouts/generate  (FR-07)
 * Generate a complete weekly workout plan based on goal + fitness level.
 */
const generatePlan = asyncHandler(async (req, res) => {
  const { title, goal, fitness_level, days_per_week, preferred_slots } = req.body;
  const result = await service.generatePlan(req.user.id, {
    title, goal, fitness_level, days_per_week, preferred_slots,
  });
  res.status(201).json(ApiResponse.created(result, 'Workout plan generated'));
});

/**
 * POST /api/workouts  (FR-09)
 * Create a blank custom plan for manual filling.
 */
const createCustomPlan = asyncHandler(async (req, res) => {
  const result = await service.createCustomPlan(req.user.id, req.body);
  res.status(201).json(ApiResponse.created(result, 'Custom workout plan created'));
});

/**
 * GET /api/workouts/active  (FR-07, FR-09)
 * Get the active plan's full weekly schedule.
 */
const getActiveSchedule = asyncHandler(async (req, res) => {
  const result = await service.getActiveSchedule(req.user.id);
  res.json(ApiResponse.success(result));
});

/**
 * GET /api/workouts
 * List all saved plans (lightweight, no exercises).
 */
const listMyPlans = asyncHandler(async (req, res) => {
  const plans = await service.listMyPlans(req.user.id);
  res.json(ApiResponse.success(plans));
});

/**
 * GET /api/workouts/:planId
 * Get a specific plan's full weekly schedule.
 */
const getPlanSchedule = asyncHandler(async (req, res) => {
  const result = await service.getPlanSchedule(req.params.planId, req.user.id);
  res.json(ApiResponse.success(result));
});

/**
 * PATCH /api/workouts/:planId  (FR-08)
 * Update plan metadata (title, goal, fitness_level).
 */
const updatePlan = asyncHandler(async (req, res) => {
  const updated = await service.updatePlan(req.params.planId, req.user.id, req.body);
  res.json(ApiResponse.success(updated, 'Workout plan updated'));
});

/**
 * POST /api/workouts/:planId/activate
 * Make a previously saved plan the current active one.
 */
const activatePlan = asyncHandler(async (req, res) => {
  const plan = await service.activatePlan(req.params.planId, req.user.id);
  res.json(ApiResponse.success(plan, 'Workout plan activated'));
});

/**
 * DELETE /api/workouts/:planId
 * Delete a saved workout plan (cannot delete the active one).
 */
const deletePlan = asyncHandler(async (req, res) => {
  await service.deletePlan(req.params.planId, req.user.id);
  res.json(ApiResponse.success(null, 'Workout plan deleted'));
});

/**
 * PATCH /api/workouts/:planId/days/:dayId  (FR-08)
 * Update a day's label or rest status.
 */
const updateDay = asyncHandler(async (req, res) => {
  const updated = await service.updateDay(
    req.params.planId,
    req.params.dayId,
    req.user.id,
    req.body
  );
  res.json(ApiResponse.success(updated, 'Day updated'));
});

/**
 * PUT /api/workouts/:planId/days/:dayId/exercises  (FR-08)
 * Replace all exercises for a specific day.
 */
const setDayExercises = asyncHandler(async (req, res) => {
  const exercises = await service.setDayExercises(
    req.params.planId,
    req.params.dayId,
    req.user.id,
    req.body.exercises
  );
  res.json(ApiResponse.success(exercises, 'Exercises updated'));
});

module.exports = {
  listExercises,
  getExerciseById,
  createExercise,
  updateExercise,
  resolveGoal,
  generatePlan,
  createCustomPlan,
  getActiveSchedule,
  listMyPlans,
  getPlanSchedule,
  updatePlan,
  activatePlan,
  deletePlan,
  updateDay,
  setDayExercises,
};