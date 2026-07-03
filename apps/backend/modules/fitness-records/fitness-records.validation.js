/**
 * fitness-records.validation.js
 * Joi schemas for fitness record endpoints.
 *
 * gym.sql stores date-only records in recorded_date and body fat in
 * body_fat_pct. Legacy aliases are still accepted at the API edge and mapped
 * in the service layer.
 */

const Joi = require('joi');
const {
  SEX,
  FITNESS_GOAL,
  FITNESS_RECORD_LIMITS,
  MEASUREMENT_LIMITS,
} = require('./fitness-records.constants');

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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
 * Shared numeric measurement helpers.
 */
const weightKg = Joi.number()
  .precision(2)
  .min(MEASUREMENT_LIMITS.WEIGHT_KG_MIN)
  .max(MEASUREMENT_LIMITS.WEIGHT_KG_MAX);

const heightCm = Joi.number()
  .precision(2)
  .min(MEASUREMENT_LIMITS.HEIGHT_CM_MIN)
  .max(MEASUREMENT_LIMITS.HEIGHT_CM_MAX);

const bodyMeasureCm = Joi.number()
  .precision(2)
  .min(MEASUREMENT_LIMITS.BODY_MEASURE_MIN)
  .max(MEASUREMENT_LIMITS.BODY_MEASURE_MAX);

const bodyFatPct = Joi.number()
  .precision(2)
  .min(MEASUREMENT_LIMITS.BODY_FAT_MIN)
  .max(MEASUREMENT_LIMITS.BODY_FAT_MAX);

/**
 * Fields that can be stored on a fitness record.
 */
const recordFields = {
  recorded_date: dateOnly.optional(),
  recorded_at: dateOnly.optional(),
  weight_kg: weightKg,
  height_cm: heightCm,
  body_fat_pct: bodyFatPct,
  body_fat_percent: bodyFatPct,
  notes: Joi.string().trim().max(500).allow('', null),
};

/**
 * Transient calculator-only fields.
 *
 * These fields are not stored in gym.sql; they only allow the service to
 * estimate body_fat_pct when no measured value is supplied.
 */
const calculatorFields = {
  sex: Joi.string().valid(...Object.values(SEX)).optional(),
  waist_cm: bodyMeasureCm,
  neck_cm: bodyMeasureCm,
  hip_cm: bodyMeasureCm,
};

/**
 * POST /api/fitness-records
 * Member creates a new measurement snapshot.
 */
const createRecordSchema = Joi.object({
  ...recordFields,
  ...calculatorFields,
  weight_kg: weightKg.required().messages({
    'any.required': 'weight_kg is required',
  }),
  height_cm: heightCm.required().messages({
    'any.required': 'height_cm is required',
  }),
});

/**
 * PATCH /api/fitness-records/:recordId
 * Member updates a measurement snapshot.
 */
const updateRecordSchema = Joi.object({
  ...recordFields,
  ...calculatorFields,
}).min(1).messages({
  'object.min': 'At least one field must be provided to update',
});

/**
 * GET /api/fitness-records/me
 * Query params for the authenticated member's record list.
 */
const listRecordsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(FITNESS_RECORD_LIMITS.DEFAULT_PAGE),
  limit: Joi.number()
    .integer()
    .min(1)
    .max(FITNESS_RECORD_LIMITS.MAX_LIMIT)
    .default(FITNESS_RECORD_LIMITS.DEFAULT_LIMIT),
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
 * GET /api/fitness-records/me/progress
 * Query params for progress analysis.
 */
const progressQuerySchema = Joi.object({
  from_date: dateOnly.optional(),
  to_date: dateOnly.optional(),
  limit: Joi.number()
    .integer()
    .min(2)
    .max(FITNESS_RECORD_LIMITS.MAX_PROGRESS_LIMIT)
    .default(FITNESS_RECORD_LIMITS.DEFAULT_PROGRESS_LIMIT),
  goal: Joi.string()
    .valid(...Object.values(FITNESS_GOAL))
    .default(FITNESS_GOAL.GENERAL_FITNESS),
}).custom((value, helpers) => {
  if (value.from_date && value.to_date && value.to_date < value.from_date) {
    return helpers.error('date.range');
  }
  return value;
}).messages({
  'date.range': 'to_date must be after or equal to from_date',
});

/**
 * GET /api/fitness-records/admin
 * Admin list filters.
 */
const adminRecordsQuerySchema = listRecordsQuerySchema.keys({
  user_id: Joi.string().uuid().optional().messages({
    'string.uuid': 'user_id must be a valid UUID',
  }),
});

module.exports = {
  uuidParam,
  createRecordSchema,
  updateRecordSchema,
  listRecordsQuerySchema,
  progressQuerySchema,
  adminRecordsQuerySchema,
};
