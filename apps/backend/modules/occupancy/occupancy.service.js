/**
 * occupancy.service.js
 * Business logic for branch-aware gym occupancy.
 *
 * Main responsibilities:
 *   - Check members into and out of a specific gym branch.
 *   - Report when each branch is crowded or over its database capacity.
 *   - Notify members when a branch is crowded or full.
 *   - Produce current and daily occupancy analytics per branch or globally.
 *   - Maintain workout check-in and streak data when a member checks in.
 *
 * This layer does not know about Express req/res objects.
 */

const repo = require('./occupancy.repository');
const notificationsService = require('../notifications/notifications.service');
const {
  calculateCurrentOccupancy,
  buildDailyReport,
} = require('./occupancyCalculator');
const {
  DEFAULT_GYM_CAPACITY,
  CHECKIN_SOURCE,
  SESSION_STATUS,
  OCCUPANCY_THRESHOLDS,
} = require('./occupancy.constants');
const {
  NOTIFICATION_TEMPLATE,
} = require('../notifications/notifications.constants');
const { withTransaction } = require('../../utils/Transaction');
const { parse: parsePagination } = require('../../utils/Pagination');
const { qrDataURLMatchesToken } = require('../../utils/Qrcode');
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
 * Return a safe branch capacity.
 *
 * The database stores capacity per branch. The environment default is kept as
 * a fallback for legacy rows or test fixtures that omit capacity.
 *
 * @param {object} branch
 * @returns {number}
 */
const getBranchCapacity = (branch = {}) =>
  Math.max(1, Number(branch.capacity) || DEFAULT_GYM_CAPACITY);

/**
 * Normalize branch fields from either gym_branches or current_occupancy rows.
 *
 * @param {object} branch
 * @returns {object}
 */
const formatBranchMetadata = (branch = {}) => ({
  branch_id: branch.id || branch.branch_id,
  branch_name: branch.name || branch.branch_name,
  address: branch.address,
  city: branch.city,
  phone: branch.phone,
  opening_time: branch.opening_time,
  closing_time: branch.closing_time,
});

/**
 * Build a branch occupancy response with derived metrics.
 *
 * @param {object} branch
 * @param {number} activeCount
 * @returns {object}
 */
const formatBranchOccupancy = (branch, activeCount = 0) => {
  const summary = calculateCurrentOccupancy(
    activeCount,
    getBranchCapacity(branch)
  );

  return {
    ...formatBranchMetadata(branch),
    ...summary,
    is_crowded: summary.occupancy_rate >= OCCUPANCY_THRESHOLDS.ALERT,
  };
};

/**
 * Read the QR data URL field accepted from multiple frontend payload names.
 *
 * @param {object} data
 * @returns {string|null}
 */
const getQRCodeDataURL = (data = {}) =>
  data.qr_code_data_url || data.qr_data_url || data.dataURL || null;

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
 * If qr_code_token or a QR data URL is present, the request targets the owner
 * of that QR code. Non-admin members may only use their own QR code.
 *
 * @param {object} actor - req.user from auth middleware.
 * @param {string|undefined} qrCodeToken
 * @param {string|undefined} qrCodeDataUrl
 * @returns {Promise<object>}
 */
