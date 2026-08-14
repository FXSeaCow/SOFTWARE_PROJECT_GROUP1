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

const qrCodeDataUrl = Joi.string()
  .trim()
  .max(200000)
  .pattern(/^data:image\/png;base64,[A-Za-z0-9+/=\s]+$/)
  .optional()
  .messages({
    'string.pattern.base': 'QR code data URL must be a PNG data:image/png;base64 value',
    'string.max': 'QR code data URL is too large',
  });

/**
 * POST /api/occupancy/checkin
 * A member can check in without qr_code_token. Admin/staff can pass a QR token
 * to check in the scanned member.
 */
const checkInSchema = Joi.object({
  branch_id: Joi.string().uuid().required().messages({
    'string.uuid': 'branch_id must be a valid UUID',
    'any.required': 'branch_id is required',
  }),
  qr_code_token: Joi.string().uuid().optional().messages({
    'string.uuid': 'qr_code_token must be a valid UUID',
  }),
  qr_code_data_url: qrCodeDataUrl,
  qr_data_url: qrCodeDataUrl,
  dataURL: qrCodeDataUrl,
  source: Joi.string()
    .valid(...Object.values(CHECKIN_SOURCE))
    .optional(),
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
  qr_code_data_url: qrCodeDataUrl,
  qr_data_url: qrCodeDataUrl,
  dataURL: qrCodeDataUrl,
  notes: Joi.string().trim().max(250).allow('', null).optional(),
});

const timeOnly = Joi.string()
  .pattern(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/)
  .messages({
    'string.pattern.base': 'Time must use HH:MM (24-hour) format',
  });

/**
 * POST /api/occupancy/admin/branches
 */
const createBranchSchema = Joi.object({
  name: Joi.string().trim().min(1).max(150).required().messages({
    'string.empty': 'name is required',
    'any.required': 'name is required',
  }),
  address: Joi.string().trim().max(250).allow('', null).optional(),
  city: Joi.string().trim().max(120).allow('', null).optional(),
  phone: Joi.string().trim().max(30).allow('', null).optional(),
  opening_time: timeOnly.allow('', null).optional(),
  closing_time: timeOnly.allow('', null).optional(),
  capacity: Joi.number().integer().min(1).max(10000).optional(),
});

/**
 * PATCH /api/occupancy/admin/branches/:branchId
 */
const updateBranchSchema = Joi.object({
  name: Joi.string().trim().min(1).max(150).optional(),
  address: Joi.string().trim().max(250).allow('', null).optional(),
  city: Joi.string().trim().max(120).allow('', null).optional(),
  phone: Joi.string().trim().max(30).allow('', null).optional(),
  opening_time: timeOnly.allow('', null).optional(),
  closing_time: timeOnly.allow('', null).optional(),
  capacity: Joi.number().integer().min(1).max(10000).optional(),
}).min(1);

/**
 * PATCH /api/occupancy/admin/branches/:branchId/status
 */
const setBranchActiveSchema = Joi.object({
  is_active: Joi.boolean().required(),
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
  branch_id: Joi.string().uuid().optional().messages({
    'string.uuid': 'branch_id must be a valid UUID',
  }),
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
  branch_id: Joi.string().uuid().optional().messages({
    'string.uuid': 'branch_id must be a valid UUID',
  }),
  date: dateOnly.optional(),
});

/**
 * GET /api/occupancy/current
 * Optional branch filter. Without branch_id, the endpoint returns all branches.
 */
const currentOccupancyQuerySchema = Joi.object({
  branch_id: Joi.string().uuid().optional().messages({
    'string.uuid': 'branch_id must be a valid UUID',
  }),
});

/**
 * POST /api/occupancy/admin/reset-open-sessions
 * Allows admin/scheduler to close stale open sessions at a specific time.
 */
const resetOpenSessionsSchema = Joi.object({
  branch_id: Joi.string().uuid().optional().messages({
    'string.uuid': 'branch_id must be a valid UUID',
  }),
  checkout_at: Joi.date().iso().optional().messages({
    'date.format': 'checkout_at must be a valid ISO datetime',
  }),
});

module.exports = {
  uuidParam,
  checkInSchema,
  checkOutSchema,
  createBranchSchema,
  updateBranchSchema,
  setBranchActiveSchema,
  sessionsQuerySchema,
  adminSessionsQuerySchema,
  dailyReportQuerySchema,
  currentOccupancyQuerySchema,
  resetOpenSessionsSchema,
};
