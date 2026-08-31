/**
 * notifications.constants.js
 * Shared constants for the notifications module.
 *
 * Constants keep route validation, templates, services, and scheduler jobs in
 * sync as the product adds more notification types.
 */

const { STREAK_LIMITS } = require('../streaks/streaks.constants');

/**
 * In-app notification types.
 */
const NOTIFICATION_TYPE = {
  WORKOUT_REMINDER: 'workout_reminder',
  MEMBERSHIP_EXPIRY: 'membership_expiry',
  OCCUPANCY_ALERT: 'occupancy_alert',
  ANNOUNCEMENT: 'announcement',
  SYSTEM: 'system',
  MEMBERSHIP: 'membership',
  SCHEDULE: 'schedule',
  STREAK_WARNING: 'streak_warning',
};

/**
 * Optional client-side severity labels.
 *
 * The current database schema does not store severity. Templates return it so
 * the frontend can style notification cards consistently.
 */
const NOTIFICATION_SEVERITY = {
  INFO: 'info',
  WARNING: 'warning',
  DANGER: 'danger',
};

/**
 * Template keys supported by notification.templates.js.
 */
const NOTIFICATION_TEMPLATE = {
  MEMBERSHIP_EXPIRY: 'membership_expiry',
  OCCUPANCY_ALERT: 'occupancy_alert',
  STREAK_WARNING: 'streak_warning',
  WORKOUT_REMINDER: 'workout_reminder',
  ANNOUNCEMENT: 'announcement',
};

/**
 * Pagination and retention defaults.
 */
const NOTIFICATION_LIMITS = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
  DEFAULT_RETENTION_DAYS: 90,
};

/**
 * Scheduler defaults.
 *
 * The scheduler is opt-in and should be started from server.js, not on import.
 */
const NOTIFICATION_SCHEDULER = {
  MEMBERSHIP_WARNING_DAYS: Number.parseInt(process.env.MEMBERSHIP_WARNING_DAYS, 10) || 7,
  STREAK_RESET_THRESHOLD_DAYS:
    Number.parseInt(process.env.STREAK_RESET_THRESHOLD_DAYS, 10) ||
    STREAK_LIMITS.BREAK_AFTER_INACTIVE_DAYS,
  TIME_ZONE: process.env.NOTIFICATION_TIME_ZONE || 'Asia/Ho_Chi_Minh',
  MEMBERSHIP_JOB_MS: Number.parseInt(process.env.NOTIFICATION_MEMBERSHIP_JOB_MS, 10) || 3600000,
  STREAK_JOB_MS: Number.parseInt(process.env.NOTIFICATION_STREAK_JOB_MS, 10) || 3600000,
  WORKOUT_REMINDER_DAILY_TIME: process.env.NOTIFICATION_WORKOUT_REMINDER_DAILY_TIME || '00:00',
  WORKOUT_REMINDER_JOB_MS: Number.parseInt(process.env.NOTIFICATION_WORKOUT_REMINDER_JOB_MS, 10) || 86400000,
  CLEANUP_JOB_MS: Number.parseInt(process.env.NOTIFICATION_CLEANUP_JOB_MS, 10) || 86400000,
};

/**
 * Controller response messages.
 */
const NOTIFICATION_MESSAGES = {
  CREATED: 'Notification created successfully',
  BROADCAST_CREATED: 'Broadcast notification created successfully',
  FETCHED: 'Notification fetched successfully',
  LIST_FETCHED: 'Notifications fetched successfully',
  UNREAD_COUNT_FETCHED: 'Unread notification count fetched successfully',
  MARKED_READ: 'Notification marked as read',
  ALL_MARKED_READ: 'All notifications marked as read',
  DELETED: 'Notification deleted successfully',
  JOB_COMPLETED: 'Notification job completed successfully',
};

module.exports = {
  NOTIFICATION_TYPE,
  NOTIFICATION_SEVERITY,
  NOTIFICATION_TEMPLATE,
  NOTIFICATION_LIMITS,
  NOTIFICATION_SCHEDULER,
  NOTIFICATION_MESSAGES,
};
