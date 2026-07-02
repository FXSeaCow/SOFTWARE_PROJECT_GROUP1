/**
 * streaks.routes.js
 * Registers all workout streak endpoints.
 *
 * Base path when mounted in app.js: /api/streaks
 *
 * Member routes:
 *   GET  /api/streaks/me                 - current member streak summary
 *   GET  /api/streaks/me/checkins        - current member check-in history
 *   POST /api/streaks/checkins           - record a workout check-in
 *   GET  /api/streaks/leaderboard        - public streak leaderboard
 *
 * Admin routes:
 *   GET  /api/streaks/admin/:userId              - inspect a user's streak
 *   POST /api/streaks/admin/:userId/recalculate  - rebuild streak counters
 */

const router = require('express').Router();
const ctrl = require('./streaks.controller');

const { authenticate } = require('../../middlewares/Auth.middleware');
const { requireRole } = require('../../middlewares/Role.middleware');
const { validate } = require('../../middlewares/Validate.middleware');
const {
  uuidParam,
  recordCheckinSchema,
  checkinsQuerySchema,
  leaderboardQuerySchema,
} = require('./streaks.validation');

// Every streak route requires a valid logged-in user.
router.use(authenticate);

// ---------------------------------------------------------------------------
// Member routes
// ---------------------------------------------------------------------------

router.get('/me', ctrl.getMyStreak);

router.get(
  '/me/checkins',
  validate(null, null, checkinsQuerySchema),
  ctrl.listMyCheckins
);

router.post(
  '/checkins',
  validate(recordCheckinSchema),
  ctrl.recordCheckin
);

router.get(
  '/leaderboard',
  validate(null, null, leaderboardQuerySchema),
  ctrl.getLeaderboard
);

// ---------------------------------------------------------------------------
// Admin routes
// ---------------------------------------------------------------------------

router.get(
  '/admin/:userId',
  requireRole('admin'),
  validate(null, uuidParam('userId')),
  ctrl.getUserStreak
);

router.post(
  '/admin/:userId/recalculate',
  requireRole('admin'),
  validate(null, uuidParam('userId')),
  ctrl.recalculateUserStreak
);

module.exports = router;
