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
    `SELECT u.id, u.email, u.full_name, u.phone, u.role, u.account_status,
            u.qr_code_token, u.created_at, u.updated_at,
            COALESCE((
              SELECT CASE
                WHEN m.status = 'active' AND m.end_date >= CURRENT_DATE THEN 'active'::text
                WHEN m.status = 'active' AND m.end_date < CURRENT_DATE THEN 'expired'::text
                ELSE m.status::text
              END
              FROM memberships m
              WHERE m.user_id = u.id
              ORDER BY m.created_at DESC
              LIMIT 1
            ), 'none'::text) AS membership_status
     FROM users u
     WHERE u.id = $1`,
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
    conditions.push(`u.role = $${idx++}`);
    values.push(role);
  }

  if (search) {
    conditions.push(
      `(u.full_name ILIKE $${idx} OR u.email ILIKE $${idx})`
    );
    values.push(`%${search}%`);
    idx++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  // Total count (for pagination metadata)
  const countResult = await db.query(
    `SELECT COUNT(*) FROM users u ${where}`,
    values
  );
  const total = parseInt(countResult.rows[0].count);

  // Paginated rows
  const { rows } = await db.query(
    `SELECT u.id, u.email, u.full_name, u.phone, u.role, u.account_status,
            u.created_at, u.updated_at,
            COALESCE((
              SELECT CASE
                WHEN m.status = 'active' AND m.end_date >= CURRENT_DATE THEN 'active'::text
                WHEN m.status = 'active' AND m.end_date < CURRENT_DATE THEN 'expired'::text
                ELSE m.status::text
              END
              FROM memberships m
              WHERE m.user_id = u.id
              ORDER BY m.created_at DESC
              LIMIT 1
            ), 'none'::text) AS membership_status
     FROM users u
     ${where}
     ORDER BY u.created_at DESC
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
     RETURNING id, email, full_name, phone, role, account_status, updated_at`,
    values
  );
  return rows[0];
};

const updateRole = async (id, role) => {
  const { rows } = await db.query(
    `UPDATE users
     SET role = $1, updated_at = now()
     WHERE id = $2
     RETURNING id, email, full_name, phone, role, account_status, created_at, updated_at`,
    [role, id]
  );
  return rows[0] || null;
};

const updateAccountStatus = async (id, accountStatus) => {
  const { rows } = await db.query(
    `UPDATE users
     SET account_status = $1, updated_at = now()
     WHERE id = $2
     RETURNING id, email, full_name, phone, role, account_status, created_at, updated_at`,
    [accountStatus, id]
  );
  return rows[0] || null;
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
  updateRole,
  updateAccountStatus,
  updatePassword,
  regenerateQrToken,
  deleteUser,
};
