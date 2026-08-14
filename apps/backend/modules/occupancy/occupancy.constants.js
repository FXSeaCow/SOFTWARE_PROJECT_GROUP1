/**
 * occupancy.constants.js
 * Shared constants for the gym occupancy module.
 *
 * These values are kept together so routes, services, calculators, and
 * schedulers all use the same capacity rules and response messages.
 */

/**
 * The default gym capacity.
 *
 * Set GYM_CAPACITY in .env to override this value without changing code.
 */
const DEFAULT_GYM_CAPACITY = Number.parseInt(process.env.GYM_CAPACITY, 10) || 100;

/**
 * Session status values used by API query filters.
 */
const SESSION_STATUS = {
  OPEN: 'open',
  CLOSED: 'closed',
  ALL: 'all',
};

/**
 * Check-in source values accepted by the API.
 *
 * self:   member checks in from their own authenticated session.
 * qr:     staff/admin scans a member QR token.
 * manual: staff/admin creates the event manually.
 */
const CHECKIN_SOURCE = {
  SELF: 'self',
  QR: 'qr',
  MANUAL: 'manual',
};

/**
 * Occupancy status buckets derived from occupancy rate.
 */
const OCCUPANCY_STATUS = {
  EMPTY: 'empty',
  NORMAL: 'normal',
  BUSY: 'busy',
  NEAR_FULL: 'near_full',
  FULL: 'full',
};

/**
 * Occupancy percentage thresholds.
 */
const OCCUPANCY_THRESHOLDS = {
  BUSY: 60,
  NEAR_FULL: 85,
  FULL: 100,
  ALERT: Number.parseInt(process.env.GYM_OCCUPANCY_ALERT_THRESHOLD, 10) || 90,
};

/**
 * Pagination boundaries for session list endpoints.
 */
const OCCUPANCY_LIMITS = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
};

/**
 * Scheduler defaults. The scheduler does not start automatically; server.js
 * can opt in by calling startOccupancyScheduler().
 */
const OCCUPANCY_SCHEDULER = {
  CACHE_REFRESH_MS: Number.parseInt(process.env.OCCUPANCY_CACHE_REFRESH_MS, 10) || 60000,
  CAPACITY_ALERT_MS: Number.parseInt(process.env.OCCUPANCY_ALERT_MS, 10) || 300000,
  DAILY_MAINTENANCE_MS: Number.parseInt(process.env.OCCUPANCY_DAILY_MAINTENANCE_MS, 10) || 3600000,
  DAILY_MAINTENANCE_HOUR: Number.parseInt(process.env.OCCUPANCY_DAILY_MAINTENANCE_HOUR, 10) || 0,
};

/**
 * Response messages used by controllers.
 */
const OCCUPANCY_MESSAGES = {
  BRANCHES_FETCHED: 'Gym branches fetched successfully',
  ADMIN_BRANCHES_FETCHED: 'Gym branches fetched successfully',
  BRANCH_CREATED: 'Gym branch created successfully',
  BRANCH_UPDATED: 'Gym branch updated successfully',
  BRANCH_DEACTIVATED: 'Gym branch deactivated successfully',
  BRANCH_REACTIVATED: 'Gym branch reactivated successfully',
  ACTIVE_MEMBERS_FETCHED: 'Active branch member count fetched successfully',
  CURRENT_FETCHED: 'Current occupancy fetched successfully',
  CHECKED_IN: 'Check-in completed successfully',
  CHECKED_OUT: 'Check-out completed successfully',
  MY_SESSIONS_FETCHED: 'Your gym sessions fetched successfully',
  SESSIONS_FETCHED: 'Gym sessions fetched successfully',
  DAILY_REPORT_FETCHED: 'Daily occupancy report fetched successfully',
  OPEN_SESSIONS_RESET: 'Open gym sessions reset successfully',
};

/**
 * Strict date-only format accepted by report and filter endpoints.
 */
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

module.exports = {
  DEFAULT_GYM_CAPACITY,
  SESSION_STATUS,
  CHECKIN_SOURCE,
  OCCUPANCY_STATUS,
  OCCUPANCY_THRESHOLDS,
  OCCUPANCY_LIMITS,
  OCCUPANCY_SCHEDULER,
  OCCUPANCY_MESSAGES,
  DATE_ONLY_PATTERN,
};
