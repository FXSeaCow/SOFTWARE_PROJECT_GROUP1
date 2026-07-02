/**
 * notifications.service.js
 * Business logic for in-app notifications.
 *
 * Responsibilities:
 *   - Create notifications manually or from templates.
 *   - List, read, and delete member notifications.
 *   - Broadcast announcements to many users.
 *   - Run notification jobs used by the scheduler.
 */

const repo = require('./notifications.repository');
const { renderTemplate } = require('./notification.templates');
const { parse: parsePagination } = require('../../utils/Pagination');
const ApiError = require('../../utils/Apierror');
const logger = require('../../utils/Logger');
const {
  NOTIFICATION_TYPE,
  NOTIFICATION_PRIORITY,
  NOTIFICATION_TEMPLATE,
  NOTIFICATION_LIMITS,
  NOTIFICATION_SCHEDULER,
} = require('./notifications.constants');

/**
 * Return a Date object N hours ago.
 *
 * @param {number} hours
 * @returns {Date}
 */
const hoursAgo = (hours) => {
  const date = new Date();
  date.setHours(date.getHours() - hours);
  return date;
};

/**
 * Normalize a notification payload before persistence.
 *
 * @param {object} data
 * @returns {object}
 */
const normalizeNotification = (data) => ({
  type: data.type || NOTIFICATION_TYPE.SYSTEM,
  priority: data.priority || NOTIFICATION_PRIORITY.NORMAL,
  title: data.title,
  message: data.message,
  data: data.data || {},
});

/**
 * Ensure the target user exists.
 *
 * @param {string} userId
 * @returns {Promise<object>}
 */
const requireUser = async (userId) => {
  const user = await repo.findUserById(userId);
  if (!user) throw ApiError.notFound('User');
  return user;
};

/**
 * Create one notification for one user.
 *
 * @param {string} userId
 * @param {{ type?, priority?, title, message, data? }} data
 * @returns {Promise<object>}
 */
const createNotification = async (userId, data) => {
  await requireUser(userId);

  const notification = await repo.createNotification({
    user_id: userId,
    ...normalizeNotification(data),
  });

  logger.info('Notification created', {
    notificationId: notification.id,
    userId,
    type: notification.type,
  });

  return notification;
};

/**
 * Create one notification from a named template.
 *
 * @param {string} userId
 * @param {string} templateKey
 * @param {object} context
 * @param {object} extraData
 * @returns {Promise<object>}
 */
const createFromTemplate = async (
  userId,
  templateKey,
  context = {},
  extraData = {}
) => {
  const rendered = renderTemplate(templateKey, context);

  return createNotification(userId, {
    ...rendered,
    data: {
      template: templateKey,
      context,
      ...extraData,
    },
  });
};

/**
 * List notifications for the authenticated member.
 *
 * @param {string} userId
 * @param {object} query
 * @returns {Promise<{ notifications: object[], total: number, page: number, limit: number }>}
 */
const listMyNotifications = async (userId, query = {}) => {
  const { page, limit, offset } = parsePagination(query);
  const { rows, total } = await repo.findAll({
    user_id: userId,
    type: query.type,
    is_read: query.is_read,
    limit,
    offset,
  });

  return {
    notifications: rows,
    total,
    page,
    limit,
  };
};

/**
 * Admin: list notifications across all users.
 *
 * @param {object} query
 * @returns {Promise<{ notifications: object[], total: number, page: number, limit: number }>}
 */
const listAllNotifications = async (query = {}) => {
  const { page, limit, offset } = parsePagination(query);
  const { rows, total } = await repo.findAll({
    user_id: query.user_id,
    type: query.type,
    is_read: query.is_read,
    limit,
    offset,
  });

  return {
    notifications: rows,
    total,
    page,
    limit,
  };
};

/**
 * Return one notification owned by a member.
 *
 * @param {string} notificationId
 * @param {string} userId
 * @returns {Promise<object>}
 */
const getMyNotificationById = async (notificationId, userId) => {
  const notification = await repo.findByIdAndUser(notificationId, userId);
  if (!notification) throw ApiError.notFound('Notification');
  return notification;
};

/**
 * Admin: return any notification by ID.
 *
 * @param {string} notificationId
 * @returns {Promise<object>}
 */
const getNotificationById = async (notificationId) => {
  const notification = await repo.findById(notificationId);
  if (!notification) throw ApiError.notFound('Notification');
  return notification;
};

/**
 * Count unread notifications for a member.
 *
 * @param {string} userId
 * @returns {Promise<{ unread_count: number }>}
 */
const getUnreadCount = async (userId) => {
  const unreadCount = await repo.countUnreadByUser(userId);
  return { unread_count: unreadCount };
};

/**
 * Mark one notification as read.
 *
 * @param {string} notificationId
 * @param {string} userId
 * @returns {Promise<object>}
 */
const markAsRead = async (notificationId, userId) => {
  const existing = await repo.findByIdAndUser(notificationId, userId);
  if (!existing) throw ApiError.notFound('Notification');

  if (existing.is_read) return existing;

  const updated = await repo.markAsRead(notificationId);
  logger.info('Notification marked as read', { notificationId, userId });
  return updated;
};

/**
 * Mark all unread notifications as read for a member.
 *
 * @param {string} userId
 * @returns {Promise<{ updated_count: number }>}
 */
const markAllAsRead = async (userId) => {
  const updatedCount = await repo.markAllAsRead(userId);
  logger.info('All notifications marked as read', { userId, updatedCount });
  return { updated_count: updatedCount };
};

/**
 * Delete one member-owned notification.
 *
 * @param {string} notificationId
 * @param {string} userId
 * @returns {Promise<void>}
 */
const deleteMyNotification = async (notificationId, userId) => {
  const existing = await repo.findByIdAndUser(notificationId, userId);
  if (!existing) throw ApiError.notFound('Notification');

  await repo.deleteByIdAndUser(notificationId, userId);
  logger.info('Notification deleted', { notificationId, userId });
};

/**
 * Admin: delete any notification.
 *
 * @param {string} notificationId
 * @returns {Promise<void>}
 */
const deleteNotification = async (notificationId) => {
  const existing = await repo.findById(notificationId);
  if (!existing) throw ApiError.notFound('Notification');

  await repo.deleteById(notificationId);
  logger.info('Notification deleted by admin', { notificationId });
};

/**
 * Broadcast a notification to all users or users matching a role.
 *
 * @param {{ role?, type?, priority?, title, message, data? }} data
 * @returns {Promise<{ audience_count: number, created_count: number, notifications: object[] }>}
 */
const broadcastNotification = async (data) => {
  const users = await repo.findUsers({ role: data.role });
  const userIds = users.map((user) => user.id);
  const payload = normalizeNotification({
    ...data,
    type: data.type || NOTIFICATION_TYPE.ANNOUNCEMENT,
  });

  const notifications = userIds.length
    ? await repo.createBulkNotifications(userIds, payload)
    : [];

  logger.info('Broadcast notification created', {
    role: data.role || 'all',
    audienceCount: userIds.length,
    createdCount: notifications.length,
  });

  return {
    audience_count: userIds.length,
    created_count: notifications.length,
    notifications,
  };
};

/**
 * Send membership expiry warnings and skip users warned recently.
 *
 * @param {number} warningDays
 * @returns {Promise<object>}
 */
const sendMembershipExpiryWarnings = async (
  warningDays = NOTIFICATION_SCHEDULER.MEMBERSHIP_WARNING_DAYS
) => {
  const memberships = await repo.findMembershipsExpiringSoon(warningDays);
  const since = hoursAgo(24);
  const created = [];
  let skipped = 0;

  for (const membership of memberships) {
    const recent = await repo.findRecentByType(
      membership.user_id,
      NOTIFICATION_TYPE.MEMBERSHIP_EXPIRING,
      since
    );

    if (recent) {
      skipped += 1;
      continue;
    }

    const notification = await createFromTemplate(
      membership.user_id,
      NOTIFICATION_TEMPLATE.MEMBERSHIP_EXPIRING,
      {
        days_remaining: membership.days_remaining,
        plan_name: membership.plan_name,
        end_date: membership.end_date,
      },
      {
        membership_id: membership.membership_id,
      }
    );
    created.push(notification);
  }

  logger.info('Membership expiry notification job completed', {
    scanned: memberships.length,
    created: created.length,
    skipped,
  });

  return {
    scanned_count: memberships.length,
    created_count: created.length,
    skipped_count: skipped,
    notifications: created,
  };
};

/**
 * Send streak warning notifications and skip users warned recently.
 *
 * @returns {Promise<object>}
 */
const sendStreakRiskWarnings = async () => {
  const streaks = await repo.findStreaksAtRisk();
  const since = hoursAgo(24);
  const created = [];
  let skipped = 0;

  for (const streak of streaks) {
    const recent = await repo.findRecentByType(
      streak.user_id,
      NOTIFICATION_TYPE.STREAK_AT_RISK,
      since
    );

    if (recent) {
      skipped += 1;
      continue;
    }

    const notification = await createFromTemplate(
      streak.user_id,
      NOTIFICATION_TEMPLATE.STREAK_AT_RISK,
      {
        last_active_date: streak.last_active_date,
        current_streak: streak.current_streak,
      }
    );
    created.push(notification);
  }

  logger.info('Streak risk notification job completed', {
    scanned: streaks.length,
    created: created.length,
    skipped,
  });

  return {
    scanned_count: streaks.length,
    created_count: created.length,
    skipped_count: skipped,
    notifications: created,
  };
};

/**
 * Delete old read notifications.
 *
 * @param {number} retentionDays
 * @returns {Promise<{ deleted_count: number, cutoff_date: Date }>}
 */
const cleanupOldReadNotifications = async (
  retentionDays = NOTIFICATION_LIMITS.DEFAULT_RETENTION_DAYS
) => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  const deletedCount = await repo.deleteOldReadNotifications(cutoffDate);
  logger.info('Old read notifications cleaned up', {
    retentionDays,
    deletedCount,
  });

  return {
    deleted_count: deletedCount,
    cutoff_date: cutoffDate,
  };
};

/**
 * Run notification jobs manually.
 *
 * @param {{ job?: string, retention_days?: number }} options
 * @returns {Promise<object>}
 */
const runNotificationJobs = async (options = {}) => {
  const job = options.job || 'all';
  const result = {};

  if (job === 'membership_expiry' || job === 'all') {
    result.membership_expiry = await sendMembershipExpiryWarnings();
  }

  if (job === 'streak_risk' || job === 'all') {
    result.streak_risk = await sendStreakRiskWarnings();
  }

  if (job === 'cleanup' || job === 'all') {
    result.cleanup = await cleanupOldReadNotifications(options.retention_days);
  }

  return result;
};

module.exports = {
  createNotification,
  createFromTemplate,
  listMyNotifications,
  listAllNotifications,
  getMyNotificationById,
  getNotificationById,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteMyNotification,
  deleteNotification,
  broadcastNotification,
  sendMembershipExpiryWarnings,
  sendStreakRiskWarnings,
  cleanupOldReadNotifications,
  runNotificationJobs,

  // Exported for focused unit tests.
  normalizeNotification,
};
