/**
 * workouts.service.js
 * Business logic for the workout plan domain.
 *
 * FR-07  generate workout plans based on user goals and fitness levels
 * FR-08  members customize generated workout plans
 * FR-09  system stores workout plans for future use
 */

const repo                = require('./workouts.repository');
const { buildWeeklyPlan,
        resolveGoalFromText,
        classifyGoalLocally } = require('./workouts.generator');
const { withTransaction } = require('../../utils/Transaction');
const ApiError            = require('../../utils/Apierror');
const logger              = require('../../utils/Logger');

// ─── Exercise catalog ─────────────────────────────────────────────────────────

/**
 * List exercises, optionally filtered by muscle_group and/or difficulty.
 * @param {{ muscle_group?, difficulty? }} filters
 * @returns {Promise<object[]>}
 */
const listExercises = async (filters = {}) => {
  return repo.findExercises(filters);
};

/**
 * Get a single exercise by ID.
 * @param {string} exerciseId
 * @returns {Promise<object>}
 */
const getExerciseById = async (exerciseId) => {
  const ex = await repo.findExerciseById(exerciseId);
  if (!ex) throw ApiError.notFound('Exercise');
  return ex;
};

/**
 * Admin: add a new exercise to the catalog.
 * @param {object} data
 * @returns {Promise<object>}
 */
const createExercise = async (data) => {
  const existing = await repo.findExerciseByName(data.name);
  if (existing) throw ApiError.conflict(`Exercise "${data.name}" already exists`);

  const exercise = await repo.createExercise(data);
  logger.info('Exercise created', { exerciseId: exercise.id, name: exercise.name });
  return exercise;
};

/**
 * Admin: update an exercise in the catalog.
 * @param {string} exerciseId
 * @param {object} fields
 * @returns {Promise<object>}
 */
const updateExercise = async (exerciseId, fields) => {
  const existing = await repo.findExerciseById(exerciseId);
  if (!existing) throw ApiError.notFound('Exercise');

  // Check for name conflict if name is being changed
  if (fields.name && fields.name.toLowerCase() !== existing.name.toLowerCase()) {
    const nameConflict = await repo.findExerciseByName(fields.name);
    if (nameConflict) throw ApiError.conflict(`Exercise "${fields.name}" already exists`);
  }

  return repo.updateExercise(exerciseId, fields);
};

// ─── FR-07 helper: Resolve natural language → goal ────────────────────────────

/**
 * Resolve a member's free-text goal description into a structured goal key.
 * Delegates to Gemini via resolveGoalFromText().
 *
 * The caller (controller) should:
 *   - If is_fitness_related = false → return 400 with redirect_message to member
 *   - If is_fitness_related = true  → pass goal into generatePlan or createCustomPlan
 *   - If fallback = true            → optionally show "AI unavailable" notice
 *
 * @param {string} userText  - raw text typed by the member
 * @returns {Promise<object>} - see resolveGoalFromText JSDoc for shape
 */
const resolveGoal = async (userText) => {
  return resolveGoalFromText(userText);
};

// ─── FR-07: Generate a workout plan ──────────────────────────────────────────

/**
 * Generate a complete weekly workout plan for a member.
 *
 * Steps:
 *   1. Fetch exercises from DB filtered by fitness_level (difficulty)
 *   2. Build a 7-day schedule using the generator
 *   3. Inside one transaction:
 *      a. Deactivate any existing active plan
 *      b. Create the new plan
 *      c. Insert 7 workout_days rows
 *      d. Insert workout_day_exercises for each non-rest day
 *
 * @param {string} userId
 * @param {{ title, goal, fitness_level, days_per_week, preferred_slots?, focus_muscle_groups?, source_text? }} data
 * @returns {Promise<{ plan: object, schedule: object[] }>}
 */
