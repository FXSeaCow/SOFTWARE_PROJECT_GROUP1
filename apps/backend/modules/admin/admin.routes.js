/**
 * admin.routes.js
 * Registers GymHub admin analytics endpoints.
 *
 * Base path when mounted in app.js: /api/admin
 */

const router = require('express').Router();
const ctrl = require('./admin.controller');

const { authenticate } = require('../../middlewares/Auth.middleware');
const { requireRole } = require('../../middlewares/Role.middleware');
const { validate } = require('../../middlewares/Validate.middleware');
const {
  dashboardQuerySchema,
  revenueReportQuerySchema,
  membershipsReportQuerySchema,
  occupancyReportQuerySchema,
  usersStatisticsQuerySchema,
  workoutsStatisticsQuerySchema,
  streaksStatisticsQuerySchema,
  paymentsStatisticsQuerySchema,
} = require('./admin.validation');

router.use(authenticate);
router.use(requireRole('admin'));

router.get(
  '/dashboard',
  validate(null, null, dashboardQuerySchema),
  ctrl.getDashboard
);

router.get(
  '/reports/revenue',
  validate(null, null, revenueReportQuerySchema),
  ctrl.getRevenueReport
);

router.get(
  '/reports/memberships',
  validate(null, null, membershipsReportQuerySchema),
  ctrl.getMembershipsReport
);

router.get(
  '/reports/occupancy',
  validate(null, null, occupancyReportQuerySchema),
  ctrl.getOccupancyReport
);

router.get(
  '/statistics/users',
  validate(null, null, usersStatisticsQuerySchema),
  ctrl.getUserStatistics
);

router.get(
  '/statistics/workouts',
  validate(null, null, workoutsStatisticsQuerySchema),
  ctrl.getWorkoutStatistics
);

router.get(
  '/statistics/streaks',
  validate(null, null, streaksStatisticsQuerySchema),
  ctrl.getStreakStatistics
);

router.get(
  '/statistics/payments',
  validate(null, null, paymentsStatisticsQuerySchema),
  ctrl.getPaymentStatistics
);

module.exports = router;
