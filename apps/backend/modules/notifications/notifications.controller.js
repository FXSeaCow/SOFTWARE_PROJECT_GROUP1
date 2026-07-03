/**
 * notifications.controller.js
 * HTTP layer for notification endpoints.
 *
 * Controllers parse req data, call services, and send standard ApiResponse
 * objects. They do not contain persistence or template logic.
 */

const service = require('./notifications.service');
const asyncHandler = require('../../utils/Asynchandler');
const ApiResponse = require('../../utils/Apiresponse');
const {
  NOTIFICATION_MESSAGES,
} = require('./notifications.constants');

/**
 * GET /api/notifications/me
 * List the authenticated member's notifications.
 */
const listMyNotifications = asyncHandler(async (req, res) => {
  const { notifications, total, page, limit } =
    await service.listMyNotifications(req.user.id, req.query);

  res.json(
    ApiResponse.paginated(
      notifications,
      total,
      page,
      limit,
      NOTIFICATION_MESSAGES.LIST_FETCHED
    )
  );
});

/**
 * GET /api/notifications/me/unread-count
 * Return unread notification count for the authenticated user.
 */
const getUnreadCount = asyncHandler(async (req, res) => {
  const result = await service.getUnreadCount(req.user.id);
  res.json(ApiResponse.success(result, NOTIFICATION_MESSAGES.UNREAD_COUNT_FETCHED));
});

/**
 * GET /api/notifications/:notificationId
 * Return one notification owned by the authenticated user.
 */
const getMyNotificationById = asyncHandler(async (req, res) => {
  const notification = await service.getMyNotificationById(
    req.params.notificationId,
    req.user.id
  );
  res.json(ApiResponse.success(notification, NOTIFICATION_MESSAGES.FETCHED));
});

/**
 * PATCH /api/notifications/:notificationId/read
 * Mark one notification as read.
 */
const markAsRead = asyncHandler(async (req, res) => {
  const notification = await service.markAsRead(
    req.params.notificationId,
    req.user.id
  );
  res.json(ApiResponse.success(notification, NOTIFICATION_MESSAGES.MARKED_READ));
});

/**
 * PATCH /api/notifications/read-all
 * Mark all notifications as read for the authenticated user.
 */
const markAllAsRead = asyncHandler(async (req, res) => {
  const result = await service.markAllAsRead(req.user.id);
  res.json(ApiResponse.success(result, NOTIFICATION_MESSAGES.ALL_MARKED_READ));
});

/**
 * DELETE /api/notifications/:notificationId
 * Delete one notification owned by the authenticated user.
 */
const deleteMyNotification = asyncHandler(async (req, res) => {
  await service.deleteMyNotification(req.params.notificationId, req.user.id);
  res.json(ApiResponse.success(null, NOTIFICATION_MESSAGES.DELETED));
});

/**
 * GET /api/notifications/admin
 * Admin lists notifications across all users.
 */
const listAllNotifications = asyncHandler(async (req, res) => {
  const { notifications, total, page, limit } =
    await service.listAllNotifications(req.query);

  res.json(
    ApiResponse.paginated(
      notifications,
      total,
      page,
      limit,
      NOTIFICATION_MESSAGES.LIST_FETCHED
    )
  );
});

/**
 * GET /api/notifications/admin/:notificationId
 * Admin reads any notification by ID.
 */
const getNotificationById = asyncHandler(async (req, res) => {
  const notification = await service.getNotificationById(req.params.notificationId);
  res.json(ApiResponse.success(notification, NOTIFICATION_MESSAGES.FETCHED));
});

/**
 * POST /api/notifications/admin
 * Admin creates one notification for one user.
 */
const createNotification = asyncHandler(async (req, res) => {
  const notification = await service.createNotification(req.body.user_id, req.body);
  res.status(201).json(
    ApiResponse.created(notification, NOTIFICATION_MESSAGES.CREATED)
  );
});

/**
 * POST /api/notifications/admin/template
 * Admin creates one templated notification for one user.
 */
const createFromTemplate = asyncHandler(async (req, res) => {
  const notification = await service.createFromTemplate(
    req.body.user_id,
    req.body.template,
    req.body.context,
    { announcement_id: req.body.announcement_id }
  );
  res.status(201).json(
    ApiResponse.created(notification, NOTIFICATION_MESSAGES.CREATED)
  );
});

/**
 * POST /api/notifications/admin/broadcast
 * Admin broadcasts one notification to all users or a role.
 */
const broadcastNotification = asyncHandler(async (req, res) => {
  const result = await service.broadcastNotification(req.body);
  res.status(201).json(
    ApiResponse.created(result, NOTIFICATION_MESSAGES.BROADCAST_CREATED)
  );
});

/**
 * DELETE /api/notifications/admin/:notificationId
 * Admin deletes any notification.
 */
const deleteNotification = asyncHandler(async (req, res) => {
  await service.deleteNotification(req.params.notificationId);
  res.json(ApiResponse.success(null, NOTIFICATION_MESSAGES.DELETED));
});

/**
 * POST /api/notifications/admin/run-jobs
 * Admin manually triggers notification jobs.
 */
const runNotificationJobs = asyncHandler(async (req, res) => {
  const result = await service.runNotificationJobs(req.body);
  res.json(ApiResponse.success(result, NOTIFICATION_MESSAGES.JOB_COMPLETED));
});

module.exports = {
  listMyNotifications,
  getUnreadCount,
  getMyNotificationById,
  markAsRead,
  markAllAsRead,
  deleteMyNotification,
  listAllNotifications,
  getNotificationById,
  createNotification,
  createFromTemplate,
  broadcastNotification,
  deleteNotification,
  runNotificationJobs,
};
