/**
 * streaks.repository.js
 * Raw PostgreSQL queries for workout streaks and workout check-ins.
 *
 * This layer intentionally contains no business rules. It only reads and
 * writes rows for the service layer to interpret.
 */

const db = require('../../config/db');

/**
 * Return either the transaction client or the shared pool.
 *
 * @param {import('pg').PoolClient|undefined} client
 * @returns {import('pg').Pool|import('pg').PoolClient}
 */
const getRunner = (client) => client || db;

/**
 * Find a user by ID.
 * Used by admin routes before creating or recalculating a streak row.
 *
 * @param {string} userId
 * @param {import('pg').PoolClient} [client]
 * @returns {Promise<object|null>}
 */
const findUserById = async (userId, client) => {
  const runner = getRunner(client);
  const { rows } = await runner.query(
    `SELECT id, email, full_name, role, created_at
     FROM users
     WHERE id = $1`,
    [userId]
  );
  return rows[0] || null;
};

/**
 * Find an active gym branch by ID.
 *
 * Standalone streak check-ins must include branch_id because the database
 * requires every workout_checkins row to belong to a branch.
 *
 * @param {string} branchId
 * @param {import('pg').PoolClient} [client]
 * @returns {Promise<object|null>}
 */
const findBranchById = async (branchId, client) => {
  const runner = getRunner(client);
  const { rows } = await runner.query(
    `SELECT id, name, capacity, is_active
     FROM gym_branches
     WHERE id = $1
       AND is_active = true`,
    [branchId]
  );
  return rows[0] || null;
};

/**
 * Find the streak row for a user.
 *
 * @param {string} userId
 * @param {import('pg').PoolClient} [client]
 * @returns {Promise<object|null>}
 */
const findStreakByUserId = async (userId, client) => {
  const runner = getRunner(client);
  const { rows } = await runner.query(
    `SELECT id,
            user_id,
            current_streak::INT AS current_streak,
            longest_streak::INT AS longest_streak,
            last_active_date::TEXT AS last_active_date,
            updated_at
     FROM workout_streaks
     WHERE user_id = $1`,
    [userId]
  );
  return rows[0] || null;
};

/**
 * Create the default streak row for a user.
 * Registration normally does this, but this function repairs missing rows.
 *
 * @param {string} userId
 * @param {import('pg').PoolClient} [client]
 * @returns {Promise<object>}
 */
const createStreakRecord = async (userId, client) => {
  const runner = getRunner(client);
  const { rows } = await runner.query(
    `INSERT INTO workout_streaks (user_id)
     VALUES ($1)
     ON CONFLICT (user_id) DO UPDATE SET updated_at = workout_streaks.updated_at
     RETURNING id,
               user_id,
               current_streak::INT AS current_streak,
               longest_streak::INT AS longest_streak,
               last_active_date::TEXT AS last_active_date,
               updated_at`,
    [userId]
  );
  return rows[0];
};

/**
 * Update a user's streak counters.
 *
 * @param {string} userId
 * @param {{ current_streak: number, longest_streak: number, last_active_date: string|null }} fields
 * @param {import('pg').PoolClient} [client]
 * @returns {Promise<object>}
 */
const updateStreak = async (userId, fields, client) => {
  const runner = getRunner(client);
  const { rows } = await runner.query(
    `UPDATE workout_streaks
     SET current_streak = $1,
         longest_streak = $2,
         last_active_date = $3,
         updated_at = now()
     WHERE user_id = $4
     RETURNING id,
               user_id,
               current_streak::INT AS current_streak,
               longest_streak::INT AS longest_streak,
               last_active_date::TEXT AS last_active_date,
               updated_at`,
    [
      fields.current_streak,
      fields.longest_streak,
      fields.last_active_date,
      userId,
    ]
  );
  return rows[0];
};

/**
 * Find a check-in for one user on one date.
 *
 * @param {string} userId
 * @param {string} checkinDate - YYYY-MM-DD
 * @param {import('pg').PoolClient} [client]
 * @returns {Promise<object|null>}
 */
const findCheckinByUserAndDate = async (userId, checkinDate, client) => {
  const runner = getRunner(client);
  const { rows } = await runner.query(
    `SELECT wc.id,
            wc.user_id,
            wc.branch_id,
            gb.name AS branch_name,
            wc.checkin_date::TEXT AS checkin_date,
            wc.checked_in_at,
            wc.counted_for_streak
     FROM workout_checkins wc
     JOIN gym_branches gb ON gb.id = wc.branch_id
     WHERE wc.user_id = $1
       AND wc.checkin_date = $2`,
    [userId, checkinDate]
  );
  return rows[0] || null;
};

/**
 * Insert a workout check-in for one calendar date.
 *
 * @param {string} userId
 * @param {string} branchId
 * @param {string} checkinDate - YYYY-MM-DD
 * @param {Date} checkedInAt
 * @param {import('pg').PoolClient} [client]
 * @returns {Promise<object>}
 */
