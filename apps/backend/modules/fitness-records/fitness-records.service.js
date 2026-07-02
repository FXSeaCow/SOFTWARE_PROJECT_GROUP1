/**
 * fitness-records.service.js
 * Business logic for member fitness measurements.
 *
 * Responsibilities:
 *   - Create, update, list, and delete fitness records.
 *   - Calculate derived metrics such as BMI and estimated body fat.
 *   - Analyze progress between measurement snapshots.
 */

const repo = require('./fitness-records.repository');
const { buildBMISummary } = require('./bmiCalculator');
const { buildBodyFatSummary } = require('./bodyFatCalculator');
const { analyzeProgress } = require('./progressAnalyzer');
const { parse: parsePagination } = require('../../utils/Pagination');
const ApiError = require('../../utils/Apierror');
const logger = require('../../utils/Logger');

/**
 * Convert a record row into an API-friendly object with calculated labels.
 *
 * @param {object|null} record
 * @returns {object|null}
 */
const decorateRecord = (record) => {
  if (!record) return null;

  const bmiSummary = buildBMISummary(record.weight_kg, record.height_cm);

  return {
    ...record,
    bmi: record.bmi ?? bmiSummary.bmi,
    bmi_category: bmiSummary.bmi_category,
    healthy_weight_range: bmiSummary.healthy_weight_range,
  };
};

/**
 * Remove fields used only for calculations and not stored in fitness_records.
 *
 * @param {object} data
 * @returns {object}
 */
const stripTransientFields = (data) => {
  const { sex: _sex, ...persisted } = data;
  return persisted;
};

/**
 * Calculate all derived fields before insert/update.
 *
 * @param {object} data
 * @returns {object}
 */
const buildRecordPayload = (data) => {
  const bmiSummary = buildBMISummary(data.weight_kg, data.height_cm);
  const bodyFatSummary = buildBodyFatSummary(data);
  const payload = stripTransientFields(data);

  return {
    ...payload,
    bmi: bmiSummary.bmi,
    body_fat_percent: bodyFatSummary.body_fat_percent,
  };
};

/**
 * Merge existing record data with patch fields so derived values can be
 * recalculated consistently.
 *
 * @param {object} existing
 * @param {object} fields
 * @returns {object}
 */
const buildUpdatePayload = (existing, fields) => {
  const merged = {
    ...existing,
    ...fields,
  };

  const patch = stripTransientFields(fields);
  const bmiSummary = buildBMISummary(merged.weight_kg, merged.height_cm);

  // Always keep derived metrics in sync when source measurements change.
  patch.bmi = bmiSummary.bmi;

  const shouldRecalculateBodyFat =
    fields.body_fat_percent !== undefined ||
    fields.sex !== undefined ||
    fields.waist_cm !== undefined ||
    fields.neck_cm !== undefined ||
    fields.hip_cm !== undefined ||
    fields.height_cm !== undefined;

  if (shouldRecalculateBodyFat) {
    const bodyFatInput =
      fields.body_fat_percent !== undefined
        ? merged
        : { ...merged, body_fat_percent: undefined };

    patch.body_fat_percent = buildBodyFatSummary(bodyFatInput).body_fat_percent;
  }

  return patch;
};

/**
 * Create a new fitness record for a member.
 *
 * @param {string} userId
 * @param {object} data
 * @returns {Promise<object>}
 */
const createRecord = async (userId, data) => {
  const payload = buildRecordPayload({
    ...data,
    user_id: userId,
  });

  const record = await repo.createRecord(payload);
  logger.info('Fitness record created', { userId, recordId: record.id });
  return decorateRecord(record);
};

/**
 * List the authenticated member's records.
 *
 * @param {string} userId
 * @param {object} query
 * @returns {Promise<{ records: object[], total: number, page: number, limit: number }>}
 */
const listMyRecords = async (userId, query = {}) => {
  const { page, limit, offset } = parsePagination(query);
  const { rows, total } = await repo.findAll({
    user_id: userId,
    from_date: query.from_date,
    to_date: query.to_date,
    limit,
    offset,
  });

  return {
    records: rows.map(decorateRecord),
    total,
    page,
    limit,
  };
};

/**
 * Admin: list records across all users.
 *
 * @param {object} query
 * @returns {Promise<{ records: object[], total: number, page: number, limit: number }>}
 */
const listAllRecords = async (query = {}) => {
  const { page, limit, offset } = parsePagination(query);
  const { rows, total } = await repo.findAll({
    user_id: query.user_id,
    from_date: query.from_date,
    to_date: query.to_date,
    limit,
    offset,
  });

  return {
    records: rows.map(decorateRecord),
    total,
    page,
    limit,
  };
};

/**
 * Get one record owned by the authenticated member.
 *
 * @param {string} recordId
 * @param {string} userId
 * @returns {Promise<object>}
 */
const getMyRecordById = async (recordId, userId) => {
  const record = await repo.findByIdAndUser(recordId, userId);
  if (!record) throw ApiError.notFound('Fitness record');
  return decorateRecord(record);
};

/**
 * Admin: get any record by ID.
 *
 * @param {string} recordId
 * @returns {Promise<object>}
 */
const getRecordById = async (recordId) => {
  const record = await repo.findById(recordId);
  if (!record) throw ApiError.notFound('Fitness record');
  return decorateRecord(record);
};

/**
 * Get the authenticated member's latest record.
 *
 * @param {string} userId
 * @returns {Promise<object>}
 */
const getLatestRecord = async (userId) => {
  const record = await repo.findLatestByUser(userId);
  if (!record) throw ApiError.notFound('Fitness record');
  return decorateRecord(record);
};

/**
 * Update a record owned by the authenticated member.
 *
 * @param {string} recordId
 * @param {string} userId
 * @param {object} fields
 * @returns {Promise<object>}
 */
const updateRecord = async (recordId, userId, fields) => {
  const existing = await repo.findByIdAndUser(recordId, userId);
  if (!existing) throw ApiError.notFound('Fitness record');

  const payload = buildUpdatePayload(existing, fields);
  const updated = await repo.updateRecord(recordId, userId, payload);

  logger.info('Fitness record updated', { userId, recordId });
  return decorateRecord(updated);
};

/**
 * Delete a record owned by the authenticated member.
 *
 * @param {string} recordId
 * @param {string} userId
 * @returns {Promise<void>}
 */
const deleteRecord = async (recordId, userId) => {
  const existing = await repo.findByIdAndUser(recordId, userId);
  if (!existing) throw ApiError.notFound('Fitness record');

  await repo.deleteRecord(recordId, userId);
  logger.info('Fitness record deleted', { userId, recordId });
};

/**
 * Analyze a member's progress.
 *
 * @param {string} userId
 * @param {object} query
 * @returns {Promise<object>}
 */
const getProgress = async (userId, query = {}) => {
  const records = await repo.findForProgress({
    user_id: userId,
    from_date: query.from_date,
    to_date: query.to_date,
    limit: query.limit,
  });

  const decorated = records.map(decorateRecord);
  return analyzeProgress(decorated, { goal: query.goal });
};

module.exports = {
  createRecord,
  listMyRecords,
  listAllRecords,
  getMyRecordById,
  getRecordById,
  getLatestRecord,
  updateRecord,
  deleteRecord,
  getProgress,

  // Exported for focused unit tests.
  buildRecordPayload,
  decorateRecord,
};
