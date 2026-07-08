/**
 * fitness-records.routes.js
 * Registers fitness measurement endpoints.
 *
 * Base path when mounted in app.js: /api/fitness-records
 *
 * Member routes:
 *   POST   /api/fitness-records                  - create a measurement record
 *   GET    /api/fitness-records/me               - list own records
 *   GET    /api/fitness-records/me/latest        - latest own record
 *   GET    /api/fitness-records/me/progress      - own progress analysis
 *   GET    /api/fitness-records/:recordId        - read own record
 *   PATCH  /api/fitness-records/:recordId        - update own record
 *   DELETE /api/fitness-records/:recordId        - delete own record
 *
 * Admin routes:
 *   GET    /api/fitness-records/admin                    - list all records
 *   GET    /api/fitness-records/admin/:recordId          - read any record
 *   GET    /api/fitness-records/admin/users/:userId/progress - user progress
 */

const router = require('express').Router();
const ctrl = require('./fitness-records.controller');

const { authenticate } = require('../../middlewares/Auth.middleware');
const { requireRole } = require('../../middlewares/Role.middleware');
const { requireActiveMembership } = require('../../middlewares/Membership.middleware');
const { validate } = require('../../middlewares/Validate.middleware');
const {
  uuidParam,
  createRecordSchema,
  updateRecordSchema,
  listRecordsQuerySchema,
  progressQuerySchema,
  adminRecordsQuerySchema,
} = require('./fitness-records.validation');

// Every fitness record endpoint requires authentication.
router.use(authenticate);

// ---------------------------------------------------------------------------
// Admin routes
// ---------------------------------------------------------------------------

router.get(
  '/admin',
  requireRole('admin'),
  validate(null, null, adminRecordsQuerySchema),
  ctrl.listAllRecords
);

router.get(
  '/admin/users/:userId/progress',
  requireRole('admin'),
  validate(null, uuidParam('userId'), progressQuerySchema),
  ctrl.getUserProgress
);

router.get(
  '/admin/:recordId',
  requireRole('admin'),
  validate(null, uuidParam('recordId')),
  ctrl.getRecordById
);

// ---------------------------------------------------------------------------
// Member routes
// ---------------------------------------------------------------------------

router.use(requireActiveMembership);

router.post(
  '/',
  validate(createRecordSchema),
  ctrl.createRecord
);

router.get(
  '/me',
  validate(null, null, listRecordsQuerySchema),
  ctrl.listMyRecords
);

router.get('/me/latest', ctrl.getLatestRecord);

router.get(
  '/me/progress',
  validate(null, null, progressQuerySchema),
  ctrl.getMyProgress
);

router.get(
  '/:recordId',
  validate(null, uuidParam('recordId')),
  ctrl.getMyRecordById
);

router.patch(
  '/:recordId',
  validate(updateRecordSchema, uuidParam('recordId')),
  ctrl.updateRecord
);

router.delete(
  '/:recordId',
  validate(null, uuidParam('recordId')),
  ctrl.deleteRecord
);

module.exports = router;
