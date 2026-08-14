/**
 * occupancy.repository.js
 * Raw PostgreSQL queries for branch-aware gym occupancy.
 *
 * This file matches gym.sql:
 *   - gym_branches(id, name, capacity, is_active, ...)
 *   - gym_sessions(user_id, branch_id, checked_in_at, checked_out_at, duration_minutes)
 *   - workout_checkins(user_id, branch_id, checkin_date, checked_in_at)
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
 * Find all active branches.
 *
 * @returns {Promise<object[]>}
 */
const findActiveBranches = async () => {
  const { rows } = await db.query(
    `SELECT id, name, address, city, phone, opening_time, closing_time,
            capacity, is_active, created_at, updated_at
     FROM gym_branches
     WHERE is_active = true
     ORDER BY name ASC`
  );
  return rows;
};

/**
 * Find one active branch by ID.
 *
 * @param {string} branchId
 * @param {import('pg').PoolClient} [client]
 * @returns {Promise<object|null>}
 */
const findBranchById = async (branchId, client) => {
  const runner = getRunner(client);
  const lockClause = client ? 'FOR UPDATE' : '';
  const { rows } = await runner.query(
    `SELECT id, name, address, city, phone, opening_time, closing_time,
            capacity, is_active, created_at, updated_at
     FROM gym_branches
     WHERE id = $1
       AND is_active = true
     ${lockClause}`,
    [branchId]
  );
  return rows[0] || null;
};

/**
 * Find all branches regardless of active status, for admin management.
 *
 * @returns {Promise<object[]>}
 */
const findAllBranches = async () => {
  const { rows } = await db.query(
    `SELECT id, name, address, city, phone, opening_time, closing_time,
            capacity, is_active, created_at, updated_at
     FROM gym_branches
     ORDER BY name ASC`
  );
  return rows;
};

/**
 * Find one branch by ID regardless of active status, for admin management.
 *
 * @param {string} branchId
 * @returns {Promise<object|null>}
 */
const findBranchByIdAny = async (branchId) => {
  const { rows } = await db.query(
    `SELECT id, name, address, city, phone, opening_time, closing_time,
            capacity, is_active, created_at, updated_at
     FROM gym_branches
     WHERE id = $1`,
    [branchId]
  );
  return rows[0] || null;
};

/**
 * Create a gym branch.
 *
 * @param {{ name: string, address?: string, city?: string, phone?: string, opening_time?: string, closing_time?: string, capacity: number }} data
 * @returns {Promise<object>}
 */
const createBranch = async (data) => {
  const { rows } = await db.query(
    `INSERT INTO gym_branches (name, address, city, phone, opening_time, closing_time, capacity)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, name, address, city, phone, opening_time, closing_time,
               capacity, is_active, created_at, updated_at`,
    [
      data.name,
      data.address ?? null,
      data.city ?? null,
      data.phone ?? null,
      data.opening_time ?? null,
      data.closing_time ?? null,
      data.capacity,
    ]
  );
  return rows[0];
};

/**
 * Update a gym branch. Only provided fields are changed.
 *
 * @param {string} branchId
 * @param {object} fields
 * @returns {Promise<object|null>}
 */
const updateBranch = async (branchId, fields) => {
  const columns = Object.keys(fields);
  if (columns.length === 0) {
    return findBranchByIdAny(branchId);
  }

  const setClause = columns.map((column, index) => `${column} = $${index + 2}`).join(', ');
  const values = columns.map((column) => fields[column]);

  const { rows } = await db.query(
    `UPDATE gym_branches
     SET ${setClause}, updated_at = now()
     WHERE id = $1
     RETURNING id, name, address, city, phone, opening_time, closing_time,
               capacity, is_active, created_at, updated_at`,
    [branchId, ...values]
  );
  return rows[0] || null;
};

/**
 * Find current occupancy from the reporting view.
 *
 * @param {string|null} branchId
 * @returns {Promise<object[]>}
 */
const findCurrentOccupancy = async (branchId = null) => {
  const values = [];
  const where = branchId ? 'WHERE branch_id = $1' : '';
  if (branchId) values.push(branchId);

  const { rows } = await db.query(
    `SELECT branch_id, branch_name, active_members_in_gym::INT, capacity
     FROM current_occupancy
     ${where}
     ORDER BY branch_name ASC`,
    values
  );
  return rows;
};

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
 * Find users that have a QR token.
 *
 * Used when an admin scans a QR image data URL instead of receiving the raw
 * qr_code_token from the frontend.
 *
 * @param {import('pg').PoolClient} [client]
 * @returns {Promise<object[]>}
 */
