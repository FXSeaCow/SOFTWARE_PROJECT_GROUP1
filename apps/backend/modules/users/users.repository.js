/**
 * users.repository.js
 * Raw PostgreSQL queries for user profile operations.
 * No business logic — only data access.
 */

const db = require('../../config/db');

/**
 * Find a user by ID, returning safe fields (no password_hash).
 *
 * @param {string} id - UUID
 * @returns {Promise<object|null>}
 */
const findById = async (id) => {
  const { rows } = await db.query(
    `SELECT id, email, full_name, phone, role,
            qr_code_token, created_at, updated_at
     FROM users
     WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
};

/**
 * Find a user by ID including password_hash.
 * Used ONLY by changePassword to verify the current password.
 *
 * @param {string} id
 * @returns {Promise<object|null>}
 */
const findByIdWithHash = async (id) => {
  const { rows } = await db.query(
    `SELECT id, password_hash FROM users WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
};

/**
 * List all users with optional role filter and name/email search.
 * Admin-only. Returns total count for pagination.
 *
 * @param {{ role?, search?, limit, offset }} options
 * @returns {Promise<{ rows: object[], total: number }>}
 */
const findAll = async ({ role, search, limit, offset }) => {
  const conditions = [];
  const values     = [];
  let   idx        = 1;

  if (role) {
    conditions.push(`role = $${idx++}`);
    values.push(role);
  }

  if (search) {
    conditions.push(
      `(full_name ILIKE $${idx} OR email ILIKE $${idx})`
    );
    values.push(`%${search}%`);
    idx++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  // Total count (for pagination metadata)
  const countResult = await db.query(
    `SELECT COUNT(*) FROM users ${where}`,
    values
  );
  const total = parseInt(countResult.rows[0].count);

  // Paginated rows
  const { rows } = await db.query(
    `SELECT id, email, full_name, phone, role, created_at, updated_at
     FROM users
     ${where}
     ORDER BY created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...values, limit, offset]
  );

  return { rows, total };
};

/**
 * Update a user's profile fields.
 * Only updates fields that are actually provided (partial update).
 *
 * @param {string} id
 * @param {{ full_name?, phone? }} fields
 * @returns {Promise<object>} updated user
 */
const updateProfile = async (id, fields) => {
  const setClauses = [];
  const values     = [];
  let   idx        = 1;

  if (fields.full_name !== undefined) {
    setClauses.push(`full_name = $${idx++}`);
    values.push(fields.full_name);
  }

  if (fields.phone !== undefined) {
    setClauses.push(`phone = $${idx++}`);
    values.push(fields.phone || null);
  }

  if (setClauses.length === 0) return findById(id);

  setClauses.push(`updated_at = now()`);
  values.push(id);

  const { rows } = await db.query(
    `UPDATE users
     SET ${setClauses.join(', ')}
     WHERE id = $${idx}
     RETURNING id, email, full_name, phone, role, updated_at`,
    values
  );
  return rows[0];
};

/**
 * Update a user's password hash.
 * Called by changePassword after verifying the current password.
 *
 * @param {string} id
 * @param {string} newPasswordHash
 * @param {import('pg').PoolClient} [client] - optional transaction client
 */
const updatePassword = async (id, newPasswordHash, client) => {
  const runner = client || db;
  await runner.query(
    `UPDATE users
     SET password_hash = $1, updated_at = now()
     WHERE id = $2`,
    [newPasswordHash, id]
  );
};

/**
 * Regenerate a user's QR code token.
 * Invalidates any previously issued QR images.
 *
 * @param {string} id
 * @returns {Promise<{ qr_code_token: string }>}
 */
const regenerateQrToken = async (id) => {
  const { rows } = await db.query(
    `UPDATE users
     SET qr_code_token = gen_random_uuid(), updated_at = now()
     WHERE id = $1
     RETURNING qr_code_token`,
    [id]
  );
  return rows[0];
};

/**
 * Delete a user account.
 * Cascades to all related records (memberships, plans, etc.)
 * via ON DELETE CASCADE in the schema.
 * Admin-only.
 *
 * @param {string} id
 * @returns {Promise<boolean>} true if a row was deleted
 */
const deleteUser = async (id) => {
  const { rowCount } = await db.query(
    `DELETE FROM users WHERE id = $1`,
    [id]
  );
  return rowCount > 0;
};

module.exports = {
  findById,
  findByIdWithHash,
  findAll,
  updateProfile,
  updatePassword,
  regenerateQrToken,
  deleteUser,
};