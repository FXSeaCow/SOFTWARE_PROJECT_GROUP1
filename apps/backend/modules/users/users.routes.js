/**
 * users.routes.js
 * Registers all user profile endpoints.
 *
 * Base path (mounted in app.js): /api/users
 *
 * Member routes (own profile):
 *   GET    /api/users/me                  — get own profile
 *   PATCH  /api/users/me                  — update own profile
 *   PATCH  /api/users/me/password         — change password
 *   GET    /api/users/me/qr               — get QR code image
 *   POST   /api/users/me/qr/regenerate    — regenerate QR token
 *
 * Admin routes:
 *   GET    /api/users                     — list all users
 *   GET    /api/users/:userId             — get any user by ID
 *   DELETE /api/users/:userId             — delete a user
 */

const router = require('express').Router();
const ctrl   = require('./users.controller');

const { authenticate }           = require('../../middlewares/Auth.middleware');
const { requireRole, requireSelf } = require('../../middlewares/Role.middleware');
const { validate }               = require('../../middlewares/Validate.middleware');
const {
  uuidParam,
  updateProfileSchema,
  changePasswordSchema,
  listUsersQuerySchema,
} = require('./users.validation');

// All users routes require authentication
router.use(authenticate);

// ── Member: own profile ───────────────────────────────────────────────────────

router.get('/me', ctrl.getMe);

router.patch(
  '/me',
  validate(updateProfileSchema),
  ctrl.updateMe
);

router.patch(
  '/me/password',
  validate(changePasswordSchema),
  ctrl.changePassword
);

// ── Member: QR code ───────────────────────────────────────────────────────────

router.get('/me/qr', ctrl.getMyQrCode);

router.post('/me/qr/regenerate', ctrl.regenerateMyQrCode);

// ── Admin: manage all users ───────────────────────────────────────────────────

router.get(
  '/',
  requireRole('admin'),
  validate(null, null, listUsersQuerySchema),
  ctrl.listUsers
);

router.get(
  '/:userId',
  requireRole('admin'),
  validate(null, uuidParam),
  ctrl.getUserById
);

router.delete(
  '/:userId',
  requireRole('admin'),
  validate(null, uuidParam),
  ctrl.deleteUser
);

module.exports = router;