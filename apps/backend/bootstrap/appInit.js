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

async function ensureMembershipsAndPaymentsSchema() {
  await db.query(`
    ALTER TABLE memberships
    ADD COLUMN IF NOT EXISTS activation_code TEXT
  `);

  await db.query(`
    ALTER TABLE memberships
    ADD COLUMN IF NOT EXISTS activation_code_issued_at TIMESTAMPTZ
  `);

  await db.query(`
    ALTER TABLE memberships
    ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ
  `);

  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_memberships_activation_code
    ON memberships (activation_code)
    WHERE activation_code IS NOT NULL
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS payments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      membership_id UUID NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount NUMERIC(12, 2) NOT NULL,
      provider TEXT NOT NULL CHECK (provider IN ('banking', 'cash')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
      provider_tx_id TEXT,
      paid_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function ensureWorkoutsSchema() {
  await db.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

  await db.query(`
    CREATE TABLE IF NOT EXISTS exercises (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name          TEXT NOT NULL,
      muscle_group  TEXT NOT NULL CHECK (muscle_group IN
                      ('chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'cardio', 'full_body')),
      equipment     TEXT,
      difficulty    TEXT NOT NULL DEFAULT 'beginner' CHECK (difficulty IN
                      ('beginner', 'intermediate', 'advanced')),
      description   TEXT,
      goal_tags     TEXT[] NOT NULL DEFAULT '{}',
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_exercises_name_lower
    ON exercises (LOWER(name))
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS workout_plans (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title          TEXT NOT NULL,
      goal           TEXT,
      fitness_level  TEXT NOT NULL DEFAULT 'beginner' CHECK (fitness_level IN
                       ('beginner', 'intermediate', 'advanced')),
      is_active      BOOLEAN NOT NULL DEFAULT false,
      is_customized  BOOLEAN NOT NULL DEFAULT false,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS workout_days (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workout_plan_id  UUID NOT NULL REFERENCES workout_plans(id) ON DELETE CASCADE,
      day_of_week      INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
      day_label        TEXT NOT NULL,
      is_rest_day      BOOLEAN NOT NULL DEFAULT false,
      UNIQUE (workout_plan_id, day_of_week)
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS workout_day_exercises (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workout_day_id  UUID NOT NULL REFERENCES workout_days(id) ON DELETE CASCADE,
      exercise_id     UUID NOT NULL REFERENCES exercises(id) ON DELETE RESTRICT,
      sets            INTEGER NOT NULL,
      reps            INTEGER NOT NULL,
      rest_seconds    INTEGER NOT NULL DEFAULT 60,
      scheduled_period TEXT CHECK (scheduled_period IN ('morning', 'afternoon')),
      scheduled_time   TIME,
      order_index     INTEGER NOT NULL DEFAULT 0,
      notes           TEXT
    )
  `);

  await db.query(`
    ALTER TABLE workout_day_exercises
    ADD COLUMN IF NOT EXISTS scheduled_period TEXT CHECK (scheduled_period IN ('morning', 'afternoon'))
  `);

  await db.query(`
    ALTER TABLE workout_day_exercises
    ADD COLUMN IF NOT EXISTS scheduled_time TIME
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_wde_day_order
    ON workout_day_exercises (workout_day_id, order_index)
  `);
}

async function seedExerciseCatalog() {
  const { rows } = await db.query(`SELECT COUNT(*)::INT AS count FROM exercises`);
  if (rows[0].count > 0) {
    return;
  }

  const exercises = [
    ['Push Up', 'chest', 'bodyweight', 'beginner', 'Builds chest, shoulders, and triceps with no equipment.', ['strength', 'muscle_gain']],
    ['Dumbbell Bench Press', 'chest', 'dumbbells', 'intermediate', 'Pressing movement for chest strength and control.', ['strength', 'muscle_gain']],
    ['Incline Barbell Press', 'chest', 'barbell', 'advanced', 'Upper-chest compound lift for heavier training days.', ['strength', 'muscle_gain']],
    ['Lat Pulldown', 'back', 'cable machine', 'beginner', 'Develops lats and upper-back pulling strength.', ['strength', 'posture']],
    ['Seated Cable Row', 'back', 'cable machine', 'intermediate', 'Horizontal pull for mid-back thickness and posture.', ['strength', 'posture']],
    ['Pull Up', 'back', 'pull-up bar', 'advanced', 'Bodyweight pull for back and arm strength.', ['strength', 'muscle_gain']],
    ['Bodyweight Squat', 'legs', 'bodyweight', 'beginner', 'Teaches squat pattern and lower-body control.', ['strength', 'weight_loss']],
    ['Goblet Squat', 'legs', 'dumbbell', 'intermediate', 'Loaded squat variation for quads and glutes.', ['strength', 'muscle_gain']],
    ['Barbell Back Squat', 'legs', 'barbell', 'advanced', 'Heavy compound lift for complete leg strength.', ['strength', 'muscle_gain']],
    ['Dumbbell Shoulder Press', 'shoulders', 'dumbbells', 'beginner', 'Overhead press for shoulder strength.', ['strength', 'muscle_gain']],
    ['Lateral Raise', 'shoulders', 'dumbbells', 'intermediate', 'Isolation movement for side delts.', ['muscle_gain', 'toning']],
    ['Arnold Press', 'shoulders', 'dumbbells', 'advanced', 'Rotational shoulder press for advanced control.', ['strength', 'muscle_gain']],
    ['Biceps Curl', 'arms', 'dumbbells', 'beginner', 'Simple curl for biceps strength.', ['muscle_gain', 'toning']],
    ['Triceps Rope Pushdown', 'arms', 'cable machine', 'intermediate', 'Cable isolation for triceps volume.', ['muscle_gain', 'toning']],
    ['Close-Grip Bench Press', 'arms', 'barbell', 'advanced', 'Compound triceps-focused press.', ['strength', 'muscle_gain']],
    ['Plank', 'core', 'bodyweight', 'beginner', 'Core stability hold for trunk control.', ['core', 'stability']],
    ['Cable Woodchop', 'core', 'cable machine', 'intermediate', 'Rotational core exercise for control.', ['core', 'stability']],
    ['Hanging Leg Raise', 'core', 'pull-up bar', 'advanced', 'Advanced core flexion exercise.', ['core', 'strength']],
    ['Treadmill Walk', 'cardio', 'treadmill', 'beginner', 'Low-impact cardio for endurance and calorie burn.', ['weight_loss', 'endurance']],
    ['Rowing Machine Intervals', 'cardio', 'rowing machine', 'intermediate', 'Full-body cardio intervals.', ['weight_loss', 'endurance']],
    ['Assault Bike Sprint', 'cardio', 'assault bike', 'advanced', 'High-intensity conditioning sprint.', ['weight_loss', 'endurance']],
    ['Step Up', 'full_body', 'box', 'beginner', 'Simple full-body movement focused on legs and balance.', ['weight_loss', 'stability']],
    ['Kettlebell Swing', 'full_body', 'kettlebell', 'intermediate', 'Power movement for hips, core, and conditioning.', ['power', 'weight_loss']],
    ['Burpee', 'full_body', 'bodyweight', 'advanced', 'High-effort full-body conditioning exercise.', ['weight_loss', 'endurance']],
  ];

  for (const exercise of exercises) {
    await db.query(
      `INSERT INTO exercises (name, muscle_group, equipment, difficulty, description, goal_tags)
      SELECT $1::text, $2::muscle_group, $3::text, $4::difficulty_level, $5::text, $6::text[]
      WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE LOWER(name) = LOWER($1::text))`,
      exercise
    );
  }

  logger.info('Exercise catalog seeded', { count: exercises.length });
}

async function initializeApp() {
  await ensureUsersSchema();
  await ensureMembershipsAndPaymentsSchema();
  await ensureWorkoutsSchema();
  await seedExerciseCatalog();
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