const generatePlan = async (userId, {
  title,
  goal,
  fitness_level,
  days_per_week,
  preferred_slots,
  focus_muscle_groups,
  source_text,
}) => {
  let resolvedFocusGroups = focus_muscle_groups;

  if (source_text && source_text.trim()) {
    const localIntent = classifyGoalLocally(source_text);

    if (!localIntent.is_fitness_related) {
      throw ApiError.badRequest(localIntent.redirect_message);
    }

    if (!resolvedFocusGroups?.length && localIntent.focus_muscle_groups?.length) {
      resolvedFocusGroups = localIntent.focus_muscle_groups;
    }
  }

  // 1. Fetch exercises matching the member's fitness level
  const catalog = await repo.findExercises({ difficulty: fitness_level });

  if (catalog.length < 5) {
    throw ApiError.badRequest(
      `Not enough exercises in the catalog for difficulty "${fitness_level}". ` +
      'Please ask an admin to add more exercises.'
    );
  }

  // 2. Build the 7-day schedule (pure logic, no DB calls)
  const weeklyPlan = buildWeeklyPlan({
    goal,
    fitness_level,
    days_per_week,
    exerciseCatalog: catalog,
    preferredSlots:  preferred_slots,
    focus_muscle_groups: resolvedFocusGroups,
  });

  // 3. Persist everything atomically
  const { plan, schedule } = await withTransaction(async (client) => {
    // a. Deactivate the current active plan (enforces one active plan per user)
    await repo.deactivateAllPlans(userId, client);

    // b. Create the new plan
    const newPlan = await repo.createPlan(
      { user_id: userId, title, goal, fitness_level, is_active: true, is_customized: false },
      client
    );

    // c & d. Create days + exercises
    const insertedDays = [];
    for (const dayData of weeklyPlan) {
      const day = await repo.createDay(
        {
          workout_plan_id: newPlan.id,
          day_of_week:     dayData.day_of_week,
          day_label:       dayData.day_label,
          is_rest_day:     dayData.is_rest_day,
        },
        client
      );

      if (!dayData.is_rest_day && dayData.exercises.length > 0) {
        await repo.replaceDayExercises(day.id, dayData.exercises, client);
      }

      insertedDays.push({ ...day, exercises: dayData.exercises });
    }

    return { plan: newPlan, schedule: insertedDays };
  });

  logger.info('Workout plan generated', {
    userId,
    planId:       plan.id,
    goal,
    fitness_level,
    days_per_week,
  });

  return { plan, schedule };
};

// ─── FR-09: Store / retrieve plans ───────────────────────────────────────────

/**
 * Get the active plan's full weekly schedule (FR-07, FR-09).
 * Returns a grouped structure: one object per day with its exercises.
 *
 * @param {string} userId
 * @returns {Promise<{ plan: object, schedule: object[] }>}
 */
const getActiveSchedule = async (userId) => {
  const plan = await repo.findActivePlan(userId);
  if (!plan) {
    throw new ApiError(404, 'No active workout plan found. Generate or activate one first.');
  }

  const rows     = await repo.findWeeklySchedule(plan.id);
  const schedule = groupScheduleByDay(rows);

  return { plan, schedule };
};

/**
 * List all saved plans for a user (without exercises — lightweight).
 * @param {string} userId
 * @returns {Promise<object[]>}
 */
const listMyPlans = async (userId) => {
  return repo.findAllPlansByUser(userId);
};

/**
 * Get a specific plan's full schedule by plan ID.
 * Verifies the plan belongs to the requesting user.
 *
 * @param {string} planId
 * @param {string} userId
 * @returns {Promise<{ plan: object, schedule: object[] }>}
 */
const getPlanSchedule = async (planId, userId) => {
  const plan = await repo.findPlanByIdAndUser(planId, userId);
  if (!plan) throw ApiError.notFound('Workout plan');

  const rows     = await repo.findWeeklySchedule(plan.id);
  const schedule = groupScheduleByDay(rows);

  return { plan, schedule };
};

/**
 * Create a blank custom plan (no auto-generated exercises).
 * Member fills it in manually via PATCH day exercises (FR-08).
 *
 * @param {string} userId
 * @param {{ title, goal, fitness_level }} data
 * @returns {Promise<{ plan: object, schedule: object[] }>}
 */
const createCustomPlan = async (userId, { title, goal, fitness_level }) => {
  const { plan, schedule } = await withTransaction(async (client) => {
    await repo.deactivateAllPlans(userId, client);

    const newPlan = await repo.createPlan(
      { user_id: userId, title, goal, fitness_level, is_active: true, is_customized: true },
      client
    );

    // Create 7 empty rest days — member fills them in
    const days = [];
    const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    for (let dow = 1; dow <= 7; dow++) {
      const day = await repo.createDay(
        {
          workout_plan_id: newPlan.id,
          day_of_week:     dow,
          day_label:       DAY_NAMES[dow - 1],
          is_rest_day:     true,
        },
        client
      );
      days.push({ ...day, exercises: [] });
    }

    return { plan: newPlan, schedule: days };
  });

  logger.info('Custom workout plan created', { userId, planId: plan.id });
  return { plan, schedule };
};

// ─── FR-08: Customize plans ───────────────────────────────────────────────────

/**
 * Update a plan's metadata (title, goal, fitness_level).
 *
 * @param {string} planId
 * @param {string} userId
 * @param {object} fields
 * @returns {Promise<object>}
 */
const updatePlan = async (planId, userId, fields) => {
  const plan = await repo.findPlanByIdAndUser(planId, userId);
  if (!plan) throw ApiError.notFound('Workout plan');

  const updated = await repo.updatePlan(planId, { ...fields, is_customized: true });
  logger.info('Workout plan updated', { planId, userId });
  return updated;
};

/**
 * Activate a previously saved plan (makes it the current active one).
 *
 * @param {string} planId
 * @param {string} userId
 * @returns {Promise<object>}
 */
