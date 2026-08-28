/**
 * fitness-records.repository.js
 * Raw PostgreSQL queries for fitness_records.
 *
 * This file mirrors gym.sql:
 *   fitness_records(
 *     id, user_id, weight_kg, height_cm, body_fat_pct,
 *     bmi GENERATED, notes, recorded_date, created_at
 *   )
 */

const db = require('../../config/db');

/**
 * Return a common SELECT projection for fitness records.
 *
 * The API keeps body_fat_percent and recorded_at aliases for older callers,
 * but all storage uses the gym.sql column names.
 *
 * @param {string} alias
 * @returns {string}
 */
const recordSelect = (alias = 'fr') => `
  ${alias}.id,
  ${alias}.user_id,
  ${alias}.recorded_date::TEXT AS recorded_date,
  ${alias}.recorded_date::TEXT AS recorded_at,
  ${alias}.weight_kg,
  ${alias}.height_cm,
  ${alias}.bmi,
  ${alias}.body_fat_pct,
  ${alias}.body_fat_pct AS body_fat_percent,
  ${alias}.notes,
  ${alias}.created_at
`;

/**
 * Build dynamic filters for record listing.
 *
 * @param {{ user_id?: string, from_date?: string|Date, to_date?: string|Date }} filters
 * @returns {{ where: string, values: Array, nextIndex: number }}
 */
const buildRecordFilters = (filters = {}) => {
  const conditions = [];
  const values = [];
  let idx = 1;

  if (filters.user_id) {
    conditions.push(`fr.user_id = $${idx++}`);
    values.push(filters.user_id);
  }

  if (filters.from_date) {
    conditions.push(`fr.recorded_date >= $${idx++}::date`);
    values.push(filters.from_date);
  }

  if (filters.to_date) {
    conditions.push(`fr.recorded_date <= $${idx++}::date`);
    values.push(filters.to_date);
  }

  return {
    where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    values,
    nextIndex: idx,
  };
};

/**
 * Create a new fitness record.
 *
 * @param {object} data
 * @returns {Promise<object>}
 */
const createRecord = async (data) => {
  const { rows } = await db.query(
    `INSERT INTO fitness_records (
       user_id,
       recorded_date,
       weight_kg,
       height_cm,
       body_fat_pct,
       notes
     )
     VALUES ($1, COALESCE($2::date, CURRENT_DATE), $3, $4, $5, $6)
     RETURNING ${recordSelect('fitness_records')}`,
    [
      data.user_id,
      data.recorded_date || null,
      data.weight_kg ?? null,
      data.height_cm ?? null,
      data.body_fat_pct ?? null,
      data.notes || null,
    ]
  );
  return rows[0];
};

/**
 * Find a record by ID and verify ownership.
 *
 * @param {string} recordId
 * @param {string} userId
 * @returns {Promise<object|null>}
 */
const findByIdAndUser = async (recordId, userId) => {
  const { rows } = await db.query(
    `SELECT ${recordSelect('fr')}
     FROM fitness_records fr
     WHERE fr.id = $1
       AND fr.user_id = $2`,
    [recordId, userId]
  );
  return rows[0] || null;
};

/**
 * Find a record by ID for admin views.
 *
 * @param {string} recordId
 * @returns {Promise<object|null>}
 */
const findById = async (recordId) => {
  const { rows } = await db.query(
    `SELECT ${recordSelect('fr')},
            u.full_name AS user_name,
            u.email AS user_email
     FROM fitness_records fr
     JOIN users u ON u.id = fr.user_id
     WHERE fr.id = $1`,
    [recordId]
  );
  return rows[0] || null;
};

/**
 * Find the latest record for a user.
 *
 * @param {string} userId
 * @returns {Promise<object|null>}
 */