const createCheckin = async (userId, branchId, checkinDate, checkedInAt, client) => {
  const runner = getRunner(client);
  const { rows } = await runner.query(
    `INSERT INTO workout_checkins (user_id, branch_id, checkin_date, checked_in_at)
     VALUES ($1, $2, $3, $4)
     RETURNING id,
               user_id,
               branch_id,
               checkin_date::TEXT AS checkin_date,
               checked_in_at,
               counted_for_streak`,
    [userId, branchId, checkinDate, checkedInAt]
  );
  return rows[0];
};

/**
 * Build aliased check-in filters.
 *
 * @param {string} userId
 * @param {object} filters
 * @param {string} alias
 * @returns {{ where: string, values: Array, nextIndex: number }}
 */
const buildCheckinFilters = (userId, filters = {}, alias = 'wc') => {
  const column = (name) => `${alias}.${name}`;
  const conditions = [`${column('user_id')} = $1`];
  const values = [userId];
  let idx = 2;

  if (filters.countedOnly) {
    conditions.push(`${column('counted_for_streak')} = true`);
  }

  if (filters.branch_id) {
    conditions.push(`${column('branch_id')} = $${idx++}`);
    values.push(filters.branch_id);
  }

  if (filters.from_date) {
    conditions.push(`${column('checkin_date')} >= $${idx++}::date`);
    values.push(filters.from_date);
  }

  if (filters.to_date) {
    conditions.push(`${column('checkin_date')} <= $${idx++}::date`);
    values.push(filters.to_date);
  }

  return {
    where: conditions.join(' AND '),
    values,
    nextIndex: idx,
  };
};

/**
 * Count a user's streak-counted check-ins, optionally inside a date range.
 *
 * @param {string} userId
 * @param {{ branch_id?: string, from_date?: string, to_date?: string }} filters
 * @param {import('pg').PoolClient} [client]
 * @returns {Promise<number>}
 */
const countCheckinsByUser = async (userId, filters = {}, client) => {
  const runner = getRunner(client);
  const { where, values } = buildCheckinFilters(
    userId,
    { ...filters, countedOnly: true },
    'wc'
  );

  const { rows } = await runner.query(
    `SELECT COUNT(*)::INT AS total
     FROM workout_checkins wc
     WHERE ${where}`,
    values
  );
  return rows[0].total;
};

/**
 * List a user's check-ins with pagination and optional date filters.
 *
 * @param {string} userId
 * @param {{ limit: number, offset: number, branch_id?: string, from_date?: string, to_date?: string }} opts
 * @returns {Promise<{ rows: object[], total: number }>}
 */
const findCheckinsByUser = async (userId, opts) => {
  const { where, values, nextIndex } = buildCheckinFilters(userId, opts, 'wc');

  const countResult = await db.query(
    `SELECT COUNT(*)::INT AS total
     FROM workout_checkins wc
     WHERE ${where}`,
    values
  );

  const { rows } = await db.query(
    `SELECT wc.id,
            wc.user_id,
            wc.branch_id,
            gb.name AS branch_name,
            wc.checkin_date::TEXT AS checkin_date,
            wc.checked_in_at,
            wc.counted_for_streak
     FROM workout_checkins wc
     JOIN gym_branches gb ON gb.id = wc.branch_id
     WHERE ${where}
     ORDER BY wc.checkin_date DESC, wc.checked_in_at DESC
     LIMIT $${nextIndex} OFFSET $${nextIndex + 1}`,
    [...values, opts.limit, opts.offset]
  );

  return {
    rows,
    total: countResult.rows[0].total,
  };
};

/**
 * Return all distinct check-in dates for a user in ascending order.
 * Used by the service to recalculate current and longest streaks.
 *
 * @param {string} userId
 * @param {import('pg').PoolClient} [client]
 * @returns {Promise<string[]>}
 */
const findCheckinDatesByUser = async (userId, client) => {
  const runner = getRunner(client);
  const { rows } = await runner.query(
    `SELECT DISTINCT checkin_date::TEXT AS checkin_date
     FROM workout_checkins
     WHERE user_id = $1
       AND counted_for_streak = true
     ORDER BY checkin_date ASC`,
    [userId]
  );
  return rows.map((row) => row.checkin_date);
};

/**
 * List top streaks for a leaderboard.
 *
 * @param {{ limit: number }} opts
 * @returns {Promise<object[]>}
 */
const findLeaderboard = async ({ limit }) => {
  const { rows } = await db.query(
    `SELECT ws.user_id,
            u.full_name,
            u.email,
            ws.current_streak::INT AS current_streak,
            ws.longest_streak::INT AS longest_streak,
            ws.last_active_date::TEXT AS last_active_date
     FROM workout_streaks ws
     JOIN users u ON u.id = ws.user_id
     ORDER BY ws.current_streak DESC,
              ws.longest_streak DESC,
              ws.last_active_date DESC NULLS LAST
     LIMIT $1`,
    [limit]
  );
  return rows;
};

module.exports = {
  findUserById,
  findBranchById,
  findStreakByUserId,
  createStreakRecord,
  updateStreak,
  findCheckinByUserAndDate,
  createCheckin,
  countCheckinsByUser,
  findCheckinsByUser,
  findCheckinDatesByUser,
  findLeaderboard,
};
