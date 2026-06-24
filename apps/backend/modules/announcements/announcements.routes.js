const router = require('express').Router();
const ctrl = require('./announcements.controller');

const { authenticate } = require('../../middlewares/Auth.middleware');
const { requireRole } = require('../../middlewares/Role.middleware');
const { validate } = require('../../middlewares/Validate.middleware');
const { createAnnouncementSchema, notificationIdParam } = require('./announcements.validation');

router.use(authenticate);

router.get('/me', ctrl.listMyNotifications);

router.patch(
  '/me/read-all',
  ctrl.markAllMyNotificationsAsRead
);

router.patch(
  '/me/:notificationId/read',
  validate(null, notificationIdParam),
  ctrl.markMyNotificationAsRead
);

router.get('/admin', requireRole('admin'), ctrl.listAdminAnnouncements);

router.post(
  '/admin',
  requireRole('admin'),
  validate(createAnnouncementSchema),
  ctrl.createAdminAnnouncement
);

module.exports = router;
