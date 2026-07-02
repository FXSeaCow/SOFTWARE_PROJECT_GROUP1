/**
 * occupancy.validation.js
 * Joi schemas for gym occupancy endpoints.
 *
 * Validation stays close to the route layer so controller and service code
 * can assume request data has already been sanitized.
 */

const Joi = require('joi');
const {
  CHECKIN_SOURCE,
  SESSION_STATUS,
  OCCUPANCY_LIMITS,
  DATE_ONLY_PATTERN,
} = require('./occupancy.constants');

/**
 * Build a UUID params schema for route IDs.
 *
 * @param {string} name - Route param name.
 * @returns {import('joi').ObjectSchema}
 */
const uuidParam = (name) =>
  Joi.object({
    [name]: Joi.string().uuid().required().messages({
      'string.uuid': `${name} must be a valid UUID`,
      'any.required': `${name} is required`,
    }),
  });

/**
 * Validate a YYYY-MM-DD calendar date string.
 */
const dateOnly = Joi.string()
  .pattern(DATE_ONLY_PATTERN)
  .custom((value, helpers) => {
    const [year, month, day] = value.split('-').map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));

    const isValidDate =
      parsed.getUTCFullYear() === year &&
      parsed.getUTCMonth() === month - 1 &&
      parsed.getUTCDate() === day;

    if (!isValidDate) return helpers.error('date.format');
    return value;
  })
  .messages({
    'string.pattern.base': 'Date must use YYYY-MM-DD format',
    'date.format': 'Date must be a real calendar date',
  });

/**
 * POST /api/occupancy/checkin
 * A member can check in without qr_code_token. Admin/staff can pass a QR token
 * to check in the scanned member.
 */
const checkInSchema = Joi.object({
  qr_code_token: Joi.string().uuid().optional().messages({
    'string.uuid': 'qr_code_token must be a valid UUID',
  }),
  source: Joi.string()
    .valid(...Object.values(CHECKIN_SOURCE))
    .default(CHECKIN_SOURCE.SELF),
  notes: Joi.string().trim().max(250).allow('', null).optional(),
});

/**
 * POST /api/occupancy/checkout
 * Same targeting rules as check-in: no token means the authenticated member.
 */
const checkOutSchema = Joi.object({
  qr_code_token: Joi.string().uuid().optional().messages({
    'string.uuid': 'qr_code_token must be a valid UUID',
  }),
  notes: Joi.string().trim().max(250).allow('', null).optional(),
});

/**
 * Shared session listing filters.
 */
const sessionsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(OCCUPANCY_LIMITS.DEFAULT_PAGE),
  limit: Joi.number()
    .integer()
    .min(1)
    .max(OCCUPANCY_LIMITS.MAX_LIMIT)
    .default(OCCUPANCY_LIMITS.DEFAULT_LIMIT),
  status: Joi.string()
    .valid(SESSION_STATUS.OPEN, SESSION_STATUS.CLOSED, SESSION_STATUS.ALL)
    .default(SESSION_STATUS.ALL),
  from_date: dateOnly.optional(),
  to_date: dateOnly.optional(),
}).custom((value, helpers) => {
  if (value.from_date && value.to_date && value.to_date < value.from_date) {
    return helpers.error('date.range');
  }
  return value;
}).messages({
  'date.range': 'to_date must be after or equal to from_date',
});

/**
 * GET /api/occupancy/admin/sessions
 * Admin can additionally filter sessions by user_id.
 */
const adminSessionsQuerySchema = sessionsQuerySchema.keys({
  user_id: Joi.string().uuid().optional().messages({
    'string.uuid': 'user_id must be a valid UUID',
  }),
});

/**
 * GET /api/occupancy/daily-report
 */
const dailyReportQuerySchema = Joi.object({
  date: dateOnly.optional(),
});

/**
 * POST /api/occupancy/admin/reset-open-sessions
 * Allows admin/scheduler to close stale open sessions at a specific time.
 */
const resetOpenSessionsSchema = Joi.object({
  checkout_at: Joi.date().iso().optional().messages({
    'date.format': 'checkout_at must be a valid ISO datetime',
  }),
});

module.exports = {
  uuidParam,
  checkInSchema,
  checkOutSchema,
  sessionsQuerySchema,
  adminSessionsQuerySchema,
  dailyReportQuerySchema,
  resetOpenSessionsSchema,
};
