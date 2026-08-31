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
  millisecondsUntilDailyTime: calculateMillisecondsUntilDailyTime,
} = require('../../utils/Timezone');
const {
  NOTIFICATION_LIMITS,
  NOTIFICATION_SCHEDULER,
} = require('./notifications.constants');

let schedulerState = {
  started: false,
  handles: [],
};

/**
 * Calculate how many milliseconds remain until the next configured HH:mm time.
 *
 * @param {string} dailyTime
 * @param {Date} now
 * @param {string} timeZone
 * @returns {number}
 */
const millisecondsUntilDailyTime = (
  dailyTime,
  now = new Date(),
  timeZone = NOTIFICATION_SCHEDULER.TIME_ZONE
) => {
  return calculateMillisecondsUntilDailyTime(dailyTime, now, timeZone);
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
 * Run the workout reminder notification job once.
 *
 * @returns {Promise<object>}
 */
const workoutReminderJob = async () => {
  return service.sendWorkoutReminderNotifications();
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
 * Schedule a job for the next configured daily time, then reschedule it.
 *
 * @param {string} jobName
 * @param {Function} job
 * @param {string} dailyTime
 * @param {string} timeZone
 * @returns {NodeJS.Timeout}
 */
const scheduleDailyJob = (
  jobName,
  job,
  dailyTime,
  timeZone = NOTIFICATION_SCHEDULER.TIME_ZONE
) => {
  const run = safeJob(jobName, job);
  const delay = millisecondsUntilDailyTime(dailyTime, new Date(), timeZone);

  return setTimeout(async () => {
    await run();

    if (!schedulerState.started) {
      return;
    }

    schedulerState.handles.push(
      scheduleDailyJob(jobName, job, dailyTime, timeZone)
    );
  }, delay);
};

/**
 * Start optional notification background jobs.
 *
 * @param {{ membershipExpiry?: boolean, streakRisk?: boolean, workoutReminder?: boolean, cleanup?: boolean }} options
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
    workoutReminder: options.workoutReminder !== false,
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

  if (config.workoutReminder) {
    schedulerState.handles.push(
      scheduleDailyJob(
        'workoutReminderJob',
        workoutReminderJob,
        NOTIFICATION_SCHEDULER.WORKOUT_REMINDER_DAILY_TIME,
        NOTIFICATION_SCHEDULER.TIME_ZONE
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

  logger.info('Notification scheduler started', {
    ...config,
    timeZone: NOTIFICATION_SCHEDULER.TIME_ZONE,
  });

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
  millisecondsUntilDailyTime,
  startNotificationScheduler,
  stopNotificationScheduler,
  membershipExpiryJob,
  streakRiskJob,
  workoutReminderJob,
  cleanupJob,
};