const resolveTargetUser = async (actor, qrCodeToken, qrCodeDataUrl) => {
  if (qrCodeToken) {
    const user = await repo.findUserByQrToken(qrCodeToken);
    if (!user) throw ApiError.badRequest('Invalid QR code token');

    if (actor.role !== 'admin' && actor.id !== user.id) {
      throw ApiError.forbidden('You can only use your own QR code');
    }

    return user;
  }

  if (qrCodeDataUrl) {
    if (actor.role !== 'admin') {
      const user = await repo.findUserById(actor.id);
      if (!user) throw ApiError.notFound('User');

      const matchesOwnQr = await qrDataURLMatchesToken(
        user.qr_code_token,
        qrCodeDataUrl
      );

      if (!matchesOwnQr) {
        throw ApiError.forbidden('You can only use your own QR code');
      }

      return user;
    }

    const users = await repo.findUsersWithQrTokens();

    for (const user of users) {
      const matches = await qrDataURLMatchesToken(user.qr_code_token, qrCodeDataUrl);
      if (matches) return user;
    }

    throw ApiError.badRequest('Invalid QR code data URL');
  }

  if (actor.role === 'admin') {
    throw ApiError.badRequest(
      'qr_code_token or QR code data URL is required for admin occupancy actions'
    );
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
 * Find an active branch or throw a 404 error.
 *
 * @param {string} branchId
 * @param {import('pg').PoolClient|undefined} client
 * @returns {Promise<object>}
 */
const requireBranch = async (branchId, client) => {
  const branch = await repo.findBranchById(branchId, client);
  if (!branch) throw ApiError.notFound('Gym branch');
  return branch;
};

/**
 * Broadcast a non-blocking crowded-branch notification to all members.
 *
 * Occupancy should still work if the notification subsystem is temporarily
 * unavailable, so this helper logs failures and returns null instead of
 * breaking check-in/check-out flows.
 *
 * @param {object} branch
 * @param {object} occupancy
 * @param {'crowded'|'full'} reason
 * @returns {Promise<object|null>}
 */
const broadcastBranchCrowding = async (branch, occupancy, reason = 'crowded') => {
  try {
    return await notificationsService.broadcastFromTemplate(
      NOTIFICATION_TEMPLATE.OCCUPANCY_ALERT,
      {
        branch_name: branch.name || branch.branch_name || occupancy.branch_name,
        occupancy_rate: occupancy.occupancy_rate,
        current_occupancy: occupancy.current_occupancy,
        capacity: occupancy.capacity,
        reason,
      },
      {
        role: 'member',
      }
    );
  } catch (err) {
    logger.error('Failed to broadcast occupancy alert notification', {
      branchId: branch.id || branch.branch_id,
      error: err.message,
    });
    return null;
  }
};

/**
 * Synchronize workout_checkins and workout_streaks after a gym check-in.
 *
 * @param {string} userId
 * @param {string} branchId
 * @param {string} checkinDate - YYYY-MM-DD
 * @param {Date} checkedInAt
 * @param {import('pg').PoolClient} client
 * @returns {Promise<{ workout_checkin: object|null, workout_checkin_created: boolean, streak: object }>}
 */
const syncWorkoutCheckinAndStreak = async (
  userId,
  branchId,
  checkinDate,
  checkedInAt,
  client
) => {
  await repo.ensureWorkoutStreak(userId, client);

  const workoutCheckin = await repo.createWorkoutCheckin(
    userId,
    branchId,
    checkinDate,
    checkedInAt,
    client
  );

  const dates = await repo.findWorkoutCheckinDatesByUser(userId, client);
  const stats = calculateStreakStats(dates);
  const streak = await repo.updateWorkoutStreak(userId, stats, client);

  return {
    workout_checkin: workoutCheckin,
    workout_checkin_created: true,
    streak,
  };
};

/**
 * List active branches with their current occupancy summaries.
 *
 * @returns {Promise<object[]>}
 */
const listBranches = async () => {
  const current = await getCurrentOccupancy();
  return current.branches;
};

/**
 * Return the number of distinct members currently training in one branch.
 *
 * A member is considered active in a branch when they have a gym_sessions row
 * for that branch with checked_out_at still NULL.
 *
 * @param {string} branchId
 * @returns {Promise<object>}
 */
const getBranchActiveMembers = async (branchId) => {
  const branch = await requireBranch(branchId);
  const activeMembers = await repo.countActiveMembersInBranch(branch.id);
  const occupancy = formatBranchOccupancy(branch, activeMembers);

  return {
    branch: formatBranchMetadata(branch),
    active_members: activeMembers,
    current_occupancy: activeMembers,
    capacity: occupancy.capacity,
    available_slots: occupancy.available_slots,
    occupancy_rate: occupancy.occupancy_rate,
    status: occupancy.status,
    is_full: occupancy.is_full,
    is_crowded: occupancy.is_crowded,
  };
};

/**
 * Return current occupancy for one branch or all active branches.
 *
 * @param {{ branch_id?: string }} query
 * @returns {Promise<object>}
 */
const getCurrentOccupancy = async (query = {}) => {
  const branchId = query.branch_id || null;

  if (branchId) {
    const branch = await requireBranch(branchId);
    const rows = await repo.findCurrentOccupancy(branchId);
    const row = rows[0] || {};

    return formatBranchOccupancy(
      { ...branch, ...row, id: branch.id, name: branch.name },
      row.active_members_in_gym || 0
    );
  }

  const [branches, rows] = await Promise.all([
    repo.findActiveBranches(),
    repo.findCurrentOccupancy(),
  ]);
  const occupancyByBranchId = new Map(
    rows.map((row) => [row.branch_id, row.active_members_in_gym || 0])
  );

  const branchSummaries = branches.map((branch) =>
    formatBranchOccupancy(branch, occupancyByBranchId.get(branch.id) || 0)
  );
  const totalActiveMembers = branchSummaries.reduce(
    (sum, branch) => sum + branch.current_occupancy,
    0
  );
  const totalCapacity = branchSummaries.reduce(
    (sum, branch) => sum + branch.capacity,
    0
  );

  return {
    ...calculateCurrentOccupancy(totalActiveMembers, totalCapacity || DEFAULT_GYM_CAPACITY),
    total_branches: branchSummaries.length,
    branches: branchSummaries,
  };
};

/**
 * Check a member into a specific gym branch.
 *
 * @param {object} actor - authenticated user.
 * @param {{ branch_id: string, qr_code_token?: string, qr_code_data_url?: string, qr_data_url?: string, dataURL?: string, source?: string, notes?: string }} data
 * @returns {Promise<object>}
 */
const checkIn = async (actor, data = {}) => {
  const qrCodeDataUrl = getQRCodeDataURL(data);
  const source =
    data.source ||
    (data.qr_code_token || qrCodeDataUrl ? CHECKIN_SOURCE.QR : CHECKIN_SOURCE.SELF);
  const targetUser = await resolveTargetUser(
    actor,
    data.qr_code_token,
    qrCodeDataUrl
  );
  const membership = await requireTargetActiveMembership(targetUser);
  const branch = await requireBranch(data.branch_id);
  const checkInAt = new Date();
  const checkinDate = toDateOnlyString(checkInAt);

  let result;

  result = await withTransaction(async (client) => {
    const branchInTx = await requireBranch(branch.id, client);
    const existingOpenSession = await repo.findOpenSessionByUser(targetUser.id, client);

    if (existingOpenSession) {
      throw ApiError.conflict(
        `This member is already checked in at ${existingOpenSession.branch_name || 'another branch'}`
      );
    }

    const session = await repo.createSession(
      targetUser.id,
      branchInTx.id,
      checkInAt,
      client
    );
    const streakSync = await syncWorkoutCheckinAndStreak(
      targetUser.id,
      branchInTx.id,
      checkinDate,
      checkInAt,
      client
    );
    const updatedCount = await repo.countOpenSessions(branchInTx.id, client);
    const occupancy = formatBranchOccupancy(branchInTx, updatedCount);

    return {
      session,
      member: {
        id: targetUser.id,
        full_name: targetUser.full_name,
        email: targetUser.email,
      },
      membership,
      branch: formatBranchMetadata(branchInTx),
      source,
      ...streakSync,
      occupancy,
      crowding_alert: null,
    };
  });

  if (result.occupancy.is_crowded) {
    result.crowding_alert = await broadcastBranchCrowding(
      branch,
      result.occupancy,
      result.occupancy.is_full ? 'full' : 'crowded'
    );
  }

  logger.info('Member checked in', {
    userId: targetUser.id,
    actorId: actor.id,
    branchId: branch.id,
    source,
  });

  return result;
};

/**
 * Check a member out of the gym.
 *
 * @param {object} actor - authenticated user.
 * @param {{ qr_code_token?: string, qr_code_data_url?: string, qr_data_url?: string, dataURL?: string, notes?: string }} data
 * @returns {Promise<object>}
 */
const checkOut = async (actor, data = {}) => {
  const targetUser = await resolveTargetUser(
    actor,
    data.qr_code_token,
    getQRCodeDataURL(data)
  );
  const checkOutAt = new Date();

  const result = await withTransaction(async (client) => {
    const openSession = await repo.findOpenSessionByUser(targetUser.id, client);
    if (!openSession) {
      throw ApiError.badRequest('This member is not currently checked in');
    }

    const branch = await requireBranch(openSession.branch_id, client);
    const closedSession = await repo.closeSession(openSession.id, checkOutAt, client);
    const updatedCount = await repo.countOpenSessions(branch.id, client);

    return {
      session: closedSession,
      member: {
        id: targetUser.id,
        full_name: targetUser.full_name,
        email: targetUser.email,
      },
      branch: formatBranchMetadata(branch),
      occupancy: formatBranchOccupancy(branch, updatedCount),
    };
  });

  logger.info('Member checked out', {
    userId: targetUser.id,
    actorId: actor.id,
    branchId: result.branch.branch_id,
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
    branch_id: query.branch_id,
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
    branch_id: query.branch_id,
    status: query.status || SESSION_STATUS.ALL,
    from_date: query.from_date,
    to_date: query.to_date,
    limit,
    offset,
  });

  return { sessions: rows, total, page, limit };
};

/**
 * Build a daily occupancy report for one branch or all branches.
 *
 * @param {{ date?: string, branch_id?: string }} query
 * @returns {Promise<object>}
 */
const getDailyReport = async (query = {}) => {
  const date = query.date || toDateOnlyString();
  const branch = query.branch_id ? await requireBranch(query.branch_id) : null;
  const sessions = await repo.findSessionsByDate(date, branch ? branch.id : null);
  const branches = branch ? [branch] : await repo.findActiveBranches();
  const capacity = branches.reduce(
    (sum, currentBranch) => sum + getBranchCapacity(currentBranch),
    0
  );
  const report = buildDailyReport(sessions, {
    date,
    capacity: capacity || DEFAULT_GYM_CAPACITY,
  });

  return {
    ...report,
    branch: branch ? formatBranchMetadata(branch) : null,
    branches_count: branches.length,
  };
};

/**
 * Close every open session, optionally scoped to one branch.
 *
 * @param {{ branch_id?: string, checkout_at?: string|Date }} data
 * @returns {Promise<{ closed_count: number, sessions: object[], occupancy: object }>}
 */
const resetOpenSessions = async (data = {}) => {
  const checkoutAt = data.checkout_at ? new Date(data.checkout_at) : new Date();
  const branch = data.branch_id ? await requireBranch(data.branch_id) : null;

  const result = await withTransaction(async (client) => {
    const sessions = await repo.closeOpenSessions(
      checkoutAt,
      branch ? branch.id : null,
      client
    );

    return {
      closed_count: sessions.length,
      sessions,
    };
  });

  const occupancy = branch
    ? await getCurrentOccupancy({ branch_id: branch.id })
    : await getCurrentOccupancy();

  logger.info('Open gym sessions reset', {
    branchId: branch ? branch.id : null,
    closedCount: result.closed_count,
    checkoutAt,
  });

  return {
    ...result,
    branch: branch ? formatBranchMetadata(branch) : null,
    occupancy,
  };
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
  listBranches,
  getBranchActiveMembers,
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
  formatBranchOccupancy,
  broadcastBranchCrowding,
  getQRCodeDataURL,
  toDateOnlyString,
};
