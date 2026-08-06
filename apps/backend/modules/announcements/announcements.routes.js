const router = require('express').Router();
const ctrl = require('./announcements.controller');

const { authenticate } = require('../../middlewares/Auth.middleware');
const { requireRole } = require('../../middlewares/Role.middleware');
const { validate } = require('../../middlewares/Validate.middleware');
const { createAnnouncementSchema } = require('./announcements.validation');

router.use(authenticate);

router.get('/admin', requireRole('admin'), ctrl.listAdminAnnouncements);

router.post(
  '/admin',
  requireRole('admin'),
  validate(createAnnouncementSchema),
  ctrl.createAdminAnnouncement
);

module.exports = router;
