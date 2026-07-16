/**
 * memberships.validation.js
 * Joi schemas for membership endpoints.
 *
 * Covers:
 *   FR-04  member views membership info
 *   FR-05  member renews membership
 *   FR-06  admin creates / updates / suspends / removes memberships
 *   FR-28  admin monitors active and expired memberships
 */

const Joi = require('joi');

// ─── Reusable ─────────────────────────────────────────────────────────────────

const uuidParam = (name) =>
  Joi.object({
    [name]: Joi.string().uuid().required().messages({
      'string.uuid':  `${name} must be a valid UUID`,
      'any.required': `${name} is required`,
    }),
  });

// ─── Membership Plan schemas (admin) ─────────────────────────────────────────

/**
 * POST /api/memberships/plans
 * Admin creates a new membership plan (e.g. "1-month Basic").
 */
const createPlanSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required().messages({
    'any.required': 'Plan name is required',
  }),
  description:   Joi.string().trim().max(500).allow('', null).optional(),
  price:         Joi.number().positive().precision(2).required().messages({
    'number.positive': 'Price must be a positive number',
    'any.required':    'Price is required',
  }),
  duration_days: Joi.number().integer().min(1).max(3650).required().messages({
    'number.min':   'Duration must be at least 1 day',
    'number.max':   'Duration cannot exceed 3650 days (10 years)',
    'any.required': 'Duration in days is required',
  }),
});

/**
 * PATCH /api/memberships/plans/:planId
 * Admin updates an existing plan.
 */
const updatePlanSchema = Joi.object({
  name:          Joi.string().trim().min(2).max(100),
  description:   Joi.string().trim().max(500).allow('', null),
  price:         Joi.number().positive().precision(2),
  duration_days: Joi.number().integer().min(1).max(3650),
  is_active:     Joi.boolean(),
}).min(1).messages({
  'object.min': 'At least one field must be provided to update',
});

// ─── Member Membership schemas ────────────────────────────────────────────────

/**
 * POST /api/memberships/renew  (FR-05)
 * Member renews by selecting a plan.
 * Actual payment is handled by the payments module after this.
 */
const renewSchema = Joi.object({
  plan_id: Joi.string().uuid().required().messages({
    'string.uuid':  'plan_id must be a valid UUID',
    'any.required': 'plan_id is required',
  }),
});

// ─── Admin Membership management schemas (FR-06) ──────────────────────────────

/**
 * POST /api/memberships/admin
 * Admin manually creates a membership for a user (e.g. cash payment).
 */
const adminCreateMembershipSchema = Joi.object({
  user_id:    Joi.string().uuid().required().messages({
    'string.uuid':  'user_id must be a valid UUID',
    'any.required': 'user_id is required',
  }),
  plan_id:    Joi.string().uuid().required().messages({
    'string.uuid':  'plan_id must be a valid UUID',
    'any.required': 'plan_id is required',
  }),
  start_date: Joi.date().iso().default(() => new Date()).messages({
    'date.format': 'start_date must be a valid ISO date (YYYY-MM-DD)',
  }),
});

/**
 * PATCH /api/memberships/:membershipId/status
 * Admin suspends, cancels, or re-activates a membership.
 */
const updateStatusSchema = Joi.object({
  status: Joi.string()
    .valid('active', 'suspended', 'cancelled')
    .required()
    .messages({
      'any.only':     'status must be one of: active, suspended, cancelled',
      'any.required': 'status is required',
    }),
});

// ─── Query schemas ────────────────────────────────────────────────────────────

/**
 * GET /api/memberships/admin  (FR-28)
 * Admin lists all memberships with filters.
 */
const listMembershipsQuerySchema = Joi.object({
  page:    Joi.number().integer().min(1).default(1),
  limit:   Joi.number().integer().min(1).max(100).default(10),
  status:  Joi.string().valid('active', 'expired', 'suspended', 'cancelled').optional(),
  user_id: Joi.string().uuid().optional(),
  expiring_within_days: Joi.number().integer().min(1).max(90).optional()
    .description('Filter memberships expiring within N days'),
});

module.exports = {
  uuidParam,
  createPlanSchema,
  updatePlanSchema,
  renewSchema,
  adminCreateMembershipSchema,
  updateStatusSchema,
  listMembershipsQuerySchema,
};