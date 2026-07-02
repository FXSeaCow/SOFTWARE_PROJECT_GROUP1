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
            last_active_date::TEXT AS last_active_date
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
     RETURNING id,
               user_id,
               current_streak::INT AS current_streak,
               longest_streak::INT AS longest_streak,
               last_active_date::TEXT AS last_active_date`,
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
         last_active_date = $3
     WHERE user_id = $4
     RETURNING id,
               user_id,
               current_streak::INT AS current_streak,
               longest_streak::INT AS longest_streak,
               last_active_date::TEXT AS last_active_date`,
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
    `SELECT id, user_id, checkin_date::TEXT AS checkin_date, created_at
     FROM workout_checkins
     WHERE user_id = $1 AND checkin_date = $2`,
    [userId, checkinDate]
  );
  return rows[0] || null;
};

/**
 * Insert a workout check-in for one calendar date.
 *
 * @param {string} userId
 * @param {string} checkinDate - YYYY-MM-DD
 * @param {import('pg').PoolClient} [client]
 * @returns {Promise<object>}
 */
const createCheckin = async (userId, checkinDate, client) => {
  const runner = getRunner(client);
  const { rows } = await runner.query(
    `INSERT INTO workout_checkins (user_id, checkin_date)
     VALUES ($1, $2)
     RETURNING id, user_id, checkin_date::TEXT AS checkin_date, created_at`,
    [userId, checkinDate]
  );
  return rows[0];
};

/**
 * Count a user's check-ins, optionally inside a date range.
 *
 * @param {string} userId
 * @param {{ from_date?: string, to_date?: string }} filters
 * @param {import('pg').PoolClient} [client]
 * @returns {Promise<number>}
 */
const countCheckinsByUser = async (userId, filters = {}, client) => {
  const runner = getRunner(client);
  const conditions = ['user_id = $1'];
  const values = [userId];
  let idx = 2;

  if (filters.from_date) {
    conditions.push(`checkin_date >= $${idx++}`);
    values.push(filters.from_date);
  }

  if (filters.to_date) {
    conditions.push(`checkin_date <= $${idx++}`);
    values.push(filters.to_date);
  }

  const { rows } = await runner.query(
    `SELECT COUNT(*)::INT AS total
     FROM workout_checkins
     WHERE ${conditions.join(' AND ')}`,
    values
  );
  return rows[0].total;
};

/**
 * List a user's check-ins with pagination and optional date filters.
 *
 * @param {string} userId
 * @param {{ limit: number, offset: number, from_date?: string, to_date?: string }} opts
 * @returns {Promise<{ rows: object[], total: number }>}
 */
const findCheckinsByUser = async (userId, opts) => {
  const conditions = ['user_id = $1'];
  const values = [userId];
  let idx = 2;

  if (opts.from_date) {
    conditions.push(`checkin_date >= $${idx++}`);
    values.push(opts.from_date);
  }

  if (opts.to_date) {
    conditions.push(`checkin_date <= $${idx++}`);
    values.push(opts.to_date);
  }

  const where = conditions.join(' AND ');

  const countResult = await db.query(
    `SELECT COUNT(*)::INT AS total
     FROM workout_checkins
     WHERE ${where}`,
    values
  );

  const { rows } = await db.query(
    `SELECT id, user_id, checkin_date::TEXT AS checkin_date, created_at
     FROM workout_checkins
     WHERE ${where}
     ORDER BY checkin_date DESC, created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
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
