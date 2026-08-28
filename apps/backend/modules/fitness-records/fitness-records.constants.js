/**
 * fitness-records.constants.js
 * Shared constants for the fitness records module.
 *
 * Keeping these values in one place makes validation, services, and helper
 * calculators use the same labels, limits, and response messages.
 */

/**
 * Biological sex values used only for body fat formula selection.
 */
const SEX = {
  MALE: 'male',
  FEMALE: 'female',
};

/**
 * BMI category labels based on common adult BMI ranges.
 */
const BMI_CATEGORY = {
  UNDERWEIGHT: 'underweight',
  NORMAL: 'normal',
  OVERWEIGHT: 'overweight',
  OBESE: 'obese',
};

/**
 * Body fat category labels.
 *
 * These are broad fitness-oriented ranges, not medical diagnoses.
 */
const BODY_FAT_CATEGORY = {
  ESSENTIAL: 'essential',
  ATHLETIC: 'athletic',
  FITNESS: 'fitness',
  AVERAGE: 'average',
  HIGH: 'high',
};

/**
 * Direction labels used by progressAnalyzer.
 */
const CHANGE_DIRECTION = {
  INCREASED: 'increased',
  DECREASED: 'decreased',
  UNCHANGED: 'unchanged',
};

/**
 * Supported member goal hints for progress summaries.
 */
const FITNESS_GOAL = {
  WEIGHT_LOSS: 'weight_loss',
  MUSCLE_GAIN: 'muscle_gain',
  MAINTENANCE: 'maintenance',
  GENERAL_FITNESS: 'general_fitness',
};

/**
 * Pagination and trend limits.
 */
const FITNESS_RECORD_LIMITS = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
  DEFAULT_PROGRESS_LIMIT: 30,
  MAX_PROGRESS_LIMIT: 365,
};

/**
 * Numeric measurement boundaries used by validation.
 */
const MEASUREMENT_LIMITS = {
  WEIGHT_KG_MIN: 20,
  WEIGHT_KG_MAX: 500,
  HEIGHT_CM_MIN: 80,
  HEIGHT_CM_MAX: 250,
  BODY_FAT_MIN: 2,
  BODY_FAT_MAX: 75,
  MUSCLE_MASS_MIN: 1,
  MUSCLE_MASS_MAX: 250,
  BODY_MEASURE_MIN: 10,
  BODY_MEASURE_MAX: 300,
};

/**
 * Standard controller response messages.
 */
const FITNESS_RECORD_MESSAGES = {
  CREATED: 'Fitness record created successfully',
  UPDATED: 'Fitness record updated successfully',
  DELETED: 'Fitness record deleted successfully',
  FETCHED: 'Fitness record fetched successfully',
  LIST_FETCHED: 'Fitness records fetched successfully',
  LATEST_FETCHED: 'Latest fitness record fetched successfully',
  PROGRESS_FETCHED: 'Fitness progress fetched successfully',
  DAILY_RECORD_EXISTS: 'A fitness record already exists for this date',
};

module.exports = {
  SEX,
  BMI_CATEGORY,
  BODY_FAT_CATEGORY,
  CHANGE_DIRECTION,
  FITNESS_GOAL,
  FITNESS_RECORD_LIMITS,
  MEASUREMENT_LIMITS,
  FITNESS_RECORD_MESSAGES,
};