const findUsersWithQrTokens = async (client) => {
  const runner = getRunner(client);
  const { rows } = await runner.query(
    `SELECT id, email, full_name, role, qr_code_token
     FROM users
     WHERE qr_code_token IS NOT NULL`
  );
  return rows;
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
    `SELECT id, email, full_name, role, qr_code_token
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
 * Count members currently inside a branch.
 *
 * @param {string} branchId
 * @param {import('pg').PoolClient} [client]
 * @returns {Promise<number>}
 */
const countOpenSessions = async (branchId, client) => {
  const runner = getRunner(client);
  const { rows } = await runner.query(
    `SELECT COUNT(*)::INT AS total
     FROM gym_sessions
     WHERE branch_id = $1
       AND checked_out_at IS NULL`,
    [branchId]
  );
  return rows[0].total;
};

/**
 * Count distinct members currently inside a branch.
 *
 * @param {string} branchId
 * @param {import('pg').PoolClient} [client]
 * @returns {Promise<number>}
 */
const countActiveMembersInBranch = async (branchId, client) => {
  const runner = getRunner(client);
  const { rows } = await runner.query(
    `SELECT COUNT(DISTINCT user_id)::INT AS total
     FROM gym_sessions
     WHERE branch_id = $1
       AND checked_out_at IS NULL`,
    [branchId]
  );
  return rows[0].total;
};

/**
 * Find the latest open session for a user across all branches.
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
            gs.branch_id,
            b.name AS branch_name,
            gs.checked_in_at,
            gs.checked_out_at,
            gs.duration_minutes,
            u.full_name AS user_name,
            u.email AS user_email
     FROM gym_sessions gs
     JOIN users u ON u.id = gs.user_id
     JOIN gym_branches b ON b.id = gs.branch_id
     WHERE gs.user_id = $1
       AND gs.checked_out_at IS NULL
     ORDER BY gs.checked_in_at DESC
     LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
};

/**
 * Create a gym session.
 *
 * @param {string} userId
 * @param {string} branchId
 * @param {Date} checkedInAt
 * @param {import('pg').PoolClient} [client]
 * @returns {Promise<object>}
 */
const createSession = async (userId, branchId, checkedInAt, client) => {
  const runner = getRunner(client);
  const { rows } = await runner.query(
    `INSERT INTO gym_sessions (user_id, branch_id, checked_in_at)
     VALUES ($1, $2, $3)
     RETURNING id, user_id, branch_id, checked_in_at, checked_out_at, duration_minutes`,
    [userId, branchId, checkedInAt]
  );
  return rows[0];
};

/**
 * Close a gym session by setting checked_out_at.
 *
 * @param {string} sessionId
 * @param {Date} checkedOutAt
 * @param {import('pg').PoolClient} [client]
 * @returns {Promise<object|null>}
 */
const closeSession = async (sessionId, checkedOutAt, client) => {
  const runner = getRunner(client);
  const { rows } = await runner.query(
    `UPDATE gym_sessions
     SET checked_out_at = $1
     WHERE id = $2
       AND checked_out_at IS NULL
     RETURNING id, user_id, branch_id, checked_in_at, checked_out_at, duration_minutes`,
    [checkedOutAt, sessionId]
  );
  return rows[0] || null;
};

/**
 * Close open sessions, optionally for one branch.
 *
 * @param {Date} checkedOutAt
 * @param {string|null} branchId
 * @param {import('pg').PoolClient} [client]
 * @returns {Promise<object[]>}
 */
const closeOpenSessions = async (checkedOutAt, branchId = null, client) => {
  const runner = getRunner(client);
  const values = [checkedOutAt];
  const branchFilter = branchId ? 'AND branch_id = $2' : '';
  if (branchId) values.push(branchId);

  const { rows } = await runner.query(
    `UPDATE gym_sessions
     SET checked_out_at = $1
     WHERE checked_out_at IS NULL
       AND checked_in_at <= $1
       ${branchFilter}
     RETURNING id, user_id, branch_id, checked_in_at, checked_out_at, duration_minutes`,
    values
  );
  return rows;
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

  if (filters.branch_id) {
    conditions.push(`gs.branch_id = $${idx++}`);
    values.push(filters.branch_id);
  }

  if (filters.status === SESSION_STATUS.OPEN) {
    conditions.push('gs.checked_out_at IS NULL');
  }

  if (filters.status === SESSION_STATUS.CLOSED) {
    conditions.push('gs.checked_out_at IS NOT NULL');
  }

  if (filters.from_date) {
    conditions.push(`gs.checked_in_at >= $${idx++}::date`);
    values.push(filters.from_date);
  }

  if (filters.to_date) {
    conditions.push(`gs.checked_in_at < ($${idx++}::date + interval '1 day')`);
    values.push(filters.to_date);
  }

  return {
    where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    values,
    nextIndex: idx,
  };
};

/**
 * Count sessions using optional filters.
 *
 * @param {object} filters
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
 * @param {{ user_id?: string, branch_id?: string, status?: string, from_date?: string, to_date?: string, limit: number, offset: number }} opts
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
            gs.branch_id,
            b.name AS branch_name,
            gs.checked_in_at,
            gs.checked_out_at,
            gs.duration_minutes
     FROM gym_sessions gs
     JOIN users u ON u.id = gs.user_id
     JOIN gym_branches b ON b.id = gs.branch_id
     ${where}
     ORDER BY gs.checked_in_at DESC
     LIMIT $${nextIndex} OFFSET $${nextIndex + 1}`,
    [...values, opts.limit, opts.offset]
  );

  return { rows, total };
};

