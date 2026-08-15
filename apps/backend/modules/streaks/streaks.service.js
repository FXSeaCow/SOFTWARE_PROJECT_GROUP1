/**
 * streaks.service.js
 * Business logic for workout streaks.
 *
 * Responsibilities:
 *   - Record every workout check-in for a member.
 *   - Recalculate current and longest streaks from check-in history.
 *   - Return status metadata such as active, at_risk, and broken.
 *
 * This file does not know about HTTP requests or responses.
 */

const repo = require('./streaks.repository');
const { withTransaction } = require('../../utils/Transaction');
const { parse: parsePagination } = require('../../utils/Pagination');
const ApiError = require('../../utils/Apierror');
const logger = require('../../utils/Logger');
const { STREAK_STATUS } = require('./streaks.constants');

/**
 * Convert a Date or date string to YYYY-MM-DD using local calendar fields.
 *
 * @param {Date|string} value
 * @returns {string}
 */
const toDateOnlyString = (value = new Date()) => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Convert a YYYY-MM-DD string into a UTC day number.
 *
 * @param {string} dateString
 * @returns {number}
 */
const toUtcDayNumber = (dateString) => {
  const [year, month, day] = dateString.split('-').map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
};

/**
 * Return the number of calendar days from dateA to dateB.
 *
 * @param {string} dateA - YYYY-MM-DD
 * @param {string} dateB - YYYY-MM-DD
 * @returns {number}
 */
const daysBetween = (dateA, dateB) => {
  return toUtcDayNumber(dateB) - toUtcDayNumber(dateA);
};

/**
 * Ensure the requested check-in date is not in the future.
 *
 * @param {string|undefined} checkinDate
 * @returns {string}
 */
const normalizeCheckinDate = (checkinDate) => {
  const date = checkinDate || toDateOnlyString();
  const today = toDateOnlyString();

  if (date > today) {
    throw ApiError.badRequest('checkin_date cannot be in the future');
  }

  return date;
};

/**
 * Calculate current and longest streaks from sorted unique check-in dates.
 *
 * current_streak means the latest consecutive run ending at the most recent
 * check-in date. The response status tells the frontend whether that run is
 * still active today, at risk, or already broken.
 *
 * @param {string[]} dates - sorted YYYY-MM-DD values.
 * @returns {{ current_streak: number, longest_streak: number, last_active_date: string|null }}
 */
const calculateStreakStats = (dates) => {
  if (!dates.length) {
    return {
      current_streak: 0,
      longest_streak: 0,
      last_active_date: null,
    };
  }

  let currentRun = 0;
  let longestRun = 0;
  let previousDate = null;

  dates.forEach((date) => {
    if (date === previousDate) return;

    currentRun =
      previousDate && daysBetween(previousDate, date) === 1
        ? currentRun + 1
        : 1;

    longestRun = Math.max(longestRun, currentRun);
    previousDate = date;
  });

  return {
    current_streak: currentRun,
    longest_streak: longestRun,
    last_active_date: previousDate,
  };
};

/**
 * Resolve the user-facing status for a streak row.
 *
 * @param {string|null} lastActiveDate
 * @returns {string}
 */
const resolveStatus = (lastActiveDate) => {
  if (!lastActiveDate) return STREAK_STATUS.NOT_STARTED;

  const today = toDateOnlyString();
  const diff = daysBetween(lastActiveDate, today);

  if (diff <= 0) return STREAK_STATUS.ACTIVE;
  if (diff === 1) return STREAK_STATUS.AT_RISK;
  return STREAK_STATUS.BROKEN;
};

/**
 * Add calculated metadata to a streak row before returning it to controllers.
 *
 * @param {object} streak
 * @param {number} totalCheckins
 * @returns {object}
 */
const decorateStreak = (streak, totalCheckins = 0) => {
  const lastActiveDate = streak.last_active_date || null;
  const status = resolveStatus(lastActiveDate);

  return {
    id: streak.id,
    user_id: streak.user_id,
    current_streak: Number(streak.current_streak || 0),
    longest_streak: Number(streak.longest_streak || 0),
    last_active_date: lastActiveDate,
    total_checkins: Number(totalCheckins || 0),
    status,
    is_at_risk: status === STREAK_STATUS.AT_RISK,
    is_broken: status === STREAK_STATUS.BROKEN,
  };
};

/**
 * Ensure a user has a workout_streaks row.
 *
 * @param {string} userId
 * @param {import('pg').PoolClient} [client]
 * @returns {Promise<object>}
 */
const ensureStreakRecord = async (userId, client) => {
  const existing = await repo.findStreakByUserId(userId, client);
  if (existing) return existing;
  return repo.createStreakRecord(userId, client);
};

/**
 * Ensure the selected branch exists and can receive check-ins.
 *
 * @param {string} branchId
 * @param {import('pg').PoolClient} [client]
 * @returns {Promise<object>}
 */
