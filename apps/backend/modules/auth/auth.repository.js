/**
 * auth.repository.js
 * Raw PostgreSQL queries for authentication-related operations.
 * Không chứa logic nghiệp vụ — chỉ data access.
 *
 * Ghi chú tiếng Việt:
 * - Các hàm ở đây dùng `db.query` hoặc client trong transaction.
 * - Việc viết/đọc token reset/thu hồi token thực hiện ở tầng repository.
 */

const db = require('../../config/db');

/**
 * Tìm user theo email.
 * Dùng khi đăng nhập để lấy `password_hash` để so sánh.
 */
const findByEmail = async (email) => {
  const { rows } = await db.query(
    `SELECT id, email, password_hash, full_name, phone, role, account_status, created_at
     FROM users
     WHERE email = $1`,
    [email]
  );
  return rows[0] || null;
};

/**
 * Tìm user theo id.
 */
const findById = async (id) => {
  const { rows } = await db.query(
    `SELECT id, email, full_name, phone, role, account_status, created_at
     FROM users
     WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
};

/**
 * Tạo user mới (đăng ký). Trả về user (không bao gồm password_hash).
 */
/**
 * Create a new user. Accepts an optional `client` for running inside
 * a transaction (so user + related inserts can be atomic).
 */
const createUser = async ({ email, password_hash, full_name, phone, role = 'member', account_status = 'active' }, client) => {
  const runner = client || db;
  const { rows } = await runner.query(
    `INSERT INTO users (email, password_hash, full_name, phone, role, account_status)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, email, full_name, phone, role, account_status, qr_code_token, created_at`,
    [email, password_hash, full_name, phone || null, role, account_status]
  );
  return rows[0];
};

/**
 * Khởi tạo record `workout_streaks` cho user mới (được gọi trong transaction).
 */
const initStreakRecord = async (userId, client) => {
  await client.query(
    `INSERT INTO workout_streaks (user_id) VALUES ($1)`,
    [userId]
  );
};

/**
 * Lưu token reset mật khẩu (đã hash) cùng expiry.
 * Token được lưu hashed — không lưu plain token.
 */
const savePasswordResetToken = async (userId, tokenHash, expiresAt, client) => {
  const runner = client || db;
  await runner.query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id)
     DO UPDATE SET token_hash = $2, expires_at = $3, created_at = now()`,
    [userId, tokenHash, expiresAt]
  );
};

/**
 * Tìm token reset hợp lệ (chưa hết hạn, chưa dùng).
 */
const findValidResetToken = async (tokenHash) => {
  const { rows } = await db.query(
    `SELECT user_id, expires_at
     FROM password_reset_tokens
     WHERE token_hash = $1
       AND expires_at > now()
       AND used_at IS NULL`,
    [tokenHash]
  );
  return rows[0] || null;
};

/**
 * Đánh dấu reset token đã được dùng.
 */
const markResetTokenUsed = async (tokenHash, client) => {
  await client.query(
    `UPDATE password_reset_tokens
     SET used_at = now()
     WHERE token_hash = $1`,
    [tokenHash]
  );
};

/**
 * Cập nhật mật khẩu user (bên trong transaction khi cần).
 */
const updatePassword = async (userId, newPasswordHash, client) => {
  await client.query(
    `UPDATE users
     SET password_hash = $1, updated_at = now()
     WHERE id = $2`,
    [newPasswordHash, userId]
  );
};

module.exports = {
  findByEmail,
  findById,
  createUser,
  initStreakRecord,
  savePasswordResetToken,
  findValidResetToken,
  markResetTokenUsed,
  updatePassword,
};
