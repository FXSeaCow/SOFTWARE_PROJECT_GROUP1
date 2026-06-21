/**
 * payments.repository.js
 * Raw PostgreSQL queries for the payments table.
 * No business logic — only data access.
 *
 * Simplified model: no webhook, no gateway.
 * provider_tx_id is used to store the admin's confirmation reference.
 */

const db = require('../../config/db');

/**
 * Create a new payment record with status 'pending'.
 * Called when a member submits a payment request.
 *
 * @param {{ membership_id, user_id, amount, provider, transfer_note? }} data
 * @returns {Promise<object>}
 */
const createPayment = async ({ membership_id, user_id, amount, provider, transfer_note }) => {
  const { rows } = await db.query(
    `INSERT INTO payments (membership_id, user_id, amount, provider, status, provider_tx_id)
     VALUES ($1, $2, $3, $4, 'pending', $5)
     RETURNING *`,
    [membership_id, user_id, amount, provider, transfer_note || null]
  );
  return rows[0];
};

/**
 * Find a payment by ID with user and plan info joined.
 *
 * @param {string} paymentId
 * @returns {Promise<object|null>}
 */
const findById = async (paymentId) => {
  const { rows } = await db.query(
    `SELECT p.*,
            u.full_name  AS user_name,
            u.email      AS user_email,
            mp.name      AS plan_name
     FROM payments p
     JOIN users u            ON u.id  = p.user_id
     JOIN memberships m      ON m.id  = p.membership_id
     JOIN membership_plans mp ON mp.id = m.plan_id
     WHERE p.id = $1`,
    [paymentId]
  );
  return rows[0] || null;
};

/**
 * Mark a payment as completed (admin confirms).
 *
 * @param {string} paymentId
 * @param {string} adminId       — who confirmed it
 * @param {string|null} note     — optional admin note stored in provider_tx_id
 * @param {import('pg').PoolClient} client
 * @returns {Promise<object>}
 */
const markCompleted = async (paymentId, adminId, note, client) => {
  const ref = note ? `CONFIRMED-BY-${adminId}: ${note}` : `CONFIRMED-BY-${adminId}`;
  const { rows } = await client.query(
    `UPDATE payments
     SET status         = 'completed',
         provider_tx_id = $1,
         paid_at        = now()
     WHERE id = $2
     RETURNING *`,
    [ref, paymentId]
  );
  return rows[0];
};

/**
 * Mark a payment as failed (admin rejects).
 *
 * @param {string} paymentId
 * @param {string} adminId
 * @param {string} reason
 * @param {import('pg').PoolClient} [client]
 * @returns {Promise<object>}
 */
const markFailed = async (paymentId, adminId, reason, client) => {
  const runner = client || db;
  const ref = `REJECTED-BY-${adminId}: ${reason}`;
  const { rows } = await runner.query(
    `UPDATE payments
     SET status         = 'failed',
         provider_tx_id = $1
     WHERE id = $2
     RETURNING *`,
    [ref, paymentId]
  );
  return rows[0];
};

/**
 * Mark a payment as refunded (admin action).
 *
 * @param {string} paymentId
 * @param {string} adminId
 * @param {string} reason
 * @returns {Promise<object|null>}
 */
const markRefunded = async (paymentId, adminId, reason) => {
  const ref = `REFUNDED-BY-${adminId}: ${reason}`;
  const { rows } = await db.query(
    `UPDATE payments
     SET status         = 'refunded',
         provider_tx_id = $1
     WHERE id = $2
     RETURNING *`,
    [ref, paymentId]
  );
  return rows[0] || null;
};

/**
 * List a user's own payments with plan name joined (FR-26).
 *
 * @param {string} userId
 * @param {{ limit, offset }} pagination
 * @returns {Promise<{ rows: object[], total: number }>}
 */
const findAllByUser = async (userId, { limit, offset }) => {
  const countResult = await db.query(
    `SELECT COUNT(*) FROM payments WHERE user_id = $1`,
    [userId]
  );
  const total = parseInt(countResult.rows[0].count);

  const { rows } = await db.query(
    `SELECT p.id, p.amount, p.status, p.provider,
            p.provider_tx_id AS admin_note,
            p.paid_at, p.created_at,
            mp.name AS plan_name
     FROM payments p
     JOIN memberships m      ON m.id  = p.membership_id
     JOIN membership_plans mp ON mp.id = m.plan_id
     WHERE p.user_id = $1
     ORDER BY p.created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );

  return { rows, total };
};

/**
 * Admin: list all payments with optional filters (FR-30).
 *
 * @param {{ status?, user_id?, provider?, from_date?, to_date?, limit, offset }} opts
 * @returns {Promise<{ rows: object[], total: number }>}
 */
const findAll = async ({ status, user_id, provider, from_date, to_date, limit, offset }) => {
  const conditions = [];
  const values     = [];
  let   idx        = 1;

  if (status)    { conditions.push(`p.status = $${idx++}`);        values.push(status); }
  if (user_id)   { conditions.push(`p.user_id = $${idx++}`);       values.push(user_id); }
  if (provider)  { conditions.push(`p.provider = $${idx++}`);      values.push(provider); }
  if (from_date) { conditions.push(`p.created_at >= $${idx++}`);   values.push(from_date); }
  if (to_date)   { conditions.push(`p.created_at <= $${idx++}`);   values.push(to_date); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await db.query(
    `SELECT COUNT(*) FROM payments p ${where}`, values
  );
  const total = parseInt(countResult.rows[0].count);

  const { rows } = await db.query(
    `SELECT p.id, p.amount, p.status, p.provider,
            p.provider_tx_id AS admin_note,
            p.paid_at, p.created_at,
            u.full_name  AS user_name,
            u.email      AS user_email,
            mp.name      AS plan_name
     FROM payments p
     JOIN users u            ON u.id  = p.user_id
     JOIN memberships m      ON m.id  = p.membership_id
     JOIN membership_plans mp ON mp.id = m.plan_id
     ${where}
     ORDER BY p.created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...values, limit, offset]
  );

  return { rows, total };
};

/**
 * Revenue summary from completed payments (FR-29).
 *
 * @param {{ from_date?, to_date? }} opts
 * @returns {Promise<object[]>}
 */
const getRevenueSummary = async ({ from_date, to_date } = {}) => {
  const conditions = [`status = 'completed'`];
  const values     = [];
  let   idx        = 1;

  if (from_date) { conditions.push(`paid_at >= $${idx++}`); values.push(from_date); }
  if (to_date)   { conditions.push(`paid_at <= $${idx++}`); values.push(to_date); }

  const { rows } = await db.query(
    `SELECT
       date_trunc('day', paid_at) AS report_date,
       COUNT(*)::INT               AS transaction_count,
       SUM(amount)                 AS total_revenue
     FROM payments
     WHERE ${conditions.join(' AND ')}
     GROUP BY date_trunc('day', paid_at)
     ORDER BY report_date DESC`,
    values
  );
  return rows;
};

module.exports = {
  createPayment,
  findById,
  markCompleted,
  markFailed,
  markRefunded,
  findAllByUser,
  findAll,
  getRevenueSummary,
};