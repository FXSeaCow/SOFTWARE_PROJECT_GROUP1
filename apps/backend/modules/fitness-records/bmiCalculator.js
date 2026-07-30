/**
 * bmiCalculator.js
 * Utility functions for Body Mass Index calculations.
 *
 * BMI is useful as a quick weight-to-height indicator, but it does not measure
 * muscle mass or body composition. Services should expose it as a supporting
 * metric, not as a final health diagnosis.
 */

const { BMI_CATEGORY } = require('./fitness-records.constants');

/**
 * Round a number to two decimal places.
 *
 * @param {number} value
 * @returns {number}
 */
const roundTwo = (value) => Math.round((Number(value) || 0) * 100) / 100;

/**
 * Calculate BMI from weight and height.
 *
 * Formula:
 *   BMI = weight_kg / (height_m * height_m)
 *
 * @param {number} weightKg
 * @param {number} heightCm
 * @returns {number|null}
 */
const calculateBMI = (weightKg, heightCm) => {
  const weight = Number(weightKg);
  const height = Number(heightCm);

  if (!weight || !height || weight <= 0 || height <= 0) return null;

  const heightM = height / 100;
  return roundTwo(weight / (heightM * heightM));
};

/**
 * Return a BMI category label.
 *
 * @param {number|null} bmi
 * @returns {string|null}
 */
const classifyBMI = (bmi) => {
  if (bmi === null || bmi === undefined) return null;

  const value = Number(bmi);
  if (value < 18.5) return BMI_CATEGORY.UNDERWEIGHT;
  if (value < 25) return BMI_CATEGORY.NORMAL;
  if (value < 30) return BMI_CATEGORY.OVERWEIGHT;
  return BMI_CATEGORY.OBESE;
};

/**
 * Calculate a healthy adult weight range for a height using BMI 18.5-24.9.
 *
 * @param {number} heightCm
 * @returns {{ min_weight_kg: number, max_weight_kg: number }|null}
 */
const calculateHealthyWeightRange = (heightCm) => {
  const height = Number(heightCm);
  if (!height || height <= 0) return null;

  const heightM = height / 100;
  return {
    min_weight_kg: roundTwo(18.5 * heightM * heightM),
    max_weight_kg: roundTwo(24.9 * heightM * heightM),
  };
};

/**
 * Build a complete BMI summary for API responses.
 *
 * @param {number} weightKg
 * @param {number} heightCm
 * @returns {{ bmi: number|null, bmi_category: string|null, healthy_weight_range: object|null }}
 */
const buildBMISummary = (weightKg, heightCm) => {
  const bmi = calculateBMI(weightKg, heightCm);

  return {
    bmi,
    bmi_category: classifyBMI(bmi),
    healthy_weight_range: calculateHealthyWeightRange(heightCm),
  };
};

module.exports = {
  calculateBMI,
  classifyBMI,
  calculateHealthyWeightRange,
  buildBMISummary,
};
