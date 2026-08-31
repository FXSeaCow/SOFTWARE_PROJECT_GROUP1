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
  dateOnlyInTimeZone,
  startOfDateInTimeZone,
} = require('../../utils/Timezone');
const {
  NOTIFICATION_TYPE,
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
 * Convert a Date or date string to YYYY-MM-DD using the scheduler timezone.
 *
 * @param {Date|string} value
 * @param {string} timeZone
 * @returns {string}
 */
const toDateOnlyString = (
  value = new Date(),
  timeZone = NOTIFICATION_SCHEDULER.TIME_ZONE
) => {
  return dateOnlyInTimeZone(value, timeZone);
};

/**
 * Return a Date object for midnight at the start of a scheduler calendar date.
 *
 * @param {Date|string} value
 * @param {string} timeZone
 * @returns {Date}
 */
const startOfLocalDate = (
  value = new Date(),
  timeZone = NOTIFICATION_SCHEDULER.TIME_ZONE
) => {
  return startOfDateInTimeZone(value, timeZone);
};

/**
 * Return a Date object at the start of the current scheduler day.
 *
 * @returns {Date}
 */
const startOfToday = () => {
  return startOfLocalDate();
};

/**
 * Normalize a notification payload before persistence.
 *
 * @param {object} data
 * @returns {object}
 */
const normalizeNotification = (data) => ({
  type: data.type || NOTIFICATION_TYPE.ANNOUNCEMENT,
  announcement_id: data.announcement_id || null,
  title: data.title,
  body: data.body || data.message || null,
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
 * @param {{ type?, title, body, announcement_id? }} data
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
    announcement_id: extraData.announcement_id || null,
  });
};

/**
 * Broadcast a templated notification to all users or users matching a role.
 *
 * @param {string} templateKey
 * @param {object} context
 * @param {{ role?, announcement_id? }} extraData
 * @returns {Promise<{ audience_count: number, created_count: number, notifications: object[] }>}
 */
const broadcastFromTemplate = async (
  templateKey,
  context = {},
  extraData = {}
) => {
  const rendered = renderTemplate(templateKey, context);

  return broadcastNotification({
    ...rendered,
    role: extraData.role,
    announcement_id: extraData.announcement_id || null,
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
 * @param {{ role?, type?, title, body, announcement_id? }} data
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
      NOTIFICATION_TYPE.MEMBERSHIP_EXPIRY,
      since
    );

    if (recent) {
      skipped += 1;
      continue;
    }

    const notification = await createFromTemplate(
      membership.user_id,
      NOTIFICATION_TEMPLATE.MEMBERSHIP_EXPIRY,
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
const sendStreakRiskWarnings = async (targetDate = toDateOnlyString()) => {
  const warningDate = toDateOnlyString(targetDate);
  const resetStreaks = await repo.resetStreaksPastThreshold(
    NOTIFICATION_SCHEDULER.STREAK_RESET_THRESHOLD_DAYS,
    warningDate
  );
  const streaks = await repo.findStreaksAtRisk(1, warningDate);
  const since = hoursAgo(24);
  const created = [];
  let skipped = 0;

  for (const streak of streaks) {
    const recent = await repo.findRecentByType(
      streak.user_id,
      NOTIFICATION_TYPE.STREAK_WARNING,
      since
    );

    if (recent) {
      skipped += 1;
      continue;
    }

    const notification = await createFromTemplate(
      streak.user_id,
      NOTIFICATION_TEMPLATE.STREAK_WARNING,
      {
        last_active_date: streak.last_active_date,
        current_streak: streak.current_streak,
      }
    );
    created.push(notification);
  }

  logger.info('Streak risk notification job completed', {
    warningDate,
    reset: resetStreaks.length,
    scanned: streaks.length,
    created: created.length,
    skipped,
  });

  return {
    warning_date: warningDate,
    reset_count: resetStreaks.length,
    reset_streaks: resetStreaks,
    scanned_count: streaks.length,
    created_count: created.length,
    skipped_count: skipped,
    notifications: created,
  };
};

/**
 * Send workout reminders to members who have not checked in today.
 *
 * Only the active workout plan is considered because that is the selected plan
 * for each member.
 *
 * @returns {Promise<object>}
 */
const sendWorkoutReminderNotifications = async (targetDate = toDateOnlyString()) => {
  const reminderDate = toDateOnlyString(targetDate);
  const recipients = await repo.findWorkoutReminderRecipients(reminderDate);
  const since = startOfLocalDate(reminderDate);
  const created = [];
  let skipped = 0;

  for (const recipient of recipients) {
    const recent = await repo.findRecentByType(
      recipient.user_id,
      NOTIFICATION_TYPE.WORKOUT_REMINDER,
      since
    );

    if (recent) {
      skipped += 1;
      continue;
    }

    const notification = await createFromTemplate(
      recipient.user_id,
      NOTIFICATION_TEMPLATE.WORKOUT_REMINDER,
      {
        plan_title: recipient.workout_plan_title,
        day_label: recipient.day_label,
        schedule_date: reminderDate,
      }
    );
    created.push(notification);
  }

  logger.info('Workout reminder notification job completed', {
    reminderDate,
    scanned: recipients.length,
    created: created.length,
    skipped,
  });

  return {
    reminder_date: reminderDate,
    scanned_count: recipients.length,
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

  if (job === 'workout_reminder' || job === 'all') {
    result.workout_reminder = await sendWorkoutReminderNotifications();
  }

  if (job === 'cleanup' || job === 'all') {
    result.cleanup = await cleanupOldReadNotifications(options.retention_days);
  }

  return result;
};

module.exports = {
  createNotification,
  createFromTemplate,
  broadcastFromTemplate,
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
  sendWorkoutReminderNotifications,
  cleanupOldReadNotifications,
  runNotificationJobs,

  // Exported for focused unit tests.
  normalizeNotification,
  toDateOnlyString,
  startOfLocalDate,
  startOfToday,
};