const activatePlan = async (planId, userId) => {
  const plan = await repo.findPlanByIdAndUser(planId, userId);
  if (!plan) throw ApiError.notFound('Workout plan');
  if (plan.is_active) throw ApiError.conflict('This plan is already active');

  const activated = await withTransaction(async (client) => {
    await repo.deactivateAllPlans(userId, client);
    return repo.updatePlan(planId, { is_active: true }, client);
  });

  logger.info('Workout plan activated', { planId, userId });
  return activated;
};

/**
 * Delete a workout plan.
 * Cannot delete the active plan — must deactivate/activate another first.
 *
 * @param {string} planId
 * @param {string} userId
 */
const deletePlan = async (planId, userId) => {
  const plan = await repo.findPlanByIdAndUser(planId, userId);
  if (!plan) throw ApiError.notFound('Workout plan');
  if (plan.is_active) {
    throw ApiError.badRequest(
      'Cannot delete the active plan. Please activate another plan first.'
    );
  }

  await repo.deletePlan(planId);
  logger.info('Workout plan deleted', { planId, userId });
};

/**
 * Update a specific day's label and/or rest status.
 *
 * @param {string} planId
 * @param {string} dayId
 * @param {string} userId
 * @param {{ day_label?, is_rest_day? }} fields
 * @returns {Promise<object>}
 */
const updateDay = async (planId, dayId, userId, fields) => {
  const plan = await repo.findPlanByIdAndUser(planId, userId);
  if (!plan) throw ApiError.notFound('Workout plan user');

  const day = await repo.findDayByIdAndPlan(dayId, planId);
  if (!day) throw ApiError.notFound('Workout day plan');

  const updated = await repo.updateDay(dayId, fields);

  // Mark plan as customized
  await repo.updatePlan(planId, { is_customized: true });

  return updated;
};

/**
 * Replace all exercises for a specific day (FR-08).
 * The exercises array is ordered — position becomes order_index.
 *
 * @param {string} planId
 * @param {string} dayId
 * @param {string} userId
 * @param {Array}  exercises
 * @returns {Promise<object[]>}
 */
const setDayExercises = async (planId, dayId, userId, exercises) => {
  const plan = await repo.findPlanByIdAndUser(planId, userId);
  if (!plan) throw ApiError.notFound('Workout plan');

  const day = await repo.findDayByIdAndPlan(dayId, planId);
  if (!day) throw ApiError.notFound('Workout day');

  // Validate all exercise IDs exist in the catalog
  for (const ex of exercises) {
    const found = await repo.findExerciseById(ex.exercise_id);
    if (!found) {
      throw ApiError.badRequest(`Exercise ID "${ex.exercise_id}" not found in catalog`);
    }
  }

  const inserted = await withTransaction(async (client) => {
    const rows = await repo.replaceDayExercises(dayId, exercises, client);
    await repo.updateDay(dayId, { is_rest_day: rows.length === 0 }, client);
    await repo.updatePlan(planId, { is_customized: true }, client);
    return rows;
  });

  logger.info('Day exercises updated', { planId, dayId, userId, count: inserted.length });
  return inserted;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Group flat SQL rows (one row per exercise) into a nested
 * array of day objects, each with an exercises array.
 *
 * @param {object[]} rows  — from findWeeklySchedule()
 * @returns {object[]}
 */
const groupScheduleByDay = (rows) => {
  const dayMap = new Map();

  rows.forEach((row) => {
    if (!dayMap.has(row.day_of_week)) {
      dayMap.set(row.day_of_week, {
        day_id:      row.day_id,
        day_of_week: row.day_of_week,
        day_label:   row.day_label,
        is_rest_day: row.is_rest_day,
        exercises:   [],
      });
    }

    // LEFT JOIN means rest days return a row with null exercise data
    if (row.exercise_id) {
      dayMap.get(row.day_of_week).exercises.push({
        entry_id:      row.entry_id,
        exercise_id:   row.exercise_id,
        exercise_name: row.exercise_name,
        muscle_group:  row.muscle_group,
        equipment:     row.equipment,
        difficulty:    row.difficulty,
        sets:          row.sets,
        reps:          row.reps,
        rest_seconds:  row.rest_seconds,
        scheduled_period: row.scheduled_period,
        scheduled_time:   row.scheduled_time,
        order_index:   row.order_index,
        notes:         row.notes,
      });
    }
  });

  // Return sorted by day_of_week (Mon → Sun)
  return Array.from(dayMap.values()).sort((a, b) => a.day_of_week - b.day_of_week);
};

module.exports = {
  listExercises,
  getExerciseById,
  createExercise,
  updateExercise,
  resolveGoal,
  generatePlan,
  getActiveSchedule,
  listMyPlans,
  getPlanSchedule,
  createCustomPlan,
  updatePlan,
  activatePlan,
  deletePlan,
  updateDay,
  setDayExercises,
};