const requireBranch = async (branchId, client) => {
  const branch = await repo.findBranchById(branchId, client);
  if (!branch) throw ApiError.notFound('Gym branch');
  return branch;
};

/**
 * Get a member's streak summary.
 *
 * @param {string} userId
 * @returns {Promise<object>}
 */
const getMyStreak = async (userId) => {
  const streak = await ensureStreakRecord(userId);
  const totalCheckins = await repo.countCheckinsByUser(userId);
  return decorateStreak(streak, totalCheckins);
};

/**
 * List a member's workout check-in history with pagination.
 *
 * @param {string} userId
 * @param {object} query
 * @returns {Promise<{ checkins: object[], total: number, page: number, limit: number }>}
 */
const listMyCheckins = async (userId, query) => {
  const { page, limit, offset } = parsePagination(query);
  const { rows, total } = await repo.findCheckinsByUser(userId, {
    limit,
    offset,
    branch_id: query.branch_id,
    from_date: query.from_date,
    to_date: query.to_date,
  });

  return {
    checkins: rows,
    total,
    page,
    limit,
  };
};

/**
 * Record a workout check-in and update the user's streak atomically.
 *
 * Multiple check-ins on the same date are stored as separate visits. Only the
 * first visit on a calendar date is marked counted_for_streak so summaries and
 * streak counters stay day-based.
 *
 * @param {string} userId
 * @param {{ branch_id: string, checkin_date?: string }} data
 * @returns {Promise<{ checkin: object, streak: object, already_checked_in: boolean }>}
 */
const recordCheckin = async (userId, data = {}) => {
  const checkinDate = normalizeCheckinDate(data.checkin_date);
  const checkedInAt = new Date();

  const result = await withTransaction(async (client) => {
    await ensureStreakRecord(userId, client);
    const branch = await requireBranch(data.branch_id, client);
    const countedCheckin = await repo.findCheckinByUserAndDate(
      userId,
      checkinDate,
      client
    );
    const countedForStreak = !countedCheckin;

    const checkin = await repo.createCheckin(
      userId,
      branch.id,
      checkinDate,
      checkedInAt,
      countedForStreak,
      client
    );
    const dates = await repo.findCheckinDatesByUser(userId, client);
    const stats = calculateStreakStats(dates);
    const updatedStreak = await repo.updateStreak(userId, stats, client);
    const totalCheckins = await repo.countCheckinsByUser(userId, {}, client);

    return {
      checkin,
      branch,
      streak: decorateStreak(updatedStreak, totalCheckins),
      already_checked_in: false,
    };
  });

  logger.info('Workout check-in processed', {
    userId,
    branchId: result.checkin.branch_id,
    checkinDate,
    alreadyCheckedIn: result.already_checked_in,
  });

  return result;
};

/**
 * Return the public streak leaderboard.
 *
 * @param {{ limit?: number }} query
 * @returns {Promise<object[]>}
 */
const getLeaderboard = async (query = {}) => {
  const rows = await repo.findLeaderboard({ limit: query.limit });

  return rows.map((row, index) => ({
    rank: index + 1,
    user_id: row.user_id,
    full_name: row.full_name,
    current_streak: Number(row.current_streak || 0),
    longest_streak: Number(row.longest_streak || 0),
    last_active_date: row.last_active_date || null,
    status: resolveStatus(row.last_active_date || null),
  }));
};

/**
 * Admin: get one user's streak summary.
 *
 * @param {string} userId
 * @returns {Promise<object>}
 */
const getUserStreak = async (userId) => {
  const user = await repo.findUserById(userId);
  if (!user) throw ApiError.notFound('User');

  const streak = await ensureStreakRecord(userId);
  const totalCheckins = await repo.countCheckinsByUser(userId);

  return {
    user,
    streak: decorateStreak(streak, totalCheckins),
  };
};

/**
 * Admin: rebuild one user's streak counters from workout_checkins.
 *
 * @param {string} userId
 * @returns {Promise<object>}
 */
const recalculateUserStreak = async (userId) => {
  const user = await repo.findUserById(userId);
  if (!user) throw ApiError.notFound('User');

  const recalculated = await withTransaction(async (client) => {
    await ensureStreakRecord(userId, client);
    const dates = await repo.findCheckinDatesByUser(userId, client);
    const stats = calculateStreakStats(dates);
    const updatedStreak = await repo.updateStreak(userId, stats, client);
    const totalCheckins = await repo.countCheckinsByUser(userId, {}, client);

    return {
      user,
      streak: decorateStreak(updatedStreak, totalCheckins),
    };
  });

  logger.info('Workout streak recalculated', { userId });
  return recalculated;
};

module.exports = {
  getMyStreak,
  listMyCheckins,
  recordCheckin,
  getLeaderboard,
  getUserStreak,
  recalculateUserStreak,

  // Exported for focused unit tests without needing database access.
  calculateStreakStats,
  resolveStatus,
};
