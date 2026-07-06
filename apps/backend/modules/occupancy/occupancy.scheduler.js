/**
 * occupancy.scheduler.js
 * Optional background jobs for occupancy maintenance.
 *
 * This module never starts jobs on import. Call startOccupancyScheduler()
 * from server.js when the HTTP server is ready.
 *
 * Supported jobs:
 *   - Refresh an in-process occupancy cache.
 *   - Warn logs when any branch is near/full capacity.
 *   - Run daily maintenance: close stale open sessions and build a report.
 */

const service = require('./occupancy.service');
const logger = require('../../utils/Logger');
const {
  OCCUPANCY_THRESHOLDS,
  OCCUPANCY_SCHEDULER,
} = require('./occupancy.constants');

let schedulerState = {
  started: false,
  handles: [],
  last_daily_run_date: null,
};

/**
 * Convert a Date into local YYYY-MM-DD.
 *
 * @param {Date} date
 * @returns {string}
 */
const toDateOnlyString = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Return yesterday as YYYY-MM-DD.
 *
 * @returns {string}
 */
const getYesterdayDateString = () => {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return toDateOnlyString(date);
};

/**
 * Refresh the occupancy cache once.
 *
 * @returns {Promise<object>}
 */
const refreshCacheJob = async () => {
  const cache = await service.refreshOccupancyCache();
  logger.info('Occupancy cache refreshed', {
    occupancyRate: cache.data.occupancy_rate,
    currentOccupancy: cache.data.current_occupancy,
    totalBranches: cache.data.total_branches,
  });
  return cache;
};

/**
 * Check whether any branch occupancy is above the alert threshold.
 *
 * Member-facing alerts are created during check-in attempts. This scheduler is
 * intentionally focused on operational logs and cache-friendly snapshots.
 *
 * @returns {Promise<object>}
 */
const capacityAlertJob = async () => {
  const occupancy = await service.getCurrentOccupancy();
  const branches = occupancy.branches || [occupancy];

  branches
    .filter((branch) => branch.occupancy_rate >= OCCUPANCY_THRESHOLDS.ALERT)
    .forEach((branch) => {
      logger.warn('Branch occupancy alert threshold reached', {
        branchId: branch.branch_id,
        branchName: branch.branch_name,
        currentOccupancy: branch.current_occupancy,
        capacity: branch.capacity,
        occupancyRate: branch.occupancy_rate,
        threshold: OCCUPANCY_THRESHOLDS.ALERT,
      });
    });

  return occupancy;
};

/**
 * Run nightly maintenance once.
 *
 * The report is generated for yesterday. Open sessions are closed at the
 * current timestamp so the next day starts clean.
 *
 * @returns {Promise<{ report: object, reset: object }>}
 */
const dailyMaintenanceJob = async () => {
  const reportDate = getYesterdayDateString();
  const report = await service.getDailyReport({ date: reportDate });
  const reset = await service.resetOpenSessions();

  logger.info('Daily occupancy maintenance completed', {
    reportDate,
    totalVisits: report.total_visits,
    closedSessions: reset.closed_count,
  });

  return { report, reset };
};

/**
 * Check whether daily maintenance should run during this tick.
 *
 * @returns {Promise<void>}
 */
const dailyMaintenanceTick = async () => {
  const now = new Date();
  const today = toDateOnlyString(now);

  if (now.getHours() !== OCCUPANCY_SCHEDULER.DAILY_MAINTENANCE_HOUR) return;
  if (schedulerState.last_daily_run_date === today) return;

  schedulerState.last_daily_run_date = today;
  await dailyMaintenanceJob();
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
    logger.error(`Occupancy scheduler job failed: ${jobName}`, {
      error: err.message,
    });
  }
};

/**
 * Start optional occupancy background jobs.
 *
 * @param {{ cache?: boolean, alerts?: boolean, dailyMaintenance?: boolean }} options
 * @returns {{ stop: Function, state: object }}
 */
const startOccupancyScheduler = (options = {}) => {
  if (schedulerState.started) {
    return {
      stop: stopOccupancyScheduler,
      state: schedulerState,
    };
  }

  const config = {
    cache: options.cache !== false,
    alerts: options.alerts !== false,
    dailyMaintenance: options.dailyMaintenance !== false,
  };

  schedulerState.started = true;
  schedulerState.handles = [];

  if (config.cache) {
    schedulerState.handles.push(
      setInterval(
        safeJob('refreshCacheJob', refreshCacheJob),
        OCCUPANCY_SCHEDULER.CACHE_REFRESH_MS
      )
    );
  }

  if (config.alerts) {
    schedulerState.handles.push(
      setInterval(
        safeJob('capacityAlertJob', capacityAlertJob),
        OCCUPANCY_SCHEDULER.CAPACITY_ALERT_MS
      )
    );
  }

  if (config.dailyMaintenance) {
    schedulerState.handles.push(
      setInterval(
        safeJob('dailyMaintenanceTick', dailyMaintenanceTick),
        OCCUPANCY_SCHEDULER.DAILY_MAINTENANCE_MS
      )
    );
  }

  logger.info('Occupancy scheduler started', config);

  return {
    stop: stopOccupancyScheduler,
    state: schedulerState,
  };
};

/**
 * Stop all occupancy scheduler intervals.
 */
const stopOccupancyScheduler = () => {
  schedulerState.handles.forEach((handle) => clearInterval(handle));
  schedulerState = {
    started: false,
    handles: [],
    last_daily_run_date: schedulerState.last_daily_run_date,
  };

  logger.info('Occupancy scheduler stopped');
};

module.exports = {
  startOccupancyScheduler,
  stopOccupancyScheduler,
  refreshCacheJob,
  capacityAlertJob,
  dailyMaintenanceJob,
};
