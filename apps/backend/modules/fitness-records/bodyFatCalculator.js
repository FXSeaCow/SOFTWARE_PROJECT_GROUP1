/**
 * bodyFatCalculator.js
 * Utility functions for estimating body fat percentage.
 *
 * The main calculation uses the US Navy circumference method:
 *   - Male:   waist, neck, height
 *   - Female: waist, neck, hip, height
 *
 * This is an estimate. If a member enters a measured body_fat_percent from a
 * smart scale or trainer assessment, the service can store that value directly.
 */

const {
  SEX,
  BODY_FAT_CATEGORY,
} = require('./fitness-records.constants');

/**
 * Round a number to two decimal places.
 *
 * @param {number} value
 * @returns {number}
 */
const roundTwo = (value) => Math.round((Number(value) || 0) * 100) / 100;

/**
 * Convert centimeters to inches because the Navy formula is inch-based.
 *
 * @param {number} cm
 * @returns {number}
 */
const cmToInches = (cm) => Number(cm) / 2.54;

/**
 * Check whether all provided numbers are positive.
 *
 * @param {number[]} values
 * @returns {boolean}
 */
const arePositiveNumbers = (values) =>
  values.every((value) => Number(value) > 0);

/**
 * Estimate body fat percentage using the US Navy formula.
 *
 * @param {{ sex: string, height_cm: number, waist_cm: number, neck_cm: number, hip_cm?: number }} data
 * @returns {number|null}
 */
const calculateBodyFatPercentage = ({
  sex,
  height_cm,
  waist_cm,
  neck_cm,
  hip_cm,
}) => {
  if (!sex || !height_cm || !waist_cm || !neck_cm) return null;

  const heightIn = cmToInches(height_cm);
  const waistIn = cmToInches(waist_cm);
  const neckIn = cmToInches(neck_cm);

  if (!arePositiveNumbers([heightIn, waistIn, neckIn])) return null;

  if (sex === SEX.MALE) {
    const waistMinusNeck = waistIn - neckIn;
    if (waistMinusNeck <= 0) return null;

    return roundTwo(
      86.01 * Math.log10(waistMinusNeck) -
      70.041 * Math.log10(heightIn) +
      36.76
    );
  }

  if (sex === SEX.FEMALE) {
    if (!hip_cm) return null;

    const hipIn = cmToInches(hip_cm);
    const circumference = waistIn + hipIn - neckIn;
    if (!arePositiveNumbers([hipIn]) || circumference <= 0) return null;

    return roundTwo(
      163.205 * Math.log10(circumference) -
      97.684 * Math.log10(heightIn) -
      78.387
    );
  }

  return null;
};

/**
 * Classify body fat percentage by broad sex-specific fitness ranges.
 *
 * @param {number|null} bodyFatPercent
 * @param {string} sex
 * @returns {string|null}
 */
const classifyBodyFat = (bodyFatPercent, sex) => {
  if (bodyFatPercent === null || bodyFatPercent === undefined || !sex) return null;

  const value = Number(bodyFatPercent);

  if (sex === SEX.MALE) {
    if (value < 6) return BODY_FAT_CATEGORY.ESSENTIAL;
    if (value < 14) return BODY_FAT_CATEGORY.ATHLETIC;
    if (value < 18) return BODY_FAT_CATEGORY.FITNESS;
    if (value < 25) return BODY_FAT_CATEGORY.AVERAGE;
    return BODY_FAT_CATEGORY.HIGH;
  }

  if (sex === SEX.FEMALE) {
    if (value < 14) return BODY_FAT_CATEGORY.ESSENTIAL;
    if (value < 21) return BODY_FAT_CATEGORY.ATHLETIC;
    if (value < 25) return BODY_FAT_CATEGORY.FITNESS;
    if (value < 32) return BODY_FAT_CATEGORY.AVERAGE;
    return BODY_FAT_CATEGORY.HIGH;
  }

  return null;
};

/**
 * Build a body fat summary from either a provided value or circumference data.
 *
 * @param {object} data
 * @returns {{ body_fat_percent: number|null, body_fat_category: string|null, estimated: boolean }}
 */
const buildBodyFatSummary = (data) => {
  const provided = data.body_fat_percent !== undefined && data.body_fat_percent !== null;
  const bodyFatPercent = provided
    ? roundTwo(data.body_fat_percent)
    : calculateBodyFatPercentage(data);

  return {
    body_fat_percent: bodyFatPercent,
    body_fat_category: classifyBodyFat(bodyFatPercent, data.sex),
    estimated: !provided && bodyFatPercent !== null,
  };
};

module.exports = {
  calculateBodyFatPercentage,
  classifyBodyFat,
  buildBodyFatSummary,
};
