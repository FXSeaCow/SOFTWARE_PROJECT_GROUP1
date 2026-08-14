/**
 * memberships.controller.js
 * HTTP layer for membership operations.
 * Parses req, calls service, sends res. Zero business logic.
 */

const service      = require('./memberships.service');
const asyncHandler = require('../../utils/Asynchandler');
const ApiResponse  = require('../../utils/Apiresponse');

// ─── Public: plan listing ─────────────────────────────────────────────────────

/**
 * GET /api/memberships/plans
 * List all active membership plans (visible to all authenticated users).
 */
const getActivePlans = asyncHandler(async (req, res) => {
  const plans = await service.getActivePlans();
  res.json(ApiResponse.success(plans));
});

/**
 * GET /api/memberships/plans/:planId
 * Get a single plan by ID.
 */
const getPlanById = asyncHandler(async (req, res) => {
  const plan = await service.getPlanById(req.params.planId);
  res.json(ApiResponse.success(plan));
});

// ─── Member: own membership ───────────────────────────────────────────────────

/**
 * GET /api/memberships/me  (FR-04)
 * Return authenticated member's current active membership + days remaining.
 */
const getMyMembership = asyncHandler(async (req, res) => {
  const membership = await service.getMyMembership(req.user.id);
  res.json(ApiResponse.success(membership));
});

/**
 * GET /api/memberships/me/history
 * Return full membership history for the authenticated member.
 */
const getMyMembershipHistory = asyncHandler(async (req, res) => {
  const history = await service.getMyMembershipHistory(req.user.id);
  res.json(ApiResponse.success(history));
});

/**
 * POST /api/memberships/renew  (FR-05)
 * Member selects a plan and initiates renewal.
 */
const renewMembership = asyncHandler(async (req, res) => {
  const membership = await service.renewMembership(req.user.id, req.body.plan_id);
  res.status(201).json(
    ApiResponse.created(membership, 'Membership created. Complete payment to receive your activation code.')
  );
});

/**
 * POST /api/memberships/activate
 * Activates a paid membership using the issued code. Any authenticated
 * account may redeem a code — the redeeming account becomes the owner.
 */
const activateMembershipByCode = asyncHandler(async (req, res) => {
  const membership = await service.activateMembershipByCode(req.user.id, req.body.activation_code);
  res.json(
    ApiResponse.success(membership, 'Membership activated successfully')
  );
});

// ─── Admin: plan management ───────────────────────────────────────────────────

/**
 * GET /api/memberships/admin/plans
 * List ALL plans including inactive (admin only).
 */
const getAllPlans = asyncHandler(async (req, res) => {
  const plans = await service.getAllPlans();
  res.json(ApiResponse.success(plans));
});

/**
 * POST /api/memberships/admin/plans
 * Admin creates a new membership plan.
 */
const createPlan = asyncHandler(async (req, res) => {
  const plan = await service.createPlan(req.body);
  res.status(201).json(ApiResponse.created(plan, 'Plan created successfully'));
});

/**
 * PATCH /api/memberships/admin/plans/:planId
 * Admin updates a membership plan.
 */
const updatePlan = asyncHandler(async (req, res) => {
  const plan = await service.updatePlan(req.params.planId, req.body);
  res.json(ApiResponse.success(plan, 'Plan updated successfully'));
});

// ─── Admin: membership management (FR-06, FR-28) ─────────────────────────────

/**
 * GET /api/memberships/admin  (FR-28)
 * Admin lists all memberships with filters.
 */
const listAllMemberships = asyncHandler(async (req, res) => {
  const { memberships, total, page, limit } =
    await service.listAllMemberships(req.query);
  res.json(ApiResponse.paginated(memberships, total, page, limit));
});

/**
 * POST /api/memberships/admin  (FR-06)
 * Admin manually creates a membership for a specific user.
 */
const adminCreateMembership = asyncHandler(async (req, res) => {
  const membership = await service.adminCreateMembership(req.body, req.user.id);
  res.status(201).json(
    ApiResponse.created(membership, 'Membership created successfully')
  );
});

/**
 * PATCH /api/memberships/admin/:membershipId/status  (FR-06)
 * Admin suspends, cancels, or re-activates a membership.
 */
const updateMembershipStatus = asyncHandler(async (req, res) => {
  const updated = await service.updateMembershipStatus(
    req.params.membershipId,
    req.body.status,
    req.user.id
  );
  res.json(ApiResponse.success(updated, `Membership ${req.body.status} successfully`));
});

/**
 * POST /api/memberships/admin/expire-overdue
 * Manually trigger expiry of overdue memberships.
 * Normally called by a cron job, but exposed for admin use.
 */
const expireOverdueMemberships = asyncHandler(async (req, res) => {
  const result = await service.expireOverdueMemberships();
  res.json(ApiResponse.success(result, `${result.expired_count} memberships expired`));
});

module.exports = {
  getActivePlans,
  getPlanById,
  getMyMembership,
  getMyMembershipHistory,
  renewMembership,
  activateMembershipByCode,
  getAllPlans,
  createPlan,
  updatePlan,
  listAllMemberships,
  adminCreateMembership,
  updateMembershipStatus,
  expireOverdueMemberships,
};
