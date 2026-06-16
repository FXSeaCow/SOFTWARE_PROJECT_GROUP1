/**
 * transaction.js
 * Helper to run multiple database operations inside a single PostgreSQL
 * transaction — if any step throws, everything rolls back automatically.
 *
 * Needed for operations that touch multiple tables atomically:
 *   - Membership renewal: INSERT memberships + INSERT payments  (FR-05, FR-27)
 *   - Workout plan generation: INSERT workout_plans + 7× workout_days
 *     + N× workout_day_exercises  (FR-07)
 *   - QR check-in: INSERT gym_sessions + INSERT workout_checkins
 *     + UPDATE workout_streaks  (FR-17, FR-13)
 *
 * Usage:
 *   const result = await withTransaction(async (client) => {
 *     const { rows: [plan] } = await client.query(
 *       'INSERT INTO workout_plans (...) VALUES (...) RETURNING *', [...]
 *     );
 *     await client.query(
 *       'INSERT INTO workout_days (...) VALUES ...', [...]
 *     );
 *     return plan;
 *   });
 */

const db = require('../config/db');
const logger = require('./logger');

/**
 * Execute a callback function inside a PostgreSQL transaction.
 * A dedicated client is checked out of the pool, used only for this
 * transaction, then released regardless of success or failure.
 *
 * @template T
 * @param {(client: import('pg').PoolClient) => Promise<T>} callback
 * @returns {Promise<T>} whatever the callback returns
 * @throws re-throws any error after rolling back
 */
const withTransaction = async (callback) => {
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const result = await callback(client);

    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Transaction rolled back', { error: err.message });
    throw err; // re-throw so the caller's error handler catches it
  } finally {
    client.release(); // always return the client to the pool
  }
};

module.exports = { withTransaction };