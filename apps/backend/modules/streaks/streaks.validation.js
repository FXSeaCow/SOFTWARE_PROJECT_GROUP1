/**
 * streaks.validation.js
 * Joi schemas for workout streak endpoints.
 *
 * The module accepts date-only strings because streaks are calendar-day based,
 * not timestamp based. This avoids accidental timezone shifts in the API layer.
 */

const Joi = require('joi');
const { STREAK_LIMITS, DATE_ONLY_PATTERN } = require('./streaks.constants');

/**
 * Build a UUID params schema for route IDs.
 *
 * @param {string} name - The route param name to validate.
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
 *
 * The custom validator rejects impossible dates such as 2026-02-31 while
 * still keeping the sanitized value as the original string.
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

    if (!isValidDate) {
      return helpers.error('date.format');
    }

    return value;
  })
  .messages({
    'string.pattern.base': 'Date must use YYYY-MM-DD format',
    'date.format': 'Date must be a real calendar date',
  });

/**
 * POST /api/streaks/checkins
 * Member records a workout check-in.
 *
 * checkin_date is optional so the regular mobile/frontend flow can simply
 * record today, while tests or admin tools can pass a specific date.
 */
const recordCheckinSchema = Joi.object({
  branch_id: Joi.string().uuid().required().messages({
    'string.uuid': 'branch_id must be a valid UUID',
    'any.required': 'branch_id is required',
  }),
  checkin_date: dateOnly.optional(),
});

/**
 * GET /api/streaks/me/checkins
 * Query params for the authenticated member's check-in history.
 */
const checkinsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(STREAK_LIMITS.DEFAULT_PAGE),
  limit: Joi.number()
    .integer()
    .min(1)
    .max(STREAK_LIMITS.MAX_LIMIT)
    .default(STREAK_LIMITS.DEFAULT_LIMIT),
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
 * GET /api/streaks/leaderboard
 * Query params for a lightweight leaderboard of top streaks.
 */
const leaderboardQuerySchema = Joi.object({
  limit: Joi.number()
    .integer()
    .min(1)
    .max(STREAK_LIMITS.MAX_LEADERBOARD_LIMIT)
    .default(STREAK_LIMITS.DEFAULT_LEADERBOARD_LIMIT),
});

module.exports = {
  uuidParam,
  recordCheckinSchema,
  checkinsQuerySchema,
  leaderboardQuerySchema,
};
