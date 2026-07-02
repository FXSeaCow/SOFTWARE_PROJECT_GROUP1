/**
 * occupancy.repository.js
 * Raw PostgreSQL queries for gym occupancy.
 *
 * No business logic should live here. The service layer decides whether a
 * member may check in/out; this file only reads and writes rows.
 */

const db = require('../../config/db');
const { SESSION_STATUS } = require('./occupancy.constants');

/**
 * Return either a transaction client or the shared pool.
 *
 * @param {import('pg').PoolClient|undefined} client
 * @returns {import('pg').Pool|import('pg').PoolClient}
 */
const getRunner = (client) => client || db;

/**
 * Find a user by QR token.
 *
 * @param {string} qrCodeToken
 * @param {import('pg').PoolClient} [client]
 * @returns {Promise<object|null>}
 */
const findUserByQrToken = async (qrCodeToken, client) => {
  const runner = getRunner(client);
  const { rows } = await runner.query(
    `SELECT id, email, full_name, role, qr_code_token
     FROM users
     WHERE qr_code_token = $1`,
    [qrCodeToken]
  );
  return rows[0] || null;
};

/**
 * Find a user by ID.
 *
 * @param {string} userId
 * @param {import('pg').PoolClient} [client]
 * @returns {Promise<object|null>}
 */
const findUserById = async (userId, client) => {
  const runner = getRunner(client);
  const { rows } = await runner.query(
    `SELECT id, email, full_name, role
     FROM users
     WHERE id = $1`,
    [userId]
  );
  return rows[0] || null;
};

/**
 * Find the active membership for a member.
 *
 * @param {string} userId
 * @param {import('pg').PoolClient} [client]
 * @returns {Promise<object|null>}
 */
