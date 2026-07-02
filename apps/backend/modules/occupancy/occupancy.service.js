/**
 * occupancy.service.js
 * Business logic for gym occupancy.
 *
 * Main responsibilities:
 *   - Check members into and out of the gym.
 *   - Keep current occupancy below configured capacity.
 *   - Produce current and daily occupancy analytics.
 *   - Maintain workout check-in and streak data when a member checks in.
 *
 * This layer does not know about Express req/res objects.
 */

const repo = require('./occupancy.repository');
const {
  calculateCurrentOccupancy,
  buildDailyReport,
} = require('./occupancyCalculator');
const {
  DEFAULT_GYM_CAPACITY,
  CHECKIN_SOURCE,
  SESSION_STATUS,
} = require('./occupancy.constants');
const { withTransaction } = require('../../utils/Transaction');
const { parse: parsePagination } = require('../../utils/Pagination');
const ApiError = require('../../utils/Apierror');
const logger = require('../../utils/Logger');

let occupancyCache = {
  data: null,
  refreshed_at: null,
};

/**
 * Convert a Date into a local YYYY-MM-DD string.
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
 * Return the day distance between two YYYY-MM-DD strings.
 *
 * @param {string} dateA
 * @param {string} dateB
 * @returns {number}
 */
const daysBetween = (dateA, dateB) => toUtcDayNumber(dateB) - toUtcDayNumber(dateA);

/**
 * Calculate current and longest streaks from sorted unique check-in dates.
 *
 * @param {string[]} dates
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
 * Resolve the member affected by a check-in/check-out action.
 *
 * If qr_code_token is present, the request targets the owner of that token.
 * Non-admin members may only use their own QR token.
 *
 * @param {object} actor - req.user from auth middleware.
 * @param {string|undefined} qrCodeToken
 * @returns {Promise<object>}
 */
const resolveTargetUser = async (actor, qrCodeToken) => {
  if (qrCodeToken) {
    const user = await repo.findUserByQrToken(qrCodeToken);
    if (!user) throw ApiError.badRequest('Invalid QR code token');

    if (actor.role !== 'admin' && actor.id !== user.id) {
      throw ApiError.forbidden('You can only use your own QR code');
    }

    return user;
  }

  if (actor.role === 'admin') {
    throw ApiError.badRequest('qr_code_token is required for admin occupancy actions');
  }

  const user = await repo.findUserById(actor.id);
  if (!user) throw ApiError.notFound('User');
  return user;
};

/**
 * Validate that a target user can enter the gym.
 *
 * @param {object} user
 * @returns {Promise<object>} active membership
 */
const requireTargetActiveMembership = async (user) => {
  if (user.role === 'admin') {
    throw ApiError.badRequest('Only members can check in to the gym');
  }

  const membership = await repo.findActiveMembership(user.id);
  if (!membership) {
    throw ApiError.forbidden(
      'An active membership is required to check in. Please renew or purchase a membership.'
    );
  }

  return membership;
};

/**
 * Synchronize workout_checkins and workout_streaks after a gym check-in.
 *
 * @param {string} userId
 * @param {string} checkinDate - YYYY-MM-DD
 * @param {import('pg').PoolClient} client
 * @returns {Promise<{ workout_checkin: object|null, workout_checkin_created: boolean, streak: object }>}
 */
const syncWorkoutCheckinAndStreak = async (userId, checkinDate, client) => {
  await repo.ensureWorkoutStreak(userId, client);

  const existing = await repo.findWorkoutCheckinByUserAndDate(
    userId,
    checkinDate,
    client
  );

  let workoutCheckin = existing;
  let created = false;

  if (!existing) {
    workoutCheckin = await repo.createWorkoutCheckin(userId, checkinDate, client);
    created = true;
  }

  const dates = await repo.findWorkoutCheckinDatesByUser(userId, client);
  const stats = calculateStreakStats(dates);
  const streak = await repo.updateWorkoutStreak(userId, stats, client);

  return {
    workout_checkin: workoutCheckin,
    workout_checkin_created: created,
    streak,
  };
};

/**
 * Return current gym occupancy.
 *
 * @returns {Promise<object>}
 */
const getCurrentOccupancy = async () => {
  const openSessionCount = await repo.countOpenSessions();
  return calculateCurrentOccupancy(openSessionCount, DEFAULT_GYM_CAPACITY);
};

/**
 * Check a member into the gym.
 *
 * @param {object} actor - authenticated user.
 * @param {{ qr_code_token?: string, source?: string, notes?: string }} data
 * @returns {Promise<object>}
 */
const checkIn = async (actor, data = {}) => {
  const source = data.source || (data.qr_code_token ? CHECKIN_SOURCE.QR : CHECKIN_SOURCE.SELF);
  const targetUser = await resolveTargetUser(actor, data.qr_code_token);
  const membership = await requireTargetActiveMembership(targetUser);
  const checkInAt = new Date();
  const checkinDate = toDateOnlyString(checkInAt);

  const result = await withTransaction(async (client) => {
    const existingOpenSession = await repo.findOpenSessionByUser(targetUser.id, client);
    if (existingOpenSession) {
      throw ApiError.conflict('This member is already checked in');
    }

    const currentCount = await repo.countOpenSessions(client);
    const currentOccupancy = calculateCurrentOccupancy(
      currentCount,
      DEFAULT_GYM_CAPACITY
    );

    if (currentOccupancy.is_full) {
      throw ApiError.conflict('Gym is currently full. Please try again later.');
    }

    const session = await repo.createSession(targetUser.id, checkInAt, client);
    const streakSync = await syncWorkoutCheckinAndStreak(
      targetUser.id,
      checkinDate,
      client
    );

    const updatedCount = await repo.countOpenSessions(client);

    return {
      session,
      member: {
        id: targetUser.id,
        full_name: targetUser.full_name,
        email: targetUser.email,
      },
      membership,
      source,
      ...streakSync,
      occupancy: calculateCurrentOccupancy(updatedCount, DEFAULT_GYM_CAPACITY),
    };
  });

  logger.info('Member checked in', {
    userId: targetUser.id,
    actorId: actor.id,
    source,
  });

  return result;
};

/**
 * Check a member out of the gym.
 *
 * @param {object} actor - authenticated user.
 * @param {{ qr_code_token?: string, notes?: string }} data
 * @returns {Promise<object>}
 */
const checkOut = async (actor, data = {}) => {
  const targetUser = await resolveTargetUser(actor, data.qr_code_token);
  const checkOutAt = new Date();

  const result = await withTransaction(async (client) => {
    const openSession = await repo.findOpenSessionByUser(targetUser.id, client);
    if (!openSession) {
      throw ApiError.badRequest('This member is not currently checked in');
    }

    const closedSession = await repo.closeSession(openSession.id, checkOutAt, client);
    const updatedCount = await repo.countOpenSessions(client);

    return {
      session: closedSession,
      member: {
        id: targetUser.id,
        full_name: targetUser.full_name,
        email: targetUser.email,
      },
      occupancy: calculateCurrentOccupancy(updatedCount, DEFAULT_GYM_CAPACITY),
    };
  });

  logger.info('Member checked out', {
    userId: targetUser.id,
    actorId: actor.id,
  });

  return result;
};

/**
 * List the authenticated member's sessions.
 *
 * @param {string} userId
 * @param {object} query
 * @returns {Promise<{ sessions: object[], total: number, page: number, limit: number }>}
 */
const listMySessions = async (userId, query = {}) => {
  const { page, limit, offset } = parsePagination(query);
  const { rows, total } = await repo.findSessions({
    user_id: userId,
    status: query.status || SESSION_STATUS.ALL,
    from_date: query.from_date,
    to_date: query.to_date,
    limit,
    offset,
  });

  return { sessions: rows, total, page, limit };
};

/**
 * Admin: list all sessions.
 *
 * @param {object} query
 * @returns {Promise<{ sessions: object[], total: number, page: number, limit: number }>}
 */
const listSessions = async (query = {}) => {
  const { page, limit, offset } = parsePagination(query);
  const { rows, total } = await repo.findSessions({
    user_id: query.user_id,
    status: query.status || SESSION_STATUS.ALL,
    from_date: query.from_date,
    to_date: query.to_date,
    limit,
    offset,
  });

  return { sessions: rows, total, page, limit };
};

/**
 * Build a daily occupancy report.
 *
 * @param {{ date?: string }} query
 * @returns {Promise<object>}
 */
const getDailyReport = async (query = {}) => {
  const date = query.date || toDateOnlyString();
  const sessions = await repo.findSessionsByDate(date);
  return buildDailyReport(sessions, {
    date,
    capacity: DEFAULT_GYM_CAPACITY,
  });
};

/**
 * Close every open session.
 *
 * @param {{ checkout_at?: string|Date }} data
 * @returns {Promise<{ closed_count: number, sessions: object[], occupancy: object }>}
 */
const resetOpenSessions = async (data = {}) => {
  const checkoutAt = data.checkout_at ? new Date(data.checkout_at) : new Date();

  const result = await withTransaction(async (client) => {
    const sessions = await repo.closeOpenSessions(checkoutAt, client);
    const updatedCount = await repo.countOpenSessions(client);

    return {
      closed_count: sessions.length,
      sessions,
      occupancy: calculateCurrentOccupancy(updatedCount, DEFAULT_GYM_CAPACITY),
    };
  });

  logger.info('Open gym sessions reset', {
    closedCount: result.closed_count,
    checkoutAt,
  });

  return result;
};

/**
 * Refresh the in-process occupancy cache.
 *
 * This cache is intentionally simple. It gives the scheduler a lightweight
 * place to store the latest snapshot without introducing Redis or another
 * dependency.
 *
 * @returns {Promise<object>}
 */
const refreshOccupancyCache = async () => {
  const data = await getCurrentOccupancy();
  occupancyCache = {
    data,
    refreshed_at: new Date().toISOString(),
  };
  return occupancyCache;
};

/**
 * Return the latest in-process occupancy cache.
 *
 * @returns {{ data: object|null, refreshed_at: string|null }}
 */
const getOccupancyCache = () => occupancyCache;

module.exports = {
  getCurrentOccupancy,
  checkIn,
  checkOut,
  listMySessions,
  listSessions,
  getDailyReport,
  resetOpenSessions,
  refreshOccupancyCache,
  getOccupancyCache,

  // Exported for focused unit tests without needing database access.
  calculateStreakStats,
  toDateOnlyString,
};
