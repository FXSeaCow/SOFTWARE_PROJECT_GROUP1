/**
 * notifications.routes.js
 * Registers notification endpoints.
 *
 * Base path when mounted in app.js: /api/notifications
 *
 * Member routes:
 *   GET    /api/notifications/me
 *   GET    /api/notifications/me/unread-count
 *   GET    /api/notifications/:notificationId
 *   PATCH  /api/notifications/:notificationId/read
 *   PATCH  /api/notifications/read-all
 *   DELETE /api/notifications/:notificationId
 *
 * Admin routes:
 *   GET    /api/notifications/admin
 *   GET    /api/notifications/admin/:notificationId
 *   POST   /api/notifications/admin
 *   POST   /api/notifications/admin/template
 *   POST   /api/notifications/admin/broadcast
 *   POST   /api/notifications/admin/run-jobs
 *   DELETE /api/notifications/admin/:notificationId
 */

const router = require('express').Router();
const ctrl = require('./notifications.controller');

const { authenticate } = require('../../middlewares/Auth.middleware');
const { requireRole } = require('../../middlewares/Role.middleware');
const { validate } = require('../../middlewares/Validate.middleware');
const {
  uuidParam,
  listMyNotificationsQuerySchema,
  listAllNotificationsQuerySchema,
  createNotificationSchema,
  createFromTemplateSchema,
  broadcastNotificationSchema,
  runJobsSchema,
} = require('./notifications.validation');

// Every notification route requires authentication.
router.use(authenticate);

// ---------------------------------------------------------------------------
// Admin routes
// ---------------------------------------------------------------------------

router.get(
  '/admin',
  requireRole('admin'),
  validate(null, null, listAllNotificationsQuerySchema),
  ctrl.listAllNotifications
);

router.post(
  '/admin',
  requireRole('admin'),
  validate(createNotificationSchema),
  ctrl.createNotification
);

router.post(
  '/admin/template',
  requireRole('admin'),
  validate(createFromTemplateSchema),
  ctrl.createFromTemplate
);

router.post(
  '/admin/broadcast',
  requireRole('admin'),
  validate(broadcastNotificationSchema),
  ctrl.broadcastNotification
);

router.post(
  '/admin/run-jobs',
  requireRole('admin'),
  validate(runJobsSchema),
  ctrl.runNotificationJobs
);

router.get(
  '/admin/:notificationId',
  requireRole('admin'),
  validate(null, uuidParam('notificationId')),
  ctrl.getNotificationById
);

router.delete(
  '/admin/:notificationId',
  requireRole('admin'),
  validate(null, uuidParam('notificationId')),
  ctrl.deleteNotification
);

// ---------------------------------------------------------------------------
// Member routes
// ---------------------------------------------------------------------------

router.get(
  '/me',
  validate(null, null, listMyNotificationsQuerySchema),
  ctrl.listMyNotifications
);

router.get('/me/unread-count', ctrl.getUnreadCount);

router.patch('/read-all', ctrl.markAllAsRead);

router.get(
  '/:notificationId',
  validate(null, uuidParam('notificationId')),
  ctrl.getMyNotificationById
);

router.patch(
  '/:notificationId/read',
  validate(null, uuidParam('notificationId')),
  ctrl.markAsRead
);

router.delete(
  '/:notificationId',
  validate(null, uuidParam('notificationId')),
  ctrl.deleteMyNotification
);

module.exports = router;
