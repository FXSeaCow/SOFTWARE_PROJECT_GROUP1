/**
 * memberships.service.js
 * Business logic for membership plans and member subscriptions.
 *
 * FR-04  member views membership info
 * FR-05  member renews membership
 * FR-06  admin creates / updates / suspends / removes memberships
 * FR-28  admin monitors active and expired memberships
 */

const repo                       = require('./memberships.repository');
const { withTransaction }        = require('../../utils/Transaction');
const { computeEndDate,
        daysUntilExpiry,
        isExpiringSoon }         = require('../../utils/Date');
const { parse: parsePagination } = require('../../utils/Pagination');
const ApiError                   = require('../../utils/Apierror');
const logger                     = require('../../utils/Logger');

/**
 * Format a Date or date-like value as YYYY-MM-DD using local calendar parts.
 * PostgreSQL DATE values arrive as JS Date objects, so we must avoid
 * toISOString() here or the day can shift in non-UTC timezones.
 *
 * @param {Date|string} value
 * @returns {string}
 */
const formatDateOnly = (value) => {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Normalize membership date fields before returning them from the service.
 * This keeps DATE columns stable in JSON responses across timezones.
 *
 * @param {object} membership
 * @returns {object}
 */
const normalizeMembershipDates = (membership) => {
  if (!membership) return membership;

  return {
    ...membership,
    start_date: membership.start_date ? formatDateOnly(membership.start_date) : membership.start_date,
    end_date: membership.end_date ? formatDateOnly(membership.end_date) : membership.end_date,
  };
};

// ─── Membership Plans (public) ────────────────────────────────────────────────

/**
 * List all active plans available for members to choose from.
 * @returns {Promise<object[]>}
 */
const getActivePlans = async () => {
  return repo.findAllActivePlans();
};

/**
 * Get a single plan by ID.
 * @param {string} planId
 * @returns {Promise<object>}
 */
const getPlanById = async (planId) => {
  const plan = await repo.findPlanById(planId);
  if (!plan) throw ApiError.notFound('Membership plan');
  return plan;
};

// ─── Membership Plans (admin) ─────────────────────────────────────────────────

/**
 * List ALL plans including inactive (admin view).
 * @returns {Promise<object[]>}
 */
const getAllPlans = async () => {
  return repo.findAllPlans();
};

/**
 * Create a new membership plan (admin).
 * @param {{ name, description, price, duration_days }} data
 * @returns {Promise<object>}
 */
const createPlan = async (data) => {
  const plan = await repo.createPlan(data);
  logger.info('Membership plan created', { planId: plan.id, name: plan.name });
  return plan;
};

/**
 * Update a membership plan (admin).
 * Deactivating a plan does NOT affect existing active memberships.
 *
 * @param {string} planId
 * @param {object} fields
 * @returns {Promise<object>}
 */
const updatePlan = async (planId, fields) => {
  const existing = await repo.findPlanById(planId);
  if (!existing) throw ApiError.notFound('Membership plan');

  const updated = await repo.updatePlan(planId, fields);
  logger.info('Membership plan updated', { planId });
  return updated;
};

// ─── Member: view own membership (FR-04) ─────────────────────────────────────

/**
 * Get the authenticated member's current active membership with
 * enriched info (days remaining, expiry warning).
 *
 * @param {string} userId
 * @returns {Promise<object>}
 */
const getMyMembership = async (userId) => {
  const membership = await repo.findActiveMembership(userId);

  if (!membership) {
    throw new ApiError(
      404,
      'You do not have an active membership. Please purchase or renew one.'
    );
  }

  const daysRemaining = daysUntilExpiry(membership.end_date);
  const expiringSoon  = isExpiringSoon(membership.end_date);

  return {
    ...normalizeMembershipDates(membership),
    days_remaining: daysRemaining,
    expiring_soon: expiringSoon,
  };
};

/**
 * Get the authenticated member's full membership history.
 *
 * @param {string} userId
 * @returns {Promise<object[]>}
 */
const getMyMembershipHistory = async (userId) => {
  const history = await repo.findAllByUser(userId);
  return history.map(normalizeMembershipDates);
};

// ─── Member: renew membership (FR-05) ────────────────────────────────────────

/**
 * Initiate a membership renewal by selecting a plan.
 * Creates a NEW pending membership row.
 * The membership becomes 'active' only after payment is confirmed
 * (handled by the payments module webhook).
 *
 * For the purposes of this module, we create it with status 'active'
 * and a start_date from today — in a real system with a payment gateway,
 * the status would start as 'pending' and be flipped by the payment webhook.
 *
 * Start date logic:
 *   - If the user has an active membership that hasn't expired yet,
 *     the new one starts from the current end_date (stacking).
 *   - Otherwise it starts today.
 *
 * @param {string} userId
 * @param {string} planId
 * @returns {Promise<object>} newly created membership
 */
const renewMembership = async (userId, planId) => {
  // 1. Validate plan exists and is active
  const plan = await repo.findPlanById(planId);
  if (!plan) throw ApiError.notFound('Membership plan');
  if (!plan.is_active) {
    throw ApiError.badRequest('This membership plan is no longer available');
  }

  // 2. Determine start date (stack on top of existing if still active)
  const existing   = await repo.findActiveMembership(userId);
  const startDate  = existing ? new Date(existing.end_date) : new Date();
  const endDate    = computeEndDate(startDate, plan.duration_days);

  // 3. Create the membership inside a transaction
  const membership = await withTransaction(async (client) => {
    return repo.createMembership(
      {
        user_id:    userId,
        plan_id:    planId,
        start_date: formatDateOnly(startDate),
        end_date:   formatDateOnly(endDate),
      },
      client
    );
  });

  logger.info('Membership renewed', {
    userId,
    planId,
    membershipId: membership.id,
    endDate: membership.end_date,
  });

  return { ...normalizeMembershipDates(membership), plan_name: plan.name, price: plan.price };
};

// ─── Admin: manage memberships (FR-06) ───────────────────────────────────────

/**
 * Admin manually creates a membership for a user (e.g. cash payment,
 * gift membership, or correction).
 *
 * @param {{ user_id, plan_id, start_date }} data
 * @param {string} adminId
 * @returns {Promise<object>}
 */
const adminCreateMembership = async ({ user_id, plan_id, start_date }, adminId) => {
  const plan = await repo.findPlanById(plan_id);
  if (!plan) throw ApiError.notFound('Membership plan');
  if (!plan.is_active) {
    throw ApiError.badRequest('This membership plan is no longer available');
  }

  const startDate = new Date(start_date);
  const endDate   = computeEndDate(startDate, plan.duration_days);

  const membership = await withTransaction(async (client) => {
    return repo.createMembership(
      {
        user_id,
        plan_id,
        start_date: formatDateOnly(startDate),
        end_date:   formatDateOnly(endDate),
        updated_by: adminId,
      },
      client
    );
  });

  logger.info('Admin created membership', {
    adminId,
    userId: user_id,
    membershipId: membership.id,
  });

  return { ...normalizeMembershipDates(membership), plan_name: plan.name };
};

/**
 * Admin updates a membership's status (suspend / cancel / re-activate).
 *
 * @param {string} membershipId
 * @param {string} status
 * @param {string} adminId
 * @returns {Promise<object>}
 */
const updateMembershipStatus = async (membershipId, status, adminId) => {
  const existing = await repo.findById(membershipId);
  if (!existing) throw ApiError.notFound('Membership');

  // Guard: cannot re-activate an expired membership
  if (existing.status === 'expired' && status === 'active') {
    throw ApiError.badRequest(
      'Expired memberships cannot be re-activated. Please create a new one.'
    );
  }

  const updated = await repo.updateStatus(membershipId, status, adminId);
  logger.info('Membership status updated', { membershipId, status, adminId });
  return updated;
};

/**
 * Admin: list all memberships with optional filters (FR-28).
 *
 * @param {object} query - req.query
 * @returns {Promise<object>}
 */
const listAllMemberships = async (query) => {
  const { page, limit, offset } = parsePagination(query);
  const { rows, total } = await repo.findAll({
    status:               query.status,
    user_id:              query.user_id,
    expiring_within_days: query.expiring_within_days,
    limit,
    offset,
  });
  return { memberships: rows.map(normalizeMembershipDates), total, page, limit };
};

/**
 * Expire all overdue memberships.
 * Intended to be called by a scheduled cron job (e.g. once per day at midnight).
 * Can also be triggered manually by admin via POST /api/memberships/admin/expire-overdue.
 *
 * @returns {Promise<{ expired_count: number }>}
 */
const expireOverdueMemberships = async () => {
  const count = await repo.expireOverdueMemberships();
  logger.info('Overdue memberships expired', { count });
  return { expired_count: count };
};

module.exports = {
  getActivePlans,
  getPlanById,
  getAllPlans,
  createPlan,
  updatePlan,
  getMyMembership,
  getMyMembershipHistory,
  renewMembership,
  adminCreateMembership,
  updateMembershipStatus,
  listAllMemberships,
  expireOverdueMemberships,
};
