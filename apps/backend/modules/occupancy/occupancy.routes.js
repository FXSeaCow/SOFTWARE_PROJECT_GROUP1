/**
 * occupancy.routes.js
 * Registers gym occupancy endpoints.
 *
 * Base path when mounted in app.js: /api/occupancy
 *
 * Member/authenticated routes:
 *   GET  /api/occupancy/branches         - active branches with occupancy
 *   GET  /api/occupancy/branches/:branchId/active-members - active count
 *   GET  /api/occupancy/current          - current gym occupancy
 *   GET  /api/occupancy/me/sessions      - own gym session history
 *
 * Admin routes:
 *   POST /api/occupancy/checkin                    - check in scanned member
 *   POST /api/occupancy/checkout                   - check out scanned member
 *   GET  /api/occupancy/admin/branches             - list every branch (incl. inactive)
 *   POST /api/occupancy/admin/branches             - create a branch
 *   PATCH /api/occupancy/admin/branches/:branchId          - update a branch
 *   PATCH /api/occupancy/admin/branches/:branchId/status   - activate/deactivate a branch
 *   GET  /api/occupancy/admin/sessions             - all gym sessions
 *   GET  /api/occupancy/admin/daily-report         - daily occupancy report
 *   POST /api/occupancy/admin/reset-open-sessions  - close stale open sessions
 *
 * Member self-check-in/out is temporarily disabled — checkin/checkout are
 * admin-only for now (matches origin/dev). Re-enable by swapping
 * requireRole('admin') back to requireActiveMembership if self-checkin is
 * revisited later.
 */

const router = require('express').Router();
const ctrl = require('./occupancy.controller');

const { authenticate } = require('../../middlewares/Auth.middleware');
const { requireRole } = require('../../middlewares/Role.middleware');
const { validate } = require('../../middlewares/Validate.middleware');
const {
  uuidParam,
  checkInSchema,
  checkOutSchema,
  createBranchSchema,
  updateBranchSchema,
  setBranchActiveSchema,
  sessionsQuerySchema,
  adminSessionsQuerySchema,
  dailyReportQuerySchema,
  currentOccupancyQuerySchema,
  resetOpenSessionsSchema,
} = require('./occupancy.validation');

router.get('/branches', ctrl.listBranches); // Public route — no auth required, show in home page
router.get(
  '/branches/:branchId/active-members',
  validate(null, uuidParam('branchId')),
  ctrl.getBranchActiveMembers
);

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
  requireRole('admin'),
  validate(checkInSchema),
  ctrl.checkIn
);

// Alias for clients that prefer dashed route names.
router.post(
  '/check-in',
  requireRole('admin'),
  validate(checkInSchema),
  ctrl.checkIn
);

router.post(
  '/checkout',
  requireRole('admin'),
  validate(checkOutSchema),
  ctrl.checkOut
);

// Alias for clients that prefer dashed route names.
router.post(
  '/check-out',
  requireRole('admin'),
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
  '/admin/branches',
  requireRole('admin'),
  ctrl.listAllBranches
);

router.post(
  '/admin/branches',
  requireRole('admin'),
  validate(createBranchSchema),
  ctrl.createBranch
);

router.patch(
  '/admin/branches/:branchId',
  requireRole('admin'),
  validate(updateBranchSchema, uuidParam('branchId')),
  ctrl.updateBranch
);

router.patch(
  '/admin/branches/:branchId/status',
  requireRole('admin'),
  validate(setBranchActiveSchema, uuidParam('branchId')),
  ctrl.setBranchActive
);

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
