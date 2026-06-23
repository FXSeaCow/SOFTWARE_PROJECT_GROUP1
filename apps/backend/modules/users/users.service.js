/**
 * users.service.js
 * Business logic for user profile operations.
 * Orchestrates repository calls, hashing, and QR generation.
 */

const repo                        = require('./users.repository');
const { generateQRDataURL }       = require('../../utils/Qrcode');
const { comparePassword,
        hashPassword }            = require('../../utils/Hash');
const ApiError                    = require('../../utils/Apierror');
const logger                      = require('../../utils/Logger');
const { parse: parsePagination }  = require('../../utils/Pagination');

// ─── Get own profile ──────────────────────────────────────────────────────────

/**
 * Return the authenticated user's profile.
 *
 * @param {string} userId
 * @returns {Promise<object>}
 */
const getProfile = async (userId) => {
  const user = await repo.findById(userId);
  if (!user) throw ApiError.notFound('User');
  return user;
};

// ─── Update own profile ───────────────────────────────────────────────────────

/**
 * Update the authenticated user's full_name and/or phone.
 *
 * @param {string} userId
 * @param {{ full_name?, phone? }} fields
 * @returns {Promise<object>} updated user
 */
const updateProfile = async (userId, fields) => {
  const user = await repo.findById(userId);
  if (!user) throw ApiError.notFound('User');

  const updated = await repo.updateProfile(userId, fields);
  logger.info('User profile updated', { userId });
  return updated;
};

// ─── Change password ──────────────────────────────────────────────────────────

/**
 * Change the authenticated user's password.
 * Verifies current password before applying the new one.
 *
 * @param {string} userId
 * @param {{ current_password, new_password }} data
 */
const changePassword = async (userId, { current_password, new_password }) => {
  // 1. Fetch user with hash (separate query from normal profile fetch)
  const user = await repo.findByIdWithHash(userId);
  if (!user) throw ApiError.notFound('User');

  // 2. Verify current password
  const isMatch = await comparePassword(current_password, user.password_hash);
  if (!isMatch) {
    throw ApiError.badRequest('Current password is incorrect');
  }

  // 3. Prevent reusing the same password
  const isSame = await comparePassword(new_password, user.password_hash);
  if (isSame) {
    throw ApiError.badRequest('New password must be different from the current password');
  }

  // 4. Hash and update
  const newHash = await hashPassword(new_password);
  await repo.updatePassword(userId, newHash);

  logger.info('Password changed', { userId });
};

// ─── Get QR code ─────────────────────────────────────────────────────────────

/**
 * Generate and return a QR code data URL for the member's check-in token.
 * Used to display the QR image in the frontend (FR-17, FR-18).
 *
 * @param {string} userId
 * @returns {Promise<{ qrCode: string }>} base64 data URL
 */
const getQrCode = async (userId) => {
  const user = await repo.findById(userId);
  if (!user) throw ApiError.notFound('User');

  const qrCode = await generateQRDataURL(user.qr_code_token);
  return { qrCode };
};

/**
 * Regenerate the member's QR token, invalidating any previously printed QR.
 * Useful if the member suspects their QR was shared or compromised.
 *
 * @param {string} userId
 * @returns {Promise<{ qrCode: string }>} new base64 data URL
 */
const regenerateQrCode = async (userId) => {
  const { qr_code_token } = await repo.regenerateQrToken(userId);
  const qrCode = await generateQRDataURL(qr_code_token);

  logger.info('QR code regenerated', { userId });
  return { qrCode };
};

// ─── Admin: list all users ────────────────────────────────────────────────────

/**
 * List all users with optional filters. Admin-only.
 *
 * @param {{ role?, search?, page?, limit? }} query - req.query
 * @returns {Promise<{ users: object[], total: number, page, limit }>}
 */
const listUsers = async (query) => {
  const { page, limit, offset } = parsePagination(query);
  const { rows, total } = await repo.findAll({
    role:   query.role,
    search: query.search,
    limit,
    offset,
  });

  return { users: rows, total, page, limit };
};

// ─── Admin: get any user by ID ────────────────────────────────────────────────

/**
 * Return any user's profile by ID. Admin-only.
 *
 * @param {string} userId
 * @returns {Promise<object>}
 */
const getUserById = async (userId) => {
  const user = await repo.findById(userId);
  if (!user) throw ApiError.notFound('User');
  return user;
};

const updateUserRole = async (userId, role, requestingAdminId) => {
  const user = await repo.findById(userId);
  if (!user) throw ApiError.notFound('User');

  if (userId === requestingAdminId && role !== 'admin') {
    throw ApiError.badRequest('Admins cannot remove their own admin role');
  }

  const updated = await repo.updateRole(userId, role);
  logger.info('User role updated', { userId, role, byAdmin: requestingAdminId });
  return updated;
};

const updateUserAccountStatus = async (userId, accountStatus, requestingAdminId) => {
  const user = await repo.findById(userId);
  if (!user) throw ApiError.notFound('User');

  if (userId === requestingAdminId && accountStatus === 'locked') {
    throw ApiError.badRequest('Admins cannot lock their own account');
  }

  const updated = await repo.updateAccountStatus(userId, accountStatus);
  logger.info('User account status updated', { userId, accountStatus, byAdmin: requestingAdminId });
  return updated;
};

// ─── Admin: delete a user ─────────────────────────────────────────────────────

/**
 * Permanently delete a user account. Admin-only.
 * Cascades to all related data via ON DELETE CASCADE.
 *
 * @param {string} userId
 * @param {string} requestingAdminId - prevent self-deletion
 */
const deleteUser = async (userId, requestingAdminId) => {
  if (userId === requestingAdminId) {
    throw ApiError.badRequest('Admins cannot delete their own account');
  }

  const user = await repo.findById(userId);
  if (!user) throw ApiError.notFound('User');

  await repo.deleteUser(userId);
  logger.info('User deleted', { deletedUserId: userId, byAdmin: requestingAdminId });
};

module.exports = {
  getProfile,
  updateProfile,
  changePassword,
  getQrCode,
  regenerateQrCode,
  listUsers,
  getUserById,
  updateUserRole,
  updateUserAccountStatus,
  deleteUser,
};
