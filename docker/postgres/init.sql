CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  account_status TEXT NOT NULL DEFAULT 'active' CHECK (account_status IN ('active', 'locked')),
  qr_code_token UUID NOT NULL DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workout_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_active_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS membership_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  duration_days INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES membership_plans(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'suspended', 'cancelled')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  activation_code TEXT UNIQUE,
  activation_code_issued_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
);

CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  title VARCHAR(160) NOT NULL,
  body TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  announcement_id UUID REFERENCES announcements(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'announcement' CHECK (type IN ('announcement', 'system', 'membership', 'schedule')),
  title VARCHAR(160) NOT NULL,
  body TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_sent_at
  ON notifications (user_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_announcement_id
  ON notifications (announcement_id);

INSERT INTO membership_plans (name, description, price, duration_days, is_active)
SELECT '1 Month', 'Standard monthly membership', 300000, 30, true
WHERE NOT EXISTS (
  SELECT 1 FROM membership_plans WHERE name = '1 Month'
);

INSERT INTO membership_plans (name, description, price, duration_days, is_active)
SELECT '3 Months', 'Quarterly membership', 800000, 90, true
WHERE NOT EXISTS (
  SELECT 1 FROM membership_plans WHERE name = '3 Months'
);

INSERT INTO membership_plans (name, description, price, duration_days, is_active)
SELECT '12 Months', 'Annual membership', 2800000, 365, true
WHERE NOT EXISTS (
  SELECT 1 FROM membership_plans WHERE name = '12 Months'
);

CREATE TABLE IF NOT EXISTS gym_branches (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  address       TEXT,
  city          TEXT,
  phone         TEXT,
  opening_time  TIME,
  closing_time  TIME,
  capacity      INTEGER NOT NULL DEFAULT 100,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO gym_branches (name, capacity, is_active)
SELECT 'Main Branch', 100, true
WHERE NOT EXISTS (SELECT 1 FROM gym_branches);

CREATE TABLE IF NOT EXISTS gym_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  branch_id        UUID NOT NULL REFERENCES gym_branches(id) ON DELETE RESTRICT,
  checked_in_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  checked_out_at   TIMESTAMPTZ,
  duration_minutes NUMERIC GENERATED ALWAYS AS (
    CASE WHEN checked_out_at IS NULL THEN NULL
         ELSE EXTRACT(EPOCH FROM (checked_out_at - checked_in_at)) / 60.0
    END
  ) STORED
);

CREATE INDEX IF NOT EXISTS idx_gym_sessions_user_open
  ON gym_sessions (user_id) WHERE checked_out_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_gym_sessions_branch_open
  ON gym_sessions (branch_id) WHERE checked_out_at IS NULL;

CREATE TABLE IF NOT EXISTS workout_checkins (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  branch_id          UUID NOT NULL REFERENCES gym_branches(id) ON DELETE RESTRICT,
  checkin_date       DATE NOT NULL,
  checked_in_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  counted_for_streak BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (user_id, checkin_date)
);

CREATE INDEX IF NOT EXISTS idx_workout_checkins_user_date
  ON workout_checkins (user_id, checkin_date DESC);

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
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_exercises_name_lower ON exercises (LOWER(name));

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
);

CREATE TABLE IF NOT EXISTS workout_days (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_plan_id  UUID NOT NULL REFERENCES workout_plans(id) ON DELETE CASCADE,
  day_of_week      INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  day_label        TEXT NOT NULL,
  is_rest_day      BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (workout_plan_id, day_of_week)
);

CREATE TABLE IF NOT EXISTS workout_day_exercises (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_day_id  UUID NOT NULL REFERENCES workout_days(id) ON DELETE CASCADE,
  exercise_id     UUID NOT NULL REFERENCES exercises(id) ON DELETE RESTRICT,
  sets            INTEGER NOT NULL,
  reps            INTEGER NOT NULL,
  rest_seconds    INTEGER NOT NULL DEFAULT 60,
  order_index     INTEGER NOT NULL DEFAULT 0,
  notes           TEXT
);

CREATE INDEX IF NOT EXISTS idx_wde_day_order
  ON workout_day_exercises (workout_day_id, order_index);

CREATE TABLE IF NOT EXISTS fitness_records (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recorded_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  weight_kg      NUMERIC(6, 2) NOT NULL,
  height_cm      NUMERIC(6, 2) NOT NULL,
  bmi            NUMERIC(6, 2) GENERATED ALWAYS AS (
                   ROUND((weight_kg / ((height_cm / 100.0) ^ 2))::numeric, 2)
                 ) STORED,
  body_fat_pct   NUMERIC(5, 2),
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fitness_records_user_date
  ON fitness_records (user_id, recorded_date DESC);

CREATE OR REPLACE VIEW current_occupancy AS
SELECT
  b.id                                                    AS branch_id,
  b.name                                                   AS branch_name,
  COUNT(gs.id) FILTER (WHERE gs.checked_out_at IS NULL)    AS active_members_in_gym,
  b.capacity                                               AS capacity
FROM gym_branches b
LEFT JOIN gym_sessions gs ON gs.branch_id = b.id
WHERE b.is_active = true
GROUP BY b.id, b.name, b.capacity;

CREATE OR REPLACE VIEW revenue_report AS
SELECT
  paid_at::date              AS report_date,
  COUNT(*)                   AS transaction_count,
  COALESCE(SUM(amount), 0)   AS total_revenue
FROM payments
WHERE status = 'completed' AND paid_at IS NOT NULL
GROUP BY paid_at::date;

CREATE OR REPLACE VIEW membership_overview AS
SELECT status, COUNT(*) AS member_count
FROM memberships
GROUP BY status;