const findLatestByUser = async (userId) => {
  const { rows } = await db.query(
    `SELECT ${recordSelect('fr')}
     FROM fitness_records fr
     WHERE fr.user_id = $1
     ORDER BY fr.recorded_date DESC, fr.created_at DESC
     LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
};

/**
 * Find one record for a user on a specific recorded_date.
 *
 * @param {string} userId
 * @param {string|Date|null} recordedDate
 * @param {string|null} excludeRecordId
 * @returns {Promise<object|null>}
 */
const findByUserAndRecordedDate = async (
  userId,
  recordedDate,
  excludeRecordId = null
) => {
  const values = [userId, recordedDate || null];
  let excludeClause = '';

  if (excludeRecordId) {
    excludeClause = 'AND fr.id <> $3';
    values.push(excludeRecordId);
  }

  const { rows } = await db.query(
    `SELECT ${recordSelect('fr')}
     FROM fitness_records fr
     WHERE fr.user_id = $1
       AND fr.recorded_date = COALESCE($2::date, CURRENT_DATE)
       ${excludeClause}
     LIMIT 1`,
    values
  );

  return rows[0] || null;
};

/**
 * List records with optional filters and pagination.
 *
 * @param {{ user_id?: string, from_date?: string|Date, to_date?: string|Date, limit: number, offset: number }} opts
 * @returns {Promise<{ rows: object[], total: number }>}
 */
const findAll = async (opts) => {
  const { where, values, nextIndex } = buildRecordFilters(opts);

  const countResult = await db.query(
    `SELECT COUNT(*)::INT AS total
     FROM fitness_records fr
     ${where}`,
    values
  );

  const { rows } = await db.query(
    `SELECT ${recordSelect('fr')},
            u.full_name AS user_name,
            u.email AS user_email
     FROM fitness_records fr
     JOIN users u ON u.id = fr.user_id
     ${where}
     ORDER BY fr.recorded_date DESC, fr.created_at DESC
     LIMIT $${nextIndex} OFFSET $${nextIndex + 1}`,
    [...values, opts.limit, opts.offset]
  );

  return {
    rows,
    total: countResult.rows[0].total,
  };
};

/**
 * Return records ordered oldest to newest for progress analysis.
 *
 * @param {{ user_id: string, from_date?: string|Date, to_date?: string|Date, limit: number }} opts
 * @returns {Promise<object[]>}
 */
const findForProgress = async (opts) => {
  const { where, values, nextIndex } = buildRecordFilters(opts);

  const { rows } = await db.query(
    `SELECT *
     FROM (
       SELECT ${recordSelect('fr')}
       FROM fitness_records fr
       ${where}
       ORDER BY fr.recorded_date DESC, fr.created_at DESC
       LIMIT $${nextIndex}
     ) latest_records
     ORDER BY latest_records.recorded_date ASC, latest_records.created_at ASC`,
    [...values, opts.limit]
  );

  return rows;
};

/**
 * Update a record. Only provided fields are changed.
 *
 * @param {string} recordId
 * @param {string} userId
 * @param {object} fields
 * @returns {Promise<object|null>}
 */
const updateRecord = async (recordId, userId, fields) => {
  const allowed = [
    'recorded_date',
    'weight_kg',
    'height_cm',
    'body_fat_pct',
    'notes',
  ];

  const setClauses = [];
  const values = [];
  let idx = 1;

  allowed.forEach((key) => {
    if (fields[key] !== undefined) {
      setClauses.push(`${key} = $${idx++}`);
      values.push(fields[key]);
    }
  });

  if (setClauses.length === 0) return findByIdAndUser(recordId, userId);

  values.push(recordId, userId);

  const { rows } = await db.query(
    `UPDATE fitness_records
     SET ${setClauses.join(', ')}
     WHERE id = $${idx++}
       AND user_id = $${idx}
     RETURNING ${recordSelect('fitness_records')}`,
    values
  );

  return rows[0] || null;
};

/**
 * Delete a record owned by a user.
 *
 * @param {string} recordId
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
const deleteRecord = async (recordId, userId) => {
  const { rowCount } = await db.query(
    `DELETE FROM fitness_records
     WHERE id = $1
       AND user_id = $2`,
    [recordId, userId]
  );
  return rowCount > 0;
};

module.exports = {
  createRecord,
  findByIdAndUser,
  findById,
  findLatestByUser,
  findByUserAndRecordedDate,
  findAll,
  findForProgress,
  updateRecord,
  deleteRecord,
};