/**
 * Find sessions that started on a given calendar date.
 *
 * @param {string} date - YYYY-MM-DD
 * @param {string|null} branchId
 * @returns {Promise<object[]>}
 */
const findSessionsByDate = async (date, branchId = null) => {
  const values = [date];
  const branchFilter = branchId ? 'AND gs.branch_id = $2' : '';
  if (branchId) values.push(branchId);

  const { rows } = await db.query(
    `SELECT gs.id,
            gs.user_id,
            u.full_name AS user_name,
            u.email AS user_email,
            gs.branch_id,
            b.name AS branch_name,
            gs.checked_in_at,
            gs.checked_out_at,
            gs.duration_minutes
     FROM gym_sessions gs
     JOIN users u ON u.id = gs.user_id
     JOIN gym_branches b ON b.id = gs.branch_id
     WHERE gs.checked_in_at >= $1::date
       AND gs.checked_in_at < ($1::date + interval '1 day')
       ${branchFilter}
     ORDER BY gs.checked_in_at ASC`,
    values
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
    `SELECT id, user_id, branch_id, checkin_date::TEXT AS checkin_date,
            checked_in_at, counted_for_streak
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
 * @param {string} branchId
 * @param {string} checkinDate - YYYY-MM-DD
 * @param {Date} checkedInAt
 * @param {import('pg').PoolClient} [client]
 * @returns {Promise<object>}
 */
const createWorkoutCheckin = async (
  userId,
  branchId,
  checkinDate,
  checkedInAt,
  client
) => {
  const runner = getRunner(client);
  const { rows } = await runner.query(
    `INSERT INTO workout_checkins (user_id, branch_id, checkin_date, checked_in_at)
     VALUES ($1, $2, $3, $4)
     RETURNING id, user_id, branch_id, checkin_date::TEXT AS checkin_date,
               checked_in_at, counted_for_streak`,
    [userId, branchId, checkinDate, checkedInAt]
  );
  return rows[0];
};

/**
 * Find all distinct counted workout check-in dates for a user.
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
       AND counted_for_streak = true
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
         last_active_date = $3,
         updated_at = now()
     WHERE user_id = $4
     RETURNING id, user_id, current_streak, longest_streak, last_active_date::TEXT AS last_active_date`,
    [stats.current_streak, stats.longest_streak, stats.last_active_date, userId]
  );
  return rows[0];
};

module.exports = {
  findActiveBranches,
  findAllBranches,
  findBranchById,
  findBranchByIdAny,
  createBranch,
  updateBranch,
  findCurrentOccupancy,
  findUserByQrToken,
  findUsersWithQrTokens,
  findUserById,
  findActiveMembership,
  countOpenSessions,
  countActiveMembersInBranch,
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
