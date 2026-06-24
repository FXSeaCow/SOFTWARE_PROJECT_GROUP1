const service = require('./announcements.service');
const asyncHandler = require('../../utils/Asynchandler');
const ApiResponse = require('../../utils/Apiresponse');

const listAdminAnnouncements = asyncHandler(async (req, res) => {
  const announcements = await service.listAnnouncementHistory();
  res.json(ApiResponse.success(announcements));
});

const listMyNotifications = asyncHandler(async (req, res) => {
  const notifications = await service.listMyNotifications(req.user.id);
  res.json(ApiResponse.success(notifications));
});

const markMyNotificationAsRead = asyncHandler(async (req, res) => {
  const notification = await service.markMyNotificationAsRead(req.params.notificationId, req.user.id);
  res.json(ApiResponse.success(notification, 'Notification marked as read'));
});

const markAllMyNotificationsAsRead = asyncHandler(async (req, res) => {
  const result = await service.markAllMyNotificationsAsRead(req.user.id);
  res.json(ApiResponse.success(result, 'All notifications marked as read'));
});

const createAdminAnnouncement = asyncHandler(async (req, res) => {
  const announcement = await service.createAnnouncement(req.user, req.body);
  res.status(201).json(
    ApiResponse.created(announcement, 'Announcement published successfully')
  );
});

module.exports = {
  listAdminAnnouncements,
  listMyNotifications,
  markMyNotificationAsRead,
  markAllMyNotificationsAsRead,
  createAdminAnnouncement,
};
