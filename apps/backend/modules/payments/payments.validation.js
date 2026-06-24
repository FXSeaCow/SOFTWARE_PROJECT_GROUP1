/**
 * payments.validation.js
 * Joi schemas for the simplified payment module.
 *
 * FR-25  member submits a payment request (banking or cash)
 * FR-26  member views payment history
 * FR-27  system records successful payment transactions
 * FR-30  admin monitors payment transactions
 *
 * Flow:
 *   Member initiates → status = 'pending'
 *   Admin confirms   → status = 'completed'
 *   Admin rejects    → status = 'failed'
 */

const Joi = require('joi');

const uuidParam = (name) =>
  Joi.object({
    [name]: Joi.string().uuid().required().messages({
      'string.uuid':  `${name} must be a valid UUID`,
      'any.required': `${name} is required`,
    }),
  });

/**
 * POST /api/payments/request  (FR-25)
 * Member submits a payment for a membership.
 */
const requestPaymentSchema = Joi.object({
  membership_id: Joi.string().uuid().required().messages({
    'string.uuid':  'membership_id must be a valid UUID',
    'any.required': 'membership_id is required',
  }),
  provider: Joi.string()
    .valid('banking', 'cash')
    .required()
    .messages({
      'any.only':     'provider must be either: banking or cash',
      'any.required': 'provider is required',
    }),
  transfer_note: Joi.string().trim().max(200).allow('', null).optional()
    .description('Bank transfer reference or note for admin to verify'),
});

/**
 * POST /api/payments/admin/:paymentId/confirm  (FR-27)
 */
const confirmPaymentSchema = Joi.object({
  note: Joi.string().trim().max(200).allow('', null).optional(),
});

/**
 * POST /api/payments/admin/:paymentId/reject
 */
const rejectPaymentSchema = Joi.object({
  reason: Joi.string().trim().max(200).required().messages({
    'any.required': 'A rejection reason is required',
  }),
});

/**
 * POST /api/payments/admin/:paymentId/refund
 */
const refundPaymentSchema = Joi.object({
  reason: Joi.string().trim().max(200).required().messages({
    'any.required': 'A refund reason is required',
  }),
});

/**
 * GET /api/payments/admin  (FR-30)
 */
const listPaymentsQuerySchema = Joi.object({
  page:      Joi.number().integer().min(1).default(1),
  limit:     Joi.number().integer().min(1).max(100).default(10),
  status:    Joi.string().valid('pending', 'completed', 'failed', 'refunded').optional(),
  user_id:   Joi.string().uuid().optional(),
  provider:  Joi.string().valid('banking', 'cash').optional(),
  from_date: Joi.date().iso().optional(),
  to_date:   Joi.date().iso().min(Joi.ref('from_date')).optional().messages({
    'date.min': 'to_date must be after from_date',
  }),
});

/**
 * GET /api/payments/me  (FR-26)
 */
const myPaymentsQuerySchema = Joi.object({
  page:  Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
});

module.exports = {
  uuidParam,
  requestPaymentSchema,
  confirmPaymentSchema,
  rejectPaymentSchema,
  refundPaymentSchema,
  listPaymentsQuerySchema,
  myPaymentsQuerySchema,
};