/**
 * src/tests/setup.js
 * Runs once before the entire Jest test suite.
 *
 * Responsibilities:
 *   1. Load test environment variables from .env.test
 *   2. Expose a global helper (truncateAll) to wipe tables between tests
 *   3. Close the DB pool after all tests finish (prevents Jest hanging)
 */

// Load .env.test before anything else imports config/db.js
require('dotenv').config({ path: '.env.test' });

const db = require('../config/db');

// ─── Global helpers available in every test file ──────────────────────────────

/**
 * truncateAll()
 * Wipes all data-bearing tables in the correct order (respecting FK constraints)
 * and resets sequences. Called in beforeEach() inside each test file.
 */
global.truncateAll = async () => {
  await db.query(`
    TRUNCATE TABLE
      notifications,
      announcements,
      gym_sessions,
      workout_streaks,
      workout_checkins,
      fitness_records,
      workout_day_exercises,
      workout_days,
      workout_plans,
      payments,
      memberships,
      membership_plans,
      password_reset_tokens,
      users
    RESTART IDENTITY CASCADE
  `);
};

// ─── Teardown: close pool so Jest exits cleanly ───────────────────────────────
afterAll(async () => {
  await db.end();
});