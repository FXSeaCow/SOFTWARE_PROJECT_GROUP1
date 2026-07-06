/**
 * progressAnalyzer.js
 * Helper functions for comparing fitness records over time.
 *
 * The analyzer expects records ordered by recorded_date ascending. It returns
 * human-friendly deltas and chart-ready trend arrays for the frontend.
 */

const {
  CHANGE_DIRECTION,
  FITNESS_GOAL,
} = require('./fitness-records.constants');

/**
 * Round a number to two decimal places.
 *
 * @param {number} value
 * @returns {number}
 */
const roundTwo = (value) => Math.round((Number(value) || 0) * 100) / 100;

/**
 * Return a direction label for a numeric delta.
 *
 * @param {number|null} delta
 * @returns {string|null}
 */
const getDirection = (delta) => {
  if (delta === null || delta === undefined) return null;
  if (delta > 0) return CHANGE_DIRECTION.INCREASED;
  if (delta < 0) return CHANGE_DIRECTION.DECREASED;
  return CHANGE_DIRECTION.UNCHANGED;
};

/**
 * Calculate a numeric change between two values.
 *
 * @param {number|null|undefined} current
 * @param {number|null|undefined} previous
 * @returns {{ previous: number|null, current: number|null, change: number|null, direction: string|null }}
 */
const compareMetric = (current, previous) => {
  const hasCurrent = current !== null && current !== undefined;
  const hasPrevious = previous !== null && previous !== undefined;

  if (!hasCurrent || !hasPrevious) {
    return {
      previous: hasPrevious ? Number(previous) : null,
      current: hasCurrent ? Number(current) : null,
      change: null,
      direction: null,
    };
  }

  const change = roundTwo(Number(current) - Number(previous));

  return {
    previous: Number(previous),
    current: Number(current),
    change,
    direction: getDirection(change),
  };
};

const getRecordDate = (record) => record.recorded_date ?? record.recorded_at;
const getBodyFat = (record) =>
  record.body_fat_pct ?? record.body_fat_percent ?? null;

/**
 * Compare two fitness records.
 *
 * @param {object} currentRecord
 * @param {object} previousRecord
 * @returns {object}
 */
const compareRecords = (currentRecord, previousRecord) => ({
  from_record_id: previousRecord.id,
  to_record_id: currentRecord.id,
  from_date: getRecordDate(previousRecord),
  to_date: getRecordDate(currentRecord),
  weight: compareMetric(currentRecord.weight_kg, previousRecord.weight_kg),
  bmi: compareMetric(currentRecord.bmi, previousRecord.bmi),
  body_fat: compareMetric(getBodyFat(currentRecord), getBodyFat(previousRecord)),
});

/**
 * Build chart-ready trend data from records.
 *
 * @param {object[]} records
 * @returns {object[]}
 */
const buildTrendSeries = (records = []) =>
  records.map((record) => {
    const recordedDate = getRecordDate(record);
    const bodyFat = getBodyFat(record);

    return {
      record_id: record.id,
      recorded_date: recordedDate,
      recorded_at: recordedDate,
      weight_kg: record.weight_kg ?? null,
      bmi: record.bmi ?? null,
      body_fat_pct: bodyFat,
      body_fat_percent: bodyFat,
    };
  });

/**
 * Build a simple goal-aware interpretation for the latest progress.
 *
 * @param {object|null} comparison
 * @param {string} goal
 * @returns {string}
 */
const buildProgressMessage = (comparison, goal = FITNESS_GOAL.GENERAL_FITNESS) => {
  if (!comparison || comparison.weight.change === null) {
    return 'Not enough records to calculate progress yet';
  }

  const weightChange = comparison.weight.change;
  const bodyFatChange = comparison.body_fat.change;

  if (goal === FITNESS_GOAL.WEIGHT_LOSS) {
    if (weightChange < 0) return 'Weight is trending down';
    if (weightChange > 0) return 'Weight is trending up';
    return 'Weight is stable';
  }

  if (goal === FITNESS_GOAL.MUSCLE_GAIN) {
    if (weightChange > 0) return 'Body weight is trending up';
    return 'Muscle gain progress is stable';
  }

  if (bodyFatChange !== null && bodyFatChange < 0) {
    return 'Body fat is trending down';
  }

  return 'Progress is being tracked';
};

/**
 * Analyze a list of records and return summary plus trends.
 *
 * @param {object[]} records - Ordered by recorded_date ascending.
 * @param {{ goal?: string }} options
 * @returns {object}
 */
const analyzeProgress = (records = [], options = {}) => {
  if (records.length === 0) {
    return {
      record_count: 0,
      first_record: null,
      latest_record: null,
      overall_change: null,
      latest_change: null,
      trend: [],
      message: 'No fitness records found',
    };
  }

  const firstRecord = records[0];
  const latestRecord = records[records.length - 1];
  const previousRecord = records.length > 1 ? records[records.length - 2] : null;

  const overallChange =
    records.length > 1 ? compareRecords(latestRecord, firstRecord) : null;
  const latestChange =
    previousRecord ? compareRecords(latestRecord, previousRecord) : null;

  return {
    record_count: records.length,
    first_record: firstRecord,
    latest_record: latestRecord,
    overall_change: overallChange,
    latest_change: latestChange,
    trend: buildTrendSeries(records),
    message: buildProgressMessage(latestChange, options.goal),
  };
};

module.exports = {
  compareMetric,
  compareRecords,
  buildTrendSeries,
  analyzeProgress,
};