const findActiveMembership = async (userId, client) => {
  const runner = getRunner(client);
  const { rows } = await runner.query(
    `SELECT id, plan_id, status, start_date, end_date
     FROM memberships
     WHERE user_id = $1
       AND status = 'active'
       AND end_date >= CURRENT_DATE
     ORDER BY end_date DESC
     LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
};

/**
 * Count members currently inside the gym.
 *
 * @param {import('pg').PoolClient} [client]
 * @returns {Promise<number>}
 */
const countOpenSessions = async (client) => {
  const runner = getRunner(client);
  const { rows } = await runner.query(
    `SELECT COUNT(*)::INT AS total
     FROM gym_sessions
     WHERE check_out_at IS NULL`
  );
  return rows[0].total;
};

/**
 * Find the latest open session for a user.
 *
 * @param {string} userId
 * @param {import('pg').PoolClient} [client]
 * @returns {Promise<object|null>}
 */
const findOpenSessionByUser = async (userId, client) => {
  const runner = getRunner(client);
  const { rows } = await runner.query(
    `SELECT gs.id,
            gs.user_id,
            gs.check_in_at,
            gs.check_out_at,
            gs.created_at,
            u.full_name AS user_name,
            u.email AS user_email
     FROM gym_sessions gs
     JOIN users u ON u.id = gs.user_id
     WHERE gs.user_id = $1
       AND gs.check_out_at IS NULL
     ORDER BY gs.check_in_at DESC
     LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
};

/**
 * Create a gym session.
 *
 * @param {string} userId
 * @param {Date} checkInAt
 * @param {import('pg').PoolClient} [client]
 * @returns {Promise<object>}
 */
const createSession = async (userId, checkInAt, client) => {
  const runner = getRunner(client);
  const { rows } = await runner.query(
    `INSERT INTO gym_sessions (user_id, check_in_at)
     VALUES ($1, $2)
     RETURNING id, user_id, check_in_at, check_out_at, created_at`,
    [userId, checkInAt]
  );
  return rows[0];
};

/**
 * Close a gym session by setting check_out_at.
 *
 * @param {string} sessionId
 * @param {Date} checkOutAt
 * @param {import('pg').PoolClient} [client]
 * @returns {Promise<object|null>}
 */
const closeSession = async (sessionId, checkOutAt, client) => {
  const runner = getRunner(client);
  const { rows } = await runner.query(
    `UPDATE gym_sessions
     SET check_out_at = $1
     WHERE id = $2
       AND check_out_at IS NULL
     RETURNING id, user_id, check_in_at, check_out_at, created_at`,
    [checkOutAt, sessionId]
  );
  return rows[0] || null;
};

/**
 * Close all currently open sessions.
 *
 * Used by admin reset and by the scheduler's end-of-day maintenance.
 *
 * @param {Date} checkOutAt
 * @param {import('pg').PoolClient} [client]
 * @returns {Promise<object[]>}
 */
const closeOpenSessions = async (checkOutAt, client) => {
  const runner = getRunner(client);
  const { rows } = await runner.query(
    `UPDATE gym_sessions
     SET check_out_at = $1
     WHERE check_out_at IS NULL
       AND check_in_at <= $1
     RETURNING id, user_id, check_in_at, check_out_at, created_at`,
    [checkOutAt]
  );
  return rows;
};

/**
 * Count sessions using optional filters.
 *
 * @param {{ user_id?: string, status?: string, from_date?: string, to_date?: string }} filters
 * @returns {Promise<number>}
 */
const countSessions = async (filters = {}) => {
  const { where, values } = buildSessionFilters(filters);
  const { rows } = await db.query(
    `SELECT COUNT(*)::INT AS total
     FROM gym_sessions gs
     ${where}`,
    values
  );
  return rows[0].total;
};

/**
 * List gym sessions using optional filters and pagination.
 *
 * @param {{ user_id?: string, status?: string, from_date?: string, to_date?: string, limit: number, offset: number }} opts
 * @returns {Promise<{ rows: object[], total: number }>}
 */
const findSessions = async (opts) => {
  const { where, values, nextIndex } = buildSessionFilters(opts);
  const total = await countSessions(opts);

  const { rows } = await db.query(
    `SELECT gs.id,
            gs.user_id,
            u.full_name AS user_name,
            u.email AS user_email,
            gs.check_in_at,
            gs.check_out_at,
            gs.created_at,
            EXTRACT(EPOCH FROM (COALESCE(gs.check_out_at, now()) - gs.check_in_at))::INT
              AS duration_seconds
     FROM gym_sessions gs
     JOIN users u ON u.id = gs.user_id
     ${where}
     ORDER BY gs.check_in_at DESC
     LIMIT $${nextIndex} OFFSET $${nextIndex + 1}`,
    [...values, opts.limit, opts.offset]
  );

  return { rows, total };
};

/**
 * Find sessions that started on a given calendar date.
 *
 * @param {string} date - YYYY-MM-DD
 * @returns {Promise<object[]>}
 */
const findSessionsByDate = async (date) => {
  const { rows } = await db.query(
    `SELECT gs.id,
            gs.user_id,
            u.full_name AS user_name,
            u.email AS user_email,
            gs.check_in_at,
            gs.check_out_at,
            gs.created_at
     FROM gym_sessions gs
     JOIN users u ON u.id = gs.user_id
     WHERE gs.check_in_at >= $1::date
       AND gs.check_in_at < ($1::date + interval '1 day')
     ORDER BY gs.check_in_at ASC`,
    [date]
  );
  return rows;
};

/**
 * Find a workout check-in by user and date.
 *
 * @param {string} userId
 * @param {string} checkinDate - YYYY-MM-DD
 * @param {import('pg').PoolClient} [client]
 * @returns {Promise<object|null>}
 */
const findWorkoutCheckinByUserAndDate = async (userId, checkinDate, client) => {
  const runner = getRunner(client);
  const { rows } = await runner.query(
    `SELECT id, user_id, checkin_date::TEXT AS checkin_date, created_at
     FROM workout_checkins
     WHERE user_id = $1
       AND checkin_date = $2`,
    [userId, checkinDate]
  );
  return rows[0] || null;
};

/**
 * Create a workout check-in for streak tracking.
 *
 * @param {string} userId
 * @param {string} checkinDate - YYYY-MM-DD
 * @param {import('pg').PoolClient} [client]
 * @returns {Promise<object>}
 */
const createWorkoutCheckin = async (userId, checkinDate, client) => {
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
 * Find all distinct workout check-in dates for a user.
 *
 * @param {string} userId
 * @param {import('pg').PoolClient} [client]
 * @returns {Promise<string[]>}
 */
const findWorkoutCheckinDatesByUser = async (userId, client) => {
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
 * Ensure the user has a workout_streaks row.
 *
 * @param {string} userId
 * @param {import('pg').PoolClient} [client]
 * @returns {Promise<object>}
 */
const ensureWorkoutStreak = async (userId, client) => {
  const runner = getRunner(client);
  const existing = await runner.query(
    `SELECT id, user_id, current_streak, longest_streak, last_active_date::TEXT AS last_active_date
     FROM workout_streaks
     WHERE user_id = $1`,
    [userId]
  );

  if (existing.rows[0]) return existing.rows[0];

  const created = await runner.query(
    `INSERT INTO workout_streaks (user_id)
     VALUES ($1)
     RETURNING id, user_id, current_streak, longest_streak, last_active_date::TEXT AS last_active_date`,
    [userId]
  );
  return created.rows[0];
};

/**
 * Update workout streak counters.
 *
 * @param {string} userId
 * @param {{ current_streak: number, longest_streak: number, last_active_date: string|null }} stats
 * @param {import('pg').PoolClient} [client]
 * @returns {Promise<object>}
 */
const updateWorkoutStreak = async (userId, stats, client) => {
  const runner = getRunner(client);
  const { rows } = await runner.query(
    `UPDATE workout_streaks
     SET current_streak = $1,
         longest_streak = $2,
         last_active_date = $3
     WHERE user_id = $4
     RETURNING id, user_id, current_streak, longest_streak, last_active_date::TEXT AS last_active_date`,
    [stats.current_streak, stats.longest_streak, stats.last_active_date, userId]
  );
  return rows[0];
};

/**
 * Build dynamic WHERE clauses for gym session queries.
 *
 * @param {object} filters
 * @returns {{ where: string, values: Array, nextIndex: number }}
 */
const buildSessionFilters = (filters = {}) => {
  const conditions = [];
  const values = [];
  let idx = 1;

  if (filters.user_id) {
    conditions.push(`gs.user_id = $${idx++}`);
    values.push(filters.user_id);
  }

  if (filters.status === SESSION_STATUS.OPEN) {
    conditions.push('gs.check_out_at IS NULL');
  }

  if (filters.status === SESSION_STATUS.CLOSED) {
    conditions.push('gs.check_out_at IS NOT NULL');
  }

  if (filters.from_date) {
    conditions.push(`gs.check_in_at >= $${idx++}::date`);
    values.push(filters.from_date);
  }

  if (filters.to_date) {
    conditions.push(`gs.check_in_at < ($${idx++}::date + interval '1 day')`);
    values.push(filters.to_date);
  }

  return {
    where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    values,
    nextIndex: idx,
  };
};

module.exports = {
  findUserByQrToken,
  findUserById,
  findActiveMembership,
  countOpenSessions,
  findOpenSessionByUser,
  createSession,
  closeSession,
  closeOpenSessions,
  findSessions,
  findSessionsByDate,
  findWorkoutCheckinByUserAndDate,
  createWorkoutCheckin,
  findWorkoutCheckinDatesByUser,
  ensureWorkoutStreak,
  updateWorkoutStreak,
};
