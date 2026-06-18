/**
 * memberships.repository.js
 * Raw PostgreSQL queries for membership_plans and memberships tables.
 * No business logic — only data access.
 */

const db = require('../../config/db');

// ─── Membership Plans ─────────────────────────────────────────────────────────

/**
 * List all active membership plans (visible to members).
 * @returns {Promise<object[]>}
 */
const findAllActivePlans = async () => {
  const { rows } = await db.query(
    `SELECT id, name, description, price, duration_days, created_at
     FROM membership_plans
     WHERE is_active = true
     ORDER BY price ASC`
  );
  return rows;
};

/**
 * List ALL plans including inactive ones (admin only).
 * @returns {Promise<object[]>}
 */
const findAllPlans = async () => {
  const { rows } = await db.query(
    `SELECT id, name, description, price, duration_days, is_active, created_at
     FROM membership_plans
     ORDER BY created_at DESC`
  );
  return rows;
};

/**
 * Find a single plan by ID.
 * @param {string} planId
 * @returns {Promise<object|null>}
 */
const findPlanById = async (planId) => {
  const { rows } = await db.query(
    `SELECT id, name, description, price, duration_days, is_active, created_at
     FROM membership_plans
     WHERE id = $1`,
    [planId]
  );
  return rows[0] || null;
};

/**
 * Create a new membership plan (admin).
 * @param {{ name, description, price, duration_days }} data
 * @returns {Promise<object>}
 */
const createPlan = async ({ name, description, price, duration_days }) => {
  const { rows } = await db.query(
    `INSERT INTO membership_plans (name, description, price, duration_days)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [name, description || null, price, duration_days]
  );
  return rows[0];
};

/**
 * Update a membership plan (admin).
 * @param {string} planId
 * @param {{ name?, description?, price?, duration_days?, is_active? }} fields
 * @returns {Promise<object>}
 */
const updatePlan = async (planId, fields) => {
  const setClauses = [];
  const values     = [];
  let   idx        = 1;

  const allowed = ['name', 'description', 'price', 'duration_days', 'is_active'];
  allowed.forEach((key) => {
    if (fields[key] !== undefined) {
      setClauses.push(`${key} = $${idx++}`);
      values.push(fields[key]);
    }
  });

  if (setClauses.length === 0) return findPlanById(planId);

  values.push(planId);
  const { rows } = await db.query(
    `UPDATE membership_plans
     SET ${setClauses.join(', ')}
     WHERE id = $${idx}
     RETURNING *`,
    values
  );
  return rows[0] || null;
};

// ─── Memberships ──────────────────────────────────────────────────────────────

/**
 * Find the current active membership for a user.
 * Returns the most recently created active membership.
 *
 * @param {string} userId
 * @returns {Promise<object|null>}
 */
const findActiveMembership = async (userId) => {
  const { rows } = await db.query(
    `SELECT m.id, m.user_id, m.plan_id, m.status,
            m.start_date, m.end_date, m.created_at, m.updated_at,
            mp.name AS plan_name, mp.price, mp.duration_days
     FROM memberships m
     JOIN membership_plans mp ON mp.id = m.plan_id
     WHERE m.user_id = $1
       AND m.status = 'active'
       AND m.end_date >= CURRENT_DATE
     ORDER BY m.end_date DESC
     LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
};

/**
 * Find all memberships for a user (history).
 * @param {string} userId
 * @returns {Promise<object[]>}
 */
const findAllByUser = async (userId) => {
  const { rows } = await db.query(
    `SELECT m.id, m.status, m.start_date, m.end_date, m.created_at,
            mp.name AS plan_name, mp.price, mp.duration_days
     FROM memberships m
     JOIN membership_plans mp ON mp.id = m.plan_id
     WHERE m.user_id = $1
     ORDER BY m.created_at DESC`,
    [userId]
  );
  return rows;
};

/**
 * Find a membership by ID.
 * @param {string} membershipId
 * @returns {Promise<object|null>}
 */
const findById = async (membershipId) => {
  const { rows } = await db.query(
    `SELECT m.*, mp.name AS plan_name, mp.price, mp.duration_days
     FROM memberships m
     JOIN membership_plans mp ON mp.id = m.plan_id
     WHERE m.id = $1`,
    [membershipId]
  );
  return rows[0] || null;
};

/**
 * Create a new membership row.
 * Called inside a transaction alongside payment creation.
 *
 * @param {{ user_id, plan_id, start_date, end_date, updated_by? }} data
 * @param {import('pg').PoolClient} client - transaction client
 * @returns {Promise<object>}
 */
const createMembership = async (
  { user_id, plan_id, start_date, end_date, updated_by },
  client
) => {
  const runner = client || db;
  const { rows } = await runner.query(
    `INSERT INTO memberships (user_id, plan_id, start_date, end_date, updated_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [user_id, plan_id, start_date, end_date, updated_by || null]
  );
  return rows[0];
};

/**
 * Update membership status (admin: suspend / cancel / re-activate).
 *
 * @param {string} membershipId
 * @param {string} status
 * @param {string} adminId
 * @param {import('pg').PoolClient} [client]
 * @returns {Promise<object>}
 */
const updateStatus = async (membershipId, status, adminId, client) => {
  const runner = client || db;
  const { rows } = await runner.query(
    `UPDATE memberships
     SET status = $1, updated_by = $2, updated_at = now()
     WHERE id = $3
     RETURNING *`,
    [status, adminId, membershipId]
  );
  return rows[0] || null;
};

/**
 * Admin: list all memberships with optional filters and pagination.
 * Supports FR-28 (monitor active/expired memberships).
 *
 * @param {{ status?, user_id?, expiring_within_days?, limit, offset }} opts
 * @returns {Promise<{ rows: object[], total: number }>}
 */
const findAll = async ({ status, user_id, expiring_within_days, limit, offset }) => {
  const conditions = [];
  const values     = [];
  let   idx        = 1;

  if (status) {
    conditions.push(`m.status = $${idx++}`);
    values.push(status);
  }

  if (user_id) {
    conditions.push(`m.user_id = $${idx++}`);
    values.push(user_id);
  }

  if (expiring_within_days) {
    conditions.push(
      `m.end_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + $${idx++}::INT)`
    );
    values.push(expiring_within_days);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await db.query(
    `SELECT COUNT(*) FROM memberships m ${where}`,
    values
  );
  const total = parseInt(countResult.rows[0].count);

  const { rows } = await db.query(
    `SELECT m.id, m.user_id, m.status, m.start_date, m.end_date,
            m.created_at, m.updated_at,
            mp.name AS plan_name, mp.price, mp.duration_days,
            u.full_name AS user_name, u.email AS user_email
     FROM memberships m
     JOIN membership_plans mp ON mp.id = m.plan_id
     JOIN users u ON u.id = m.user_id
     ${where}
     ORDER BY m.created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...values, limit, offset]
  );

  return { rows, total };
};

/**
 * Mark expired memberships automatically.
 * Called by a scheduled job (or on-demand by admin).
 * Updates any active memberships whose end_date has passed.
 *
 * @returns {Promise<number>} count of memberships updated
 */
const expireOverdueMemberships = async () => {
  const { rowCount } = await db.query(
    `UPDATE memberships
     SET status = 'expired', updated_at = now()
     WHERE status = 'active'
       AND end_date < CURRENT_DATE`
  );
  return rowCount;
};

module.exports = {
  findAllActivePlans,
  findAllPlans,
  findPlanById,
  createPlan,
  updatePlan,
  findActiveMembership,
  findAllByUser,
  findById,
  createMembership,
  updateStatus,
  findAll,
  expireOverdueMemberships,
};