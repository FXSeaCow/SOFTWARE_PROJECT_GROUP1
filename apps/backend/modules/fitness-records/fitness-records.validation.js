/**
 * fitness-records.validation.js
 * Joi schemas for fitness record endpoints.
 *
 * Validation strips unknown fields so transient calculator inputs such as
 * "sex" are accepted only where explicitly supported.
 */

const Joi = require('joi');
const {
  SEX,
  FITNESS_GOAL,
  FITNESS_RECORD_LIMITS,
  MEASUREMENT_LIMITS,
} = require('./fitness-records.constants');

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

/**
 * Fields that can be stored on a fitness record.
 */
const recordFields = {
  recorded_at: Joi.date().iso().optional().messages({
    'date.format': 'recorded_at must be a valid ISO datetime',
  }),
  weight_kg: weightKg,
  height_cm: heightCm,
  body_fat_percent: Joi.number()
    .precision(2)
    .min(MEASUREMENT_LIMITS.BODY_FAT_MIN)
    .max(MEASUREMENT_LIMITS.BODY_FAT_MAX),
  muscle_mass_kg: Joi.number()
    .precision(2)
    .min(MEASUREMENT_LIMITS.MUSCLE_MASS_MIN)
    .max(MEASUREMENT_LIMITS.MUSCLE_MASS_MAX),
  waist_cm: bodyMeasureCm,
  chest_cm: bodyMeasureCm,
  hip_cm: bodyMeasureCm,
  neck_cm: bodyMeasureCm,
  arm_cm: bodyMeasureCm,
  thigh_cm: bodyMeasureCm,
  notes: Joi.string().trim().max(500).allow('', null),
};

/**
 * Transient calculator-only fields.
 *
 * sex is not stored by the repository. It only tells the body fat calculator
 * which formula to use when body_fat_percent is not provided.
 */
const calculatorFields = {
  sex: Joi.string().valid(...Object.values(SEX)).optional(),
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
  from_date: Joi.date().iso().optional(),
  to_date: Joi.date().iso().min(Joi.ref('from_date')).optional().messages({
    'date.min': 'to_date must be after from_date',
  }),
});

/**
 * GET /api/fitness-records/me/progress
 * Query params for progress analysis.
 */
const progressQuerySchema = Joi.object({
  from_date: Joi.date().iso().optional(),
  to_date: Joi.date().iso().min(Joi.ref('from_date')).optional().messages({
    'date.min': 'to_date must be after from_date',
  }),
  limit: Joi.number()
    .integer()
    .min(2)
    .max(FITNESS_RECORD_LIMITS.MAX_PROGRESS_LIMIT)
    .default(FITNESS_RECORD_LIMITS.DEFAULT_PROGRESS_LIMIT),
  goal: Joi.string()
    .valid(...Object.values(FITNESS_GOAL))
    .default(FITNESS_GOAL.GENERAL_FITNESS),
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
