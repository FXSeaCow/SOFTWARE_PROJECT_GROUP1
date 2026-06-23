/**
 * users.controller.js
 * HTTP layer for user profile operations.
 * Parses req, calls service, sends res. Zero business logic.
 */

const usersService = require('./users.service');
const asyncHandler = require('../../utils/Asynchandler');
const ApiResponse  = require('../../utils/Apiresponse');

// ─── Member: own profile ──────────────────────────────────────────────────────

/**
 * GET /api/users/me
 * Return the authenticated user's own profile.
 */
const getMe = asyncHandler(async (req, res) => {
  const user = await usersService.getProfile(req.user.id);
  res.json(ApiResponse.success(user));
});

/**
 * PATCH /api/users/me
 * Update the authenticated user's full_name and/or phone.
 */
const updateMe = asyncHandler(async (req, res) => {
  const updated = await usersService.updateProfile(req.user.id, req.body);
  res.json(ApiResponse.success(updated, 'Profile updated successfully'));
});

/**
 * PATCH /api/users/me/password
 * Change the authenticated user's password.
 */
const changePassword = asyncHandler(async (req, res) => {
  const { current_password, new_password } = req.body;
  await usersService.changePassword(req.user.id, { current_password, new_password });
  res.json(ApiResponse.success(null, 'Password changed successfully'));
});

// ─── Member: QR code ─────────────────────────────────────────────────────────

/**
 * GET /api/users/me/qr
 * Return the QR code image (base64 data URL) for gym check-in.
 */
const getMyQrCode = asyncHandler(async (req, res) => {
  const result = await usersService.getQrCode(req.user.id);
  res.json(ApiResponse.success(result));
});

/**
 * POST /api/users/me/qr/regenerate
 * Regenerate the QR token, invalidating any previously issued QR images.
 */
const regenerateMyQrCode = asyncHandler(async (req, res) => {
  const result = await usersService.regenerateQrCode(req.user.id);
  res.json(ApiResponse.success(result, 'QR code regenerated successfully'));
});



//////////////////////////////////////////////////////////////////////////////////
// ─── Admin: manage all users ──────────────────────────────────────────────────
//////////////////////////////////////////////////////////////////////////////////

/**
 * GET /api/users
 * List all users with optional role/search filters. Admin-only.
 */
const listUsers = asyncHandler(async (req, res) => {
  const { users, total, page, limit } = await usersService.listUsers(req.query);
  res.json(ApiResponse.paginated(users, total, page, limit));
});

/**
 * GET /api/users/:userId
 * Get any user's profile by ID. Admin-only.
 */
const getUserById = asyncHandler(async (req, res) => {
  const user = await usersService.getUserById(req.params.userId);
  res.json(ApiResponse.success(user));
});

const updateUserRole = asyncHandler(async (req, res) => {
  const user = await usersService.updateUserRole(
    req.params.userId,
    req.body.role,
    req.user.id
  );
  res.json(ApiResponse.success(user, 'User role updated successfully'));
});

const updateUserAccountStatus = asyncHandler(async (req, res) => {
  const user = await usersService.updateUserAccountStatus(
    req.params.userId,
    req.body.account_status,
    req.user.id
  );
  res.json(ApiResponse.success(user, 'User account status updated successfully'));
});

/**
 * DELETE /api/users/:userId
 * Permanently delete a user account. Admin-only.
 */
const deleteUser = asyncHandler(async (req, res) => {
  await usersService.deleteUser(req.params.userId, req.user.id);
  res.json(ApiResponse.success(null, 'User deleted successfully'));
});

module.exports = {
  getMe,
  updateMe,
  changePassword,
  getMyQrCode,
  regenerateMyQrCode,
  listUsers,
  getUserById,
  updateUserRole,
  updateUserAccountStatus,
  deleteUser,
};
