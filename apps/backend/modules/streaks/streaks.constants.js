/**
 * streaks.constants.js
 * Shared constants for the streaks module.
 *
 * Keeping these values in one file prevents route, validation, and service
 * layers from drifting apart when the streak rules change later.
 */

/**
 * Public streak states returned by the API.
 *
 * not_started: the member has no workout check-ins yet.
 * active:      the member checked in today.
 * at_risk:     the member checked in yesterday but not today.
 * broken:      the member missed at least one full day after the last check-in.
 */
const STREAK_STATUS = {
  NOT_STARTED: 'not_started',
  ACTIVE: 'active',
  AT_RISK: 'at_risk',
  BROKEN: 'broken',
};

/**
 * Messages used by controllers so responses stay consistent.
 */
const STREAK_MESSAGES = {
  SUMMARY_FETCHED: 'Streak summary fetched successfully',
  CHECKINS_FETCHED: 'Workout check-ins fetched successfully',
  CHECKIN_CREATED: 'Workout check-in recorded successfully',
  CHECKIN_ALREADY_EXISTS: 'Workout check-in already exists for this date',
  LEADERBOARD_FETCHED: 'Streak leaderboard fetched successfully',
  USER_STREAK_FETCHED: 'User streak fetched successfully',
  USER_STREAK_RECALCULATED: 'User streak recalculated successfully',
};

/**
 * Pagination and listing boundaries for streak endpoints.
 */
const STREAK_LIMITS = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
  DEFAULT_LEADERBOARD_LIMIT: 10,
  MAX_LEADERBOARD_LIMIT: 50,
};

/**
 * Strict date-only format accepted by this module.
 * The database stores workout_checkins.checkin_date as a calendar date.
 */
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

module.exports = {
  STREAK_STATUS,
  STREAK_MESSAGES,
  STREAK_LIMITS,
  DATE_ONLY_PATTERN,
};
