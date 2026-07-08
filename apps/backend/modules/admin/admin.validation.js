/**
 * admin.validation.js
 * Joi schemas for admin dashboard, reports, and statistics endpoints.
 */

const Joi = require('joi');

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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

const withDateRange = (schema) =>
  schema.custom((value, helpers) => {
    if (value.from_date && value.to_date && value.to_date < value.from_date) {
      return helpers.error('date.range');
    }
    return value;
  }).messages({
    'date.range': 'to_date must be after or equal to from_date',
  });

const baseRangeQuerySchema = withDateRange(
  Joi.object({
    from_date: dateOnly.optional(),
    to_date: dateOnly.optional(),
    group_by: Joi.string().valid('day', 'month').default('day'),
    limit: Joi.number().integer().min(1).max(366).default(30),
  })
);

const dashboardQuerySchema = Joi.object({
  expiring_days: Joi.number().integer().min(1).max(90).default(7),
  recent_limit: Joi.number().integer().min(1).max(30).default(7),
});

const revenueReportQuerySchema = baseRangeQuerySchema;

const membershipsReportQuerySchema = withDateRange(
  Joi.object({
    from_date: dateOnly.optional(),
    to_date: dateOnly.optional(),
    group_by: Joi.string().valid('day', 'month').default('month'),
    expiring_days: Joi.number().integer().min(1).max(90).default(7),
  })
);

const occupancyReportQuerySchema = baseRangeQuerySchema.keys({
  branch_id: Joi.string().uuid().optional().messages({
    'string.uuid': 'branch_id must be a valid UUID',
  }),
});

const usersStatisticsQuerySchema = baseRangeQuerySchema;

const workoutsStatisticsQuerySchema = baseRangeQuerySchema.keys({
  limit: Joi.number().integer().min(1).max(100).default(10),
});

const streaksStatisticsQuerySchema = baseRangeQuerySchema.keys({
  limit: Joi.number().integer().min(1).max(100).default(10),
});

const paymentsStatisticsQuerySchema = baseRangeQuerySchema;

module.exports = {
  dashboardQuerySchema,
  revenueReportQuerySchema,
  membershipsReportQuerySchema,
  occupancyReportQuerySchema,
  usersStatisticsQuerySchema,
  workoutsStatisticsQuerySchema,
  streaksStatisticsQuerySchema,
  paymentsStatisticsQuerySchema,
};
