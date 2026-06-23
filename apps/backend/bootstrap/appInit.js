const db = require('../config/db');
const { hashPassword } = require('../utils/Hash');
const logger = require('../utils/Logger');

let initPromise = null;

async function ensureUsersSchema() {
  await db.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS account_status VARCHAR(20) NOT NULL DEFAULT 'active'
  `);

  await db.query(`
    UPDATE users
    SET account_status = 'active'
    WHERE account_status IS NULL
  `);

  await db.query(`
    DO $$
    DECLARE
      constraint_name text;
    BEGIN
      SELECT c.conname
      INTO constraint_name
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      WHERE t.relname = 'users'
        AND c.contype = 'c'
        AND pg_get_constraintdef(c.oid) ILIKE '%role%'
      LIMIT 1;

      IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE users DROP CONSTRAINT %I', constraint_name);
      END IF;

      BEGIN
        ALTER TABLE users
        ADD CONSTRAINT users_role_check
        CHECK (role IN ('member', 'admin'));
      EXCEPTION
        WHEN duplicate_object THEN
          NULL;
      END;
    END $$;
  `);
}

async function ensureDevelopmentAdmin() {
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  const email = process.env.ADMIN_EMAIL || 'admin@gym.com';
  const password = process.env.ADMIN_PASSWORD || 'Admin123';
  const fullName = process.env.ADMIN_FULL_NAME || 'System Admin';
  const phone = process.env.ADMIN_PHONE || null;

  const { rows } = await db.query(
    `SELECT id FROM users WHERE email = $1`,
    [email],
  );

  if (rows[0]) {
    await db.query(
      `UPDATE users
       SET role = 'admin',
           account_status = 'active',
           full_name = COALESCE(full_name, $2),
           updated_at = now()
       WHERE id = $1`,
      [rows[0].id, fullName],
    );
    return;
  }

  const passwordHash = await hashPassword(password);
  const created = await db.query(
    `INSERT INTO users (email, password_hash, full_name, phone, role, account_status)
     VALUES ($1, $2, $3, $4, 'admin', 'active')
     RETURNING id`,
    [email, passwordHash, fullName, phone],
  );

  await db.query(
    `INSERT INTO workout_streaks (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
    [created.rows[0].id],
  );

  logger.info('Development admin account ensured', { email });
}

async function initializeApp() {
  await ensureUsersSchema();
  await ensureDevelopmentAdmin();
}

function ensureAppReady(req, res, next) {
  if (!initPromise) {
    initPromise = initializeApp().catch((error) => {
      initPromise = null;
      throw error;
    });
  }

  initPromise.then(() => next()).catch(next);
}

module.exports = {
  ensureAppReady,
};
