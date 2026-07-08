/**
 * admin.repository.js
 * Read-only PostgreSQL queries for GymHub admin analytics.
 */

const db = require('../../config/db');

const periodExpression = (column, groupBy = 'day') =>
  groupBy === 'month'
    ? `date_trunc('month', ${column})::date`
    : `date_trunc('day', ${column})::date`;

const whereClause = (conditions) =>
  conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

const addDateRange = (conditions, values, column, filters = {}) => {
  if (filters.from_date) {
    values.push(filters.from_date);
    conditions.push(`${column} >= $${values.length}::date`);
  }

  if (filters.to_date) {
    values.push(filters.to_date);
    conditions.push(`${column} < ($${values.length}::date + interval '1 day')`);
  }
};

const findDashboardOverview = async (expiringDays = 7) => {
  const { rows } = await db.query(
    `SELECT
       (SELECT COUNT(*)::INT FROM users) AS total_users,
       (SELECT COUNT(*)::INT FROM users WHERE role = 'member') AS total_members,
       (SELECT COUNT(*)::INT FROM users WHERE role = 'admin') AS total_admins,
       (SELECT COUNT(*)::INT FROM memberships) AS total_memberships,
       (SELECT COUNT(*)::INT FROM memberships
        WHERE status = 'active' AND end_date >= CURRENT_DATE) AS active_memberships,
       (SELECT COUNT(*)::INT FROM memberships
        WHERE status = 'active'
          AND end_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + $1::INT)) AS memberships_expiring_soon,
       (SELECT COUNT(*)::INT FROM gym_branches WHERE is_active = true) AS active_branches,
       (SELECT COUNT(*)::INT FROM gym_sessions WHERE checked_out_at IS NULL) AS active_gym_sessions,
       (SELECT COUNT(*)::INT FROM workout_plans WHERE is_active = true) AS active_workout_plans,
       (SELECT COUNT(*)::INT FROM workout_checkins WHERE checkin_date = CURRENT_DATE) AS today_checkins,
       (SELECT COUNT(*)::INT FROM payments WHERE status = 'pending') AS pending_payments,
       (SELECT COALESCE(SUM(amount), 0)::NUMERIC
        FROM payments
        WHERE status = 'completed') AS lifetime_revenue,
       (SELECT COALESCE(SUM(amount), 0)::NUMERIC
        FROM payments
        WHERE status = 'completed'
          AND paid_at >= date_trunc('month', now())) AS month_revenue,
       (SELECT COALESCE(SUM(amount), 0)::NUMERIC
        FROM payments
        WHERE status = 'completed'
          AND paid_at >= CURRENT_DATE) AS today_revenue`,
    [expiringDays]
  );

  return rows[0];
};

const findRecentRevenueRows = async (limit = 7) => {
  const { rows } = await db.query(
    `SELECT report_date::date AS period,
            transaction_count::INT AS transaction_count,
            total_revenue::NUMERIC AS total_revenue
     FROM revenue_report
     ORDER BY report_date DESC
     LIMIT $1`,
    [limit]
  );
  return rows;
};

const findRevenueReport = async (filters = {}) => {
  const values = [];
  const conditions = [];
  addDateRange(conditions, values, 'report_date', filters);

  values.push(filters.limit || 30);
  const limitIndex = values.length;
  const period = periodExpression('report_date', filters.group_by);

  const { rows } = await db.query(
    `SELECT ${period} AS period,
            SUM(transaction_count)::INT AS transaction_count,
            COALESCE(SUM(total_revenue), 0)::NUMERIC AS total_revenue
     FROM revenue_report
     ${whereClause(conditions)}
     GROUP BY period
     ORDER BY period DESC
     LIMIT $${limitIndex}`,
    values
  );
  return rows;
};

const findRevenueTotals = async (filters = {}) => {
  const values = [];
  const conditions = ["status = 'completed'", 'paid_at IS NOT NULL'];
  addDateRange(conditions, values, 'paid_at', filters);

  const { rows } = await db.query(
    `SELECT COUNT(*)::INT AS transaction_count,
            COALESCE(SUM(amount), 0)::NUMERIC AS total_revenue,
            COALESCE(AVG(amount), 0)::NUMERIC AS average_transaction_amount,
            COALESCE(MAX(amount), 0)::NUMERIC AS largest_transaction_amount
     FROM payments
     ${whereClause(conditions)}`,
    values
  );
  return rows[0];
};

const findMembershipOverview = async () => {
  const { rows } = await db.query(
    `SELECT status, member_count::INT AS member_count
     FROM membership_overview
     ORDER BY status ASC`
  );
  return rows;
};

const findMembershipPlanBreakdown = async () => {
  const { rows } = await db.query(
    `SELECT mp.id AS plan_id,
            mp.name AS plan_name,
            mp.price,
            mp.duration_days,
            COUNT(m.id)::INT AS total_memberships,
            COUNT(m.id) FILTER (
              WHERE m.status = 'active' AND m.end_date >= CURRENT_DATE
            )::INT AS active_memberships
     FROM membership_plans mp
     LEFT JOIN memberships m ON m.plan_id = mp.id
     GROUP BY mp.id, mp.name, mp.price, mp.duration_days
     ORDER BY total_memberships DESC, mp.name ASC`
  );
  return rows;
};

const findMembershipTrend = async (filters = {}) => {
  const values = [];
  const conditions = [];
  addDateRange(conditions, values, 'created_at', filters);
  const period = periodExpression('created_at', filters.group_by);

  const { rows } = await db.query(
    `SELECT ${period} AS period,
            COUNT(*)::INT AS new_memberships
     FROM memberships
     ${whereClause(conditions)}
     GROUP BY period
     ORDER BY period DESC`,
    values
  );
  return rows;
};

const findExpiringMemberships = async (expiringDays = 7) => {
  const { rows } = await db.query(
    `SELECT m.id AS membership_id,
            m.user_id,
            u.full_name AS user_name,
            u.email AS user_email,
            mp.name AS plan_name,
            m.end_date,
            (m.end_date - CURRENT_DATE)::INT AS days_remaining
     FROM memberships m
     JOIN users u ON u.id = m.user_id
     JOIN membership_plans mp ON mp.id = m.plan_id
     WHERE m.status = 'active'
       AND m.end_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + $1::INT)
     ORDER BY m.end_date ASC`,
    [expiringDays]
  );
  return rows;
};

const findCurrentOccupancyRows = async () => {
  const { rows } = await db.query(
    `SELECT branch_id,
            branch_name,
            active_members_in_gym::INT AS active_members_in_gym,
            capacity::INT AS capacity
     FROM current_occupancy
     ORDER BY branch_name ASC`
  );
  return rows;
};

const findOccupancyTrend = async (filters = {}) => {
  const values = [];
  const conditions = [];
  addDateRange(conditions, values, 'gs.checked_in_at', filters);

  if (filters.branch_id) {
    values.push(filters.branch_id);
    conditions.push(`gs.branch_id = $${values.length}`);
  }

  const period = periodExpression('gs.checked_in_at', filters.group_by);

  const { rows } = await db.query(
    `SELECT ${period} AS period,
            COUNT(gs.id)::INT AS total_sessions,
            COUNT(DISTINCT gs.user_id)::INT AS unique_members,
            COALESCE(AVG(gs.duration_minutes), 0)::NUMERIC AS average_duration_minutes
     FROM gym_sessions gs
     ${whereClause(conditions)}
     GROUP BY period
     ORDER BY period DESC`,
    values
  );
  return rows;
};

const findOccupancyByBranch = async (filters = {}) => {
  const values = [];
  const joinConditions = ['gs.branch_id = b.id'];
  addDateRange(joinConditions, values, 'gs.checked_in_at', filters);

  const conditions = ['b.is_active = true'];
  if (filters.branch_id) {
    values.push(filters.branch_id);
    conditions.push(`b.id = $${values.length}`);
  }

  const { rows } = await db.query(
    `SELECT b.id AS branch_id,
            b.name AS branch_name,
            b.capacity::INT AS capacity,
            COUNT(gs.id)::INT AS total_sessions,
            COUNT(DISTINCT gs.user_id)::INT AS unique_members,
            COUNT(gs.id) FILTER (WHERE gs.checked_out_at IS NULL)::INT AS open_sessions,
            COALESCE(AVG(gs.duration_minutes), 0)::NUMERIC AS average_duration_minutes
     FROM gym_branches b
     LEFT JOIN gym_sessions gs ON ${joinConditions.join(' AND ')}
     ${whereClause(conditions)}
     GROUP BY b.id, b.name, b.capacity
     ORDER BY b.name ASC`,
    values
  );
  return rows;
};

const findUserOverview = async () => {
  const { rows } = await db.query(
    `SELECT COUNT(*)::INT AS total_users,
            COUNT(*) FILTER (WHERE role = 'member')::INT AS members,
            COUNT(*) FILTER (WHERE role = 'admin')::INT AS admins,
            COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)::INT AS new_today,
            COUNT(*) FILTER (
              WHERE created_at >= date_trunc('month', now())
            )::INT AS new_this_month
     FROM users`
  );
  return rows[0];
};

const findUserRoleBreakdown = async () => {
  const { rows } = await db.query(
    `SELECT role, COUNT(*)::INT AS user_count
     FROM users
     GROUP BY role
     ORDER BY role ASC`
  );
  return rows;
};

const findUserTrend = async (filters = {}) => {
  const values = [];
  const conditions = [];
  addDateRange(conditions, values, 'created_at', filters);
  const period = periodExpression('created_at', filters.group_by);

  const { rows } = await db.query(
    `SELECT ${period} AS period,
            COUNT(*)::INT AS new_users
     FROM users
     ${whereClause(conditions)}
     GROUP BY period
     ORDER BY period DESC`,
    values
  );
  return rows;
};

const findWorkoutOverview = async () => {
  const { rows } = await db.query(
    `SELECT
       (SELECT COUNT(*)::INT FROM workout_plans) AS total_plans,
       (SELECT COUNT(*)::INT FROM workout_plans WHERE is_active = true) AS active_plans,
       (SELECT COUNT(*)::INT FROM workout_plans WHERE is_customized = true) AS customized_plans,
       (SELECT COUNT(*)::INT FROM exercises) AS total_exercises,
       (SELECT COUNT(*)::INT FROM workout_checkins) AS total_checkins,
       (SELECT COUNT(DISTINCT user_id)::INT FROM workout_checkins) AS members_with_checkins`
  );
  return rows[0];
};

const findWorkoutPlanGoalBreakdown = async (limit = 10) => {
  const { rows } = await db.query(
    `SELECT COALESCE(NULLIF(TRIM(goal), ''), 'unspecified') AS goal,
            COUNT(*)::INT AS plan_count
     FROM workout_plans
     GROUP BY goal
     ORDER BY plan_count DESC, goal ASC
     LIMIT $1`,
    [limit]
  );
  return rows;
};

const findExerciseBreakdown = async () => {
  const { rows } = await db.query(
    `SELECT muscle_group,
            difficulty,
            COUNT(*)::INT AS exercise_count
     FROM exercises
     GROUP BY muscle_group, difficulty
     ORDER BY muscle_group ASC, difficulty ASC`
  );
  return rows;
};

const findWorkoutCheckinTrend = async (filters = {}) => {
  const values = [];
  const conditions = [];
  addDateRange(conditions, values, 'checked_in_at', filters);
  const period = periodExpression('checked_in_at', filters.group_by);

  const { rows } = await db.query(
    `SELECT ${period} AS period,
            COUNT(*)::INT AS checkin_count,
            COUNT(DISTINCT user_id)::INT AS unique_members
     FROM workout_checkins
     ${whereClause(conditions)}
     GROUP BY period
     ORDER BY period DESC`,
    values
  );
  return rows;
};

const findStreakOverview = async () => {
  const { rows } = await db.query(
    `SELECT COUNT(*)::INT AS total_streak_records,
            COUNT(*) FILTER (WHERE current_streak > 0)::INT AS active_streaks,
            COUNT(*) FILTER (WHERE last_active_date = CURRENT_DATE)::INT AS active_today,
            COUNT(*) FILTER (WHERE last_active_date = (CURRENT_DATE - interval '1 day')::date)::INT AS at_risk,
            COUNT(*) FILTER (
              WHERE last_active_date IS NOT NULL
                AND last_active_date < (CURRENT_DATE - interval '1 day')::date
            )::INT AS broken,
            COALESCE(AVG(current_streak), 0)::NUMERIC AS average_current_streak,
            COALESCE(MAX(current_streak), 0)::INT AS max_current_streak,
            COALESCE(MAX(longest_streak), 0)::INT AS max_longest_streak
     FROM workout_streaks`
  );
  return rows[0];
};

const findStreakStatusBreakdown = async () => {
  const { rows } = await db.query(
    `SELECT status, COUNT(*)::INT AS streak_count
     FROM (
       SELECT CASE
         WHEN last_active_date IS NULL THEN 'not_started'
         WHEN last_active_date = CURRENT_DATE THEN 'active'
         WHEN last_active_date = (CURRENT_DATE - interval '1 day')::date THEN 'at_risk'
         ELSE 'broken'
       END AS status
       FROM workout_streaks
     ) grouped
     GROUP BY status
     ORDER BY status ASC`
  );
  return rows;
};

const findTopStreaks = async (limit = 10) => {
  const { rows } = await db.query(
    `SELECT ws.user_id,
            u.full_name,
            u.email,
            ws.current_streak::INT AS current_streak,
            ws.longest_streak::INT AS longest_streak,
            ws.last_active_date::TEXT AS last_active_date
     FROM workout_streaks ws
     JOIN users u ON u.id = ws.user_id
     ORDER BY ws.current_streak DESC,
              ws.longest_streak DESC,
              ws.last_active_date DESC NULLS LAST
     LIMIT $1`,
    [limit]
  );
  return rows;
};

const findStreakCheckinTrend = async (filters = {}) => {
  const values = [];
  const conditions = ['counted_for_streak = true'];
  addDateRange(conditions, values, 'checked_in_at', filters);
  const period = periodExpression('checked_in_at', filters.group_by);

  const { rows } = await db.query(
    `SELECT ${period} AS period,
            COUNT(*)::INT AS checkin_count,
            COUNT(DISTINCT user_id)::INT AS unique_members,
            COUNT(DISTINCT checkin_date)::INT AS distinct_checkin_dates
     FROM workout_checkins
     ${whereClause(conditions)}
     GROUP BY period
     ORDER BY period DESC`,
    values
  );
  return rows;
};

const findPaymentOverview = async (filters = {}) => {
  const values = [];
  const conditions = [];
  addDateRange(conditions, values, 'created_at', filters);

  const { rows } = await db.query(
    `SELECT COUNT(*)::INT AS total_payments,
            COUNT(*) FILTER (WHERE status = 'pending')::INT AS pending_payments,
            COUNT(*) FILTER (WHERE status = 'completed')::INT AS completed_payments,
            COUNT(*) FILTER (WHERE status = 'failed')::INT AS failed_payments,
            COUNT(*) FILTER (WHERE status = 'refunded')::INT AS refunded_payments,
            COALESCE(SUM(amount) FILTER (WHERE status = 'completed'), 0)::NUMERIC AS completed_amount,
            COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0)::NUMERIC AS pending_amount,
            COALESCE(SUM(amount) FILTER (WHERE status = 'refunded'), 0)::NUMERIC AS refunded_amount
     FROM payments
     ${whereClause(conditions)}`,
    values
  );
  return rows[0];
};

const findPaymentStatusBreakdown = async (filters = {}) => {
  const values = [];
  const conditions = [];
  addDateRange(conditions, values, 'created_at', filters);

  const { rows } = await db.query(
    `SELECT status,
            COUNT(*)::INT AS payment_count,
            COALESCE(SUM(amount), 0)::NUMERIC AS amount
     FROM payments
     ${whereClause(conditions)}
     GROUP BY status
     ORDER BY status ASC`,
    values
  );
  return rows;
};

const findPaymentProviderBreakdown = async (filters = {}) => {
  const values = [];
  const conditions = [];
  addDateRange(conditions, values, 'created_at', filters);

  const { rows } = await db.query(
    `SELECT COALESCE(provider, 'unknown') AS provider,
            COUNT(*)::INT AS payment_count,
            COALESCE(SUM(amount), 0)::NUMERIC AS amount
     FROM payments
     ${whereClause(conditions)}
     GROUP BY provider
     ORDER BY payment_count DESC, provider ASC`,
    values
  );
  return rows;
};

const findPaymentRevenueTrend = async (filters = {}) => {
  const values = [];
  const conditions = ["status = 'completed'", 'paid_at IS NOT NULL'];
  addDateRange(conditions, values, 'paid_at', filters);
  const period = periodExpression('paid_at', filters.group_by);

  const { rows } = await db.query(
    `SELECT ${period} AS period,
            COUNT(*)::INT AS transaction_count,
            COALESCE(SUM(amount), 0)::NUMERIC AS total_revenue
     FROM payments
     ${whereClause(conditions)}
     GROUP BY period
     ORDER BY period DESC`,
    values
  );
  return rows;
};

module.exports = {
  findDashboardOverview,
  findRecentRevenueRows,
  findRevenueReport,
  findRevenueTotals,
  findMembershipOverview,
  findMembershipPlanBreakdown,
  findMembershipTrend,
  findExpiringMemberships,
  findCurrentOccupancyRows,
  findOccupancyTrend,
  findOccupancyByBranch,
  findUserOverview,
  findUserRoleBreakdown,
  findUserTrend,
  findWorkoutOverview,
  findWorkoutPlanGoalBreakdown,
  findExerciseBreakdown,
  findWorkoutCheckinTrend,
  findStreakOverview,
  findStreakStatusBreakdown,
  findTopStreaks,
  findStreakCheckinTrend,
  findPaymentOverview,
  findPaymentStatusBreakdown,
  findPaymentProviderBreakdown,
  findPaymentRevenueTrend,
};
