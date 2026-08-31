/**
 * workouts.repository.js
 * Raw PostgreSQL queries for the workout domain:
 *   exercises, workout_plans, workout_days, workout_day_exercises
 *
 * No business logic — only data access.
 */

const db = require('../../config/db');

// ─── Exercise catalog ─────────────────────────────────────────────────────────

/**
 * List all exercises, optionally filtered by muscle_group and/or difficulty.
 * Used by the generator to pick exercises for a plan.
 *
 * @param {{ muscle_group?, difficulty?, limit? }} filters
 * @returns {Promise<object[]>}
 */
const findExercises = async ({ muscle_group, difficulty, limit } = {}) => {
  const conditions = [];
  const values     = [];
  let   idx        = 1;

  if (muscle_group) {
    conditions.push(`muscle_group = $${idx++}`);
    values.push(muscle_group);
  }
  if (difficulty) {
    conditions.push(`difficulty = $${idx++}`);
    values.push(difficulty);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limitClause = limit ? `LIMIT $${idx++}` : '';
  if (limit) values.push(limit);

  const { rows } = await db.query(
    `SELECT id, name, muscle_group, equipment, difficulty, description, goal_tags
     FROM exercises
     ${where}
     ORDER BY name ASC
     ${limitClause}`,
    values
  );
  return rows;
};

/**
 * Find a single exercise by ID.
 * @param {string} id
 * @returns {Promise<object|null>}
 */
const findExerciseById = async (id) => {
  const { rows } = await db.query(
    `SELECT * FROM exercises WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
};

/**
 * Find an exercise by name (for duplicate check).
 * @param {string} name
 * @returns {Promise<object|null>}
 */
const findExerciseByName = async (name) => {
  const { rows } = await db.query(
    `SELECT id FROM exercises WHERE LOWER(name) = LOWER($1)`,
    [name]
  );
  return rows[0] || null;
};

/**
 * Create a new exercise in the catalog.
 * @param {{ name, muscle_group, equipment, difficulty, description }} data
 * @returns {Promise<object>}
 */
const createExercise = async ({ name, muscle_group, equipment, difficulty, description, goal_tags }) => {
  const { rows } = await db.query(
    `INSERT INTO exercises (name, muscle_group, equipment, difficulty, description, goal_tags)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [name, muscle_group, equipment || null, difficulty, description || null, goal_tags || []]
  );
  return rows[0];
};

/**
 * Update an exercise.
 * @param {string} id
 * @param {object} fields
 * @returns {Promise<object|null>}
 */
const updateExercise = async (id, fields) => {
  const allowed    = ['name', 'muscle_group', 'equipment', 'difficulty', 'description', 'goal_tags'];
  const setClauses = [];
  const values     = [];
  let   idx        = 1;

  allowed.forEach((key) => {
    if (fields[key] !== undefined) {
      setClauses.push(`${key} = $${idx++}`);
      values.push(fields[key]);
    }
  });

  if (setClauses.length === 0) return findExerciseById(id);

  values.push(id);
  const { rows } = await db.query(
    `UPDATE exercises SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return rows[0] || null;
};

// ─── Workout plans ────────────────────────────────────────────────────────────

/**
 * Find the active workout plan for a user.
 * @param {string} userId
 * @returns {Promise<object|null>}
 */
const findActivePlan = async (userId) => {
  const { rows } = await db.query(
    `SELECT * FROM workout_plans
     WHERE user_id = $1 AND is_active = true`,
    [userId]
  );
  return rows[0] || null;
};

/**
 * Find all saved plans for a user (history).
 * @param {string} userId
 * @returns {Promise<object[]>}
 */
const findAllPlansByUser = async (userId) => {
  const { rows } = await db.query(
    `SELECT id, title, goal, fitness_level, is_active, is_customized, created_at
     FROM workout_plans
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );
  return rows;
};

/**
 * Find a plan by ID, verifying it belongs to the user.
 * @param {string} planId
 * @param {string} userId
 * @returns {Promise<object|null>}
 */
const findPlanByIdAndUser = async (planId, userId) => {
  const { rows } = await db.query(
    `SELECT * FROM workout_plans WHERE id = $1 AND user_id = $2`,
    [planId, userId]
  );
  return rows[0] || null;
};

/**
 * Create a new workout plan.
 * @param {{ user_id, title, goal, fitness_level, is_customized }} data
 * @param {import('pg').PoolClient} [client]
 * @returns {Promise<object>}
 */
const createPlan = async ({ user_id, title, goal, fitness_level, is_active, is_customized }, client) => {
  const runner = client || db;
  const { rows } = await runner.query(
    `INSERT INTO workout_plans (user_id, title, goal, fitness_level, is_active, is_customized)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [user_id, title, goal || null, fitness_level, is_active || false, is_customized || false]
  );
  return rows[0];
};

/**
 * Deactivate all existing plans for a user (only one can be active).
 * @param {string} userId
 * @param {import('pg').PoolClient} client
 */
const deactivateAllPlans = async (userId, client) => {
  await client.query(
    `UPDATE workout_plans SET is_active = false, updated_at = now()
     WHERE user_id = $1 AND is_active = true`,
    [userId]
  );
};

/**
 * Update a workout plan's title / goal / fitness_level.
 * @param {string} planId
 * @param {object} fields
 * @param {import('pg').PoolClient} [client]
 * @returns {Promise<object>}
 */
const updatePlan = async (planId, fields, client) => {
  const runner     = client || db;
  const allowed    = ['title', 'goal', 'fitness_level', 'is_active', 'is_customized'];
  const setClauses = ['updated_at = now()'];
  const values     = [];
  let   idx        = 1;

  allowed.forEach((key) => {
    if (fields[key] !== undefined) {
      setClauses.push(`${key} = $${idx++}`);
      values.push(fields[key]);
    }
  });

  values.push(planId);
  const { rows } = await runner.query(
    `UPDATE workout_plans SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return rows[0];
};

/**
 * Delete a workout plan (and cascade to days + exercises).
 * @param {string} planId
 * @returns {Promise<boolean>}
 */
const deletePlan = async (planId) => {
  const { rowCount } = await db.query(
    `DELETE FROM workout_plans WHERE id = $1`,
    [planId]
  );
  return rowCount > 0;
};

// ─── Workout days ─────────────────────────────────────────────────────────────

/**
 * Create a workout day row.
 * @param {{ workout_plan_id, day_of_week, day_label, is_rest_day }} data
 * @param {import('pg').PoolClient} client
 * @returns {Promise<object>}
 */
const createDay = async ({ workout_plan_id, day_of_week, day_label, is_rest_day }, client) => {
  const { rows } = await client.query(
    `INSERT INTO workout_days (workout_plan_id, day_of_week, day_label, is_rest_day)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [workout_plan_id, day_of_week, day_label, is_rest_day || false]
  );
  return rows[0];
};

/**
 * Update a workout day label or rest status.
 * @param {string} dayId
 * @param {{ day_label?, is_rest_day? }} fields
 * @param {import('pg').PoolClient} [client]
 * @returns {Promise<object|null>}
 */
const updateDay = async (dayId, fields, client) => {
  const runner = client || db;
  const setClauses = [];
  const values     = [];
  let   idx        = 1;

  if (fields.day_label   !== undefined) { setClauses.push(`day_label = $${idx++}`);   values.push(fields.day_label); }
  if (fields.is_rest_day !== undefined) { setClauses.push(`is_rest_day = $${idx++}`); values.push(fields.is_rest_day); }

  if (setClauses.length === 0) return null;

  values.push(dayId);
  const { rows } = await runner.query(
    `UPDATE workout_days SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return rows[0] || null;
};

// ─── Workout day exercises ────────────────────────────────────────────────────

/**
 * Replace all exercises for a specific day.
 * Deletes existing ones and inserts the new set in one transaction.
 *
 * @param {string} dayId
 * @param {Array<{ exercise_id, sets, reps, rest_seconds, notes }>} exercises
 * @param {import('pg').PoolClient} client
 */
const replaceDayExercises = async (dayId, exercises, client) => {
  // Delete existing exercises for this day
  await client.query(
    `DELETE FROM workout_day_exercises WHERE workout_day_id = $1`,
    [dayId]
  );

  if (exercises.length === 0) return [];

  // Bulk insert the new set
  const placeholders = exercises.map((_, i) => {
    const base = i * 8;
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8})`;
  });

  const values = exercises.flatMap((ex, i) => [
    dayId,
    ex.exercise_id,
    ex.sets,
    ex.reps,
    ex.rest_seconds ?? 60,
    ex.scheduled_period || null,
    ex.scheduled_time || null,
    i,              // order_index = position in array
  ]);

  const { rows } = await client.query(
    `INSERT INTO workout_day_exercises
       (workout_day_id, exercise_id, sets, reps, rest_seconds, scheduled_period, scheduled_time, order_index)
     VALUES ${placeholders.join(', ')}
     RETURNING *`,
    values
  );
  return rows;
};

// ─── Weekly schedule (the full joined query) ──────────────────────────────────

/**
 * Fetch the full weekly schedule for a plan.
 * Returns all 7 days with their exercises joined from the catalog.
 * Frontend groups by day_of_week to render the weekly view.
 *
 * @param {string} planId
 * @returns {Promise<object[]>}
 */
const findWeeklySchedule = async (planId) => {
  const { rows } = await db.query(
    `SELECT
       wd.id              AS day_id,
       wd.day_of_week,
       wd.day_label,
       wd.is_rest_day,
       wde.id             AS entry_id,
       wde.sets,
       wde.reps,
       wde.rest_seconds,
       wde.scheduled_period,
       wde.scheduled_time,
       wde.order_index,
       wde.notes,
       e.id               AS exercise_id,
       e.name             AS exercise_name,
       e.muscle_group,
       e.equipment,
       e.difficulty
     FROM workout_days wd
     LEFT JOIN workout_day_exercises wde ON wde.workout_day_id = wd.id
     LEFT JOIN exercises e               ON e.id = wde.exercise_id
     WHERE wd.workout_plan_id = $1
     ORDER BY wd.day_of_week ASC, wde.order_index ASC`,
    [planId]
  );
  return rows;
};

/**
 * Find a single workout_day by its ID and verify it belongs to the given plan.
 * @param {string} dayId
 * @param {string} planId
 * @returns {Promise<object|null>}
 */
const findDayByIdAndPlan = async (dayId, planId) => {
  const { rows } = await db.query(
    `SELECT * FROM workout_days WHERE id = $1 AND workout_plan_id = $2`,
    [dayId, planId]
  );
  return rows[0] || null;
};

module.exports = {
  findExercises,
  findExerciseById,
  findExerciseByName,
  createExercise,
  updateExercise,
  findActivePlan,
  findAllPlansByUser,
  findPlanByIdAndUser,
  createPlan,
  deactivateAllPlans,
  updatePlan,
  deletePlan,
  createDay,
  updateDay,
  replaceDayExercises,
  findWeeklySchedule,
  findDayByIdAndPlan,
};
