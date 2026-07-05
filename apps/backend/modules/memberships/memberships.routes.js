/**
 * memberships.routes.js
 * Registers all membership endpoints.
 *
 * Base path (mounted in app.js): /api/memberships
 *
 * Public (authenticated):
 *   GET    /api/memberships/plans               — list active plans
 *   GET    /api/memberships/plans/:planId        — single plan detail
 *   GET    /api/memberships/me                  — own active membership  FR-04
 *   GET    /api/memberships/me/history          — own membership history
 *   POST   /api/memberships/renew               — renew membership       FR-05
 *
 * Admin only:
 *   GET    /api/memberships/admin               — list all memberships   FR-28
 *   POST   /api/memberships/admin               — create for a user      FR-06
 *   GET    /api/memberships/admin/plans         — all plans incl inactive
 *   POST   /api/memberships/admin/plans         — create a plan
 *   PATCH  /api/memberships/admin/plans/:planId — update a plan
 *   PATCH  /api/memberships/admin/:membershipId/status — suspend/cancel  FR-06
 *   POST   /api/memberships/admin/expire-overdue — run expiry job
 */

const router = require('express').Router();
const ctrl   = require('./memberships.controller');

const { authenticate }    = require('../../middlewares/Auth.middleware');
const { requireRole }     = require('../../middlewares/Role.middleware');
const { validate }        = require('../../middlewares/Validate.middleware');
const {
  uuidParam,
  createPlanSchema,
  updatePlanSchema,
  renewSchema,
  activateMembershipSchema,
  adminCreateMembershipSchema,
  updateStatusSchema,
  listMembershipsQuerySchema,
} = require('./memberships.validation');

// All membership routes require authentication
router.use(authenticate);

// ── Plans (all authenticated users) ──────────────────────────────────────────
router.get('/plans',          ctrl.getActivePlans);
router.get(
  '/plans/:planId',
  validate(null, uuidParam('planId')),
  ctrl.getPlanById
);

// ── Member: own membership ────────────────────────────────────────────────────
router.get('/me',         ctrl.getMyMembership);
router.get('/me/history', ctrl.getMyMembershipHistory);

router.post(
  '/renew',
  validate(renewSchema),
  ctrl.renewMembership
);

router.post(
  '/activate',
  validate(activateMembershipSchema),
  ctrl.activateMembershipByCode
);

// ── Admin: membership management ─────────────────────────────────────────────
router.get(
  '/admin',
  requireRole('admin'),
  validate(null, null, listMembershipsQuerySchema),
  ctrl.listAllMemberships
);

router.post(
  '/admin',
  requireRole('admin'),
  validate(adminCreateMembershipSchema),
  ctrl.adminCreateMembership
);

router.post(
  '/admin/expire-overdue',
  requireRole('admin'),
  ctrl.expireOverdueMemberships
);

// ── Admin: plan management ────────────────────────────────────────────────────
router.get(
  '/admin/plans',
  requireRole('admin'),
  ctrl.getAllPlans
);

router.post(
  '/admin/plans',
  requireRole('admin'),
  validate(createPlanSchema),
  ctrl.createPlan
);

router.patch(
  '/admin/plans/:planId',
  requireRole('admin'),
  validate(updatePlanSchema, uuidParam('planId')),
  ctrl.updatePlan
);

// ── Admin: membership status ──────────────────────────────────────────────────
router.patch(
  '/admin/:membershipId/status',
  requireRole('admin'),
  validate(updateStatusSchema, uuidParam('membershipId')),
  ctrl.updateMembershipStatus
);

module.exports = router;
