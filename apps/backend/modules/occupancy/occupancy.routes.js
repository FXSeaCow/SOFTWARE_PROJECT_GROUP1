/**
 * occupancy.routes.js
 * Registers gym occupancy endpoints.
 *
 * Base path when mounted in app.js: /api/occupancy
 *
 * Member/authenticated routes:
 *   GET  /api/occupancy/branches         - active branches with occupancy
 *   GET  /api/occupancy/current          - current gym occupancy
 *   POST /api/occupancy/checkin          - check in by self or QR token
 *   POST /api/occupancy/checkout         - check out by self or QR token
 *   GET  /api/occupancy/me/sessions      - own gym session history
 *
 * Admin routes:
 *   GET  /api/occupancy/admin/sessions             - all gym sessions
 *   GET  /api/occupancy/admin/daily-report         - daily occupancy report
 *   POST /api/occupancy/admin/reset-open-sessions  - close stale open sessions
 */

const router = require('express').Router();
const ctrl = require('./occupancy.controller');

const { authenticate } = require('../../middlewares/Auth.middleware');
const { requireRole } = require('../../middlewares/Role.middleware');
const { requireActiveMembership } = require('../../middlewares/Membership.middleware');
const { validate } = require('../../middlewares/Validate.middleware');
const {
  checkInSchema,
  checkOutSchema,
  sessionsQuerySchema,
  adminSessionsQuerySchema,
  dailyReportQuerySchema,
  currentOccupancyQuerySchema,
  resetOpenSessionsSchema,
} = require('./occupancy.validation');

router.get('/branches', ctrl.listBranches); // Public route — no auth required, show in home page


// Every occupancy endpoint requires authentication.
router.use(authenticate);

// ---------------------------------------------------------------------------
// Member/authenticated routes
// ---------------------------------------------------------------------------


router.get(
  '/current',
  validate(null, null, currentOccupancyQuerySchema),
  ctrl.getCurrentOccupancy
);

router.post(
  '/checkin',
  requireActiveMembership,
  validate(checkInSchema),
  ctrl.checkIn
);

// Alias for clients that prefer dashed route names.
router.post(
  '/check-in',
  requireActiveMembership,
  validate(checkInSchema),
  ctrl.checkIn
);

router.post(
  '/checkout',
  validate(checkOutSchema),
  ctrl.checkOut
);

// Alias for clients that prefer dashed route names.
router.post(
  '/check-out',
  validate(checkOutSchema),
  ctrl.checkOut
);

router.get(
  '/me/sessions',
  validate(null, null, sessionsQuerySchema),
  ctrl.listMySessions
);

// ---------------------------------------------------------------------------
// Admin routes
// ---------------------------------------------------------------------------

router.get(
  '/admin/sessions',
  requireRole('admin'),
  validate(null, null, adminSessionsQuerySchema),
  ctrl.listSessions
);

router.get(
  '/admin/daily-report',
  requireRole('admin'),
  validate(null, null, dailyReportQuerySchema),
  ctrl.getDailyReport
);

router.post(
  '/admin/reset-open-sessions',
  requireRole('admin'),
  validate(resetOpenSessionsSchema),
  ctrl.resetOpenSessions
);

module.exports = router;
