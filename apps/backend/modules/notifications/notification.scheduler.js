/**
 * notification.scheduler.js
 * Optional background jobs for notification generation and cleanup.
 *
 * This module never starts jobs on import. Call startNotificationScheduler()
 * from server.js when the HTTP server is ready.
 */

const service = require('./notifications.service');
const logger = require('../../utils/Logger');
const {
  NOTIFICATION_LIMITS,
  NOTIFICATION_SCHEDULER,
} = require('./notifications.constants');

let schedulerState = {
  started: false,
  handles: [],
};

/**
 * Wrap an async scheduled job so errors are logged instead of crashing Node.
 *
 * @param {string} jobName
 * @param {Function} job
 * @returns {Function}
 */
const safeJob = (jobName, job) => async () => {
  try {
    await job();
  } catch (err) {
    logger.error(`Notification scheduler job failed: ${jobName}`, {
      error: err.message,
    });
  }
};

/**
 * Run the membership expiry notification job once.
 *
 * @returns {Promise<object>}
 */
const membershipExpiryJob = async () => {
  return service.sendMembershipExpiryWarnings(
    NOTIFICATION_SCHEDULER.MEMBERSHIP_WARNING_DAYS
  );
};

/**
 * Run the streak risk notification job once.
 *
 * @returns {Promise<object>}
 */
const streakRiskJob = async () => {
  return service.sendStreakRiskWarnings();
};

/**
 * Run read notification cleanup once.
 *
 * @returns {Promise<object>}
 */
const cleanupJob = async () => {
  return service.cleanupOldReadNotifications(
    NOTIFICATION_LIMITS.DEFAULT_RETENTION_DAYS
  );
};

/**
 * Start optional notification background jobs.
 *
 * @param {{ membershipExpiry?: boolean, streakRisk?: boolean, cleanup?: boolean }} options
 * @returns {{ stop: Function, state: object }}
 */
const startNotificationScheduler = (options = {}) => {
  if (schedulerState.started) {
    return {
      stop: stopNotificationScheduler,
      state: schedulerState,
    };
  }

  const config = {
    membershipExpiry: options.membershipExpiry !== false,
    streakRisk: options.streakRisk !== false,
    cleanup: options.cleanup !== false,
  };

  schedulerState.started = true;
  schedulerState.handles = [];

  if (config.membershipExpiry) {
    schedulerState.handles.push(
      setInterval(
        safeJob('membershipExpiryJob', membershipExpiryJob),
        NOTIFICATION_SCHEDULER.MEMBERSHIP_JOB_MS
      )
    );
  }

  if (config.streakRisk) {
    schedulerState.handles.push(
      setInterval(
        safeJob('streakRiskJob', streakRiskJob),
        NOTIFICATION_SCHEDULER.STREAK_JOB_MS
      )
    );
  }

  if (config.cleanup) {
    schedulerState.handles.push(
      setInterval(
        safeJob('cleanupJob', cleanupJob),
        NOTIFICATION_SCHEDULER.CLEANUP_JOB_MS
      )
    );
  }

  logger.info('Notification scheduler started', config);

  return {
    stop: stopNotificationScheduler,
    state: schedulerState,
  };
};

/**
 * Stop all notification scheduler intervals.
 */
const stopNotificationScheduler = () => {
  schedulerState.handles.forEach((handle) => clearInterval(handle));
  schedulerState = {
    started: false,
    handles: [],
  };

  logger.info('Notification scheduler stopped');
};

module.exports = {
  startNotificationScheduler,
  stopNotificationScheduler,
  membershipExpiryJob,
  streakRiskJob,
  cleanupJob,
};
