/**
 * admin.service.js
 * Aggregates admin dashboard, reports, and statistics responses.
 */

const repo = require('./admin.repository');
// const { calculateOccupancyRate } = require('../occupancy/occupancyCalculator');

const toNumber = (value) => Number(value || 0);

const mapNumberFields = (row = {}, fields = []) => {
  const normalized = { ...row };
  fields.forEach((field) => {
    normalized[field] = toNumber(row[field]);
  });
  return normalized;
};

const mapRows = (rows = [], fields = []) =>
  rows.map((row) => mapNumberFields(row, fields));

const normalizeRevenueRows = (rows = []) =>
  mapRows(rows, ['transaction_count', 'total_revenue']);

const normalizeMembershipOverview = (rows = []) =>
  mapRows(rows, ['member_count']);

const normalizeMembershipPlans = (rows = []) =>
  mapRows(rows, ['price', 'duration_days', 'total_memberships', 'active_memberships']);

const normalizeCurrentOccupancy = (rows = []) =>
  rows.map((row) => {
    const active = toNumber(row.active_members_in_gym);
    const capacity = toNumber(row.capacity);
    return {
      ...row,
      active_members_in_gym: active,
      capacity,
      available_slots: Math.max(0, capacity - active),
      occupancy_rate: calculateOccupancyRate(active, capacity || 1),
    };
  });

const normalizeOccupancyTrend = (rows = []) =>
  mapRows(rows, ['total_sessions', 'unique_members', 'average_duration_minutes']);

const normalizeOccupancyBranches = (rows = []) =>
  rows.map((row) => {
    const capacity = toNumber(row.capacity);
    const openSessions = toNumber(row.open_sessions);
    return {
      ...mapNumberFields(row, [
        'capacity',
        'total_sessions',
        'unique_members',
        'open_sessions',
        'average_duration_minutes',
      ]),
      occupancy_rate: calculateOccupancyRate(openSessions, capacity || 1),
    };
  });

const normalizeDashboardOverview = (overview = {}) =>
  mapNumberFields(overview, [
    'total_users',
    'total_members',
    'total_admins',
    'total_memberships',
    'active_memberships',
    'memberships_expiring_soon',
    'active_branches',
    'active_gym_sessions',
    'active_workout_plans',
    'today_checkins',
    'pending_payments',
    'lifetime_revenue',
    'month_revenue',
    'today_revenue',
  ]);

const getDashboard = async (query = {}) => {
  const [overview, recentRevenue, membershipOverview, currentOccupancy] =
    await Promise.all([
      repo.findDashboardOverview(query.expiring_days),
      repo.findRecentRevenueRows(query.recent_limit),
      repo.findMembershipOverview(),
      repo.findCurrentOccupancyRows(),
    ]);

  return {
    overview: normalizeDashboardOverview(overview),
    recent_revenue: normalizeRevenueRows(recentRevenue),
    membership_overview: normalizeMembershipOverview(membershipOverview),
    current_occupancy: normalizeCurrentOccupancy(currentOccupancy),
  };
};

const getRevenueReport = async (query = {}) => {
  const [totals, rows] = await Promise.all([
    repo.findRevenueTotals(query),
    repo.findRevenueReport(query),
  ]);

  return {
    filters: {
      from_date: query.from_date || null,
      to_date: query.to_date || null,
      group_by: query.group_by,
    },
    totals: mapNumberFields(totals, [
      'transaction_count',
      'total_revenue',
      'average_transaction_amount',
      'largest_transaction_amount',
    ]),
    rows: normalizeRevenueRows(rows),
  };
};

const getMembershipsReport = async (query = {}) => {
  const [overview, planBreakdown, trend, expiringSoon] = await Promise.all([
    repo.findMembershipOverview(),
    repo.findMembershipPlanBreakdown(),
    repo.findMembershipTrend(query),
    repo.findExpiringMemberships(query.expiring_days),
  ]);

  return {
    filters: {
      from_date: query.from_date || null,
      to_date: query.to_date || null,
      group_by: query.group_by,
      expiring_days: query.expiring_days,
    },
    overview: normalizeMembershipOverview(overview),
    plan_breakdown: normalizeMembershipPlans(planBreakdown),
    trend: mapRows(trend, ['new_memberships']),
    expiring_soon: mapRows(expiringSoon, ['days_remaining']),
  };
};

const getOccupancyReport = async (query = {}) => {
  const [current, byBranch, trend] = await Promise.all([
    repo.findCurrentOccupancyRows(),
    repo.findOccupancyByBranch(query),
    repo.findOccupancyTrend(query),
  ]);

  const currentOccupancy = normalizeCurrentOccupancy(current);
  const branchRows = normalizeOccupancyBranches(byBranch);

  return {
    filters: {
      from_date: query.from_date || null,
      to_date: query.to_date || null,
      group_by: query.group_by,
      branch_id: query.branch_id || null,
    },
    current: currentOccupancy,
    summary: {
      total_active_members: currentOccupancy.reduce(
        (sum, row) => sum + row.active_members_in_gym,
        0
      ),
      total_capacity: currentOccupancy.reduce((sum, row) => sum + row.capacity, 0),
      branches_count: currentOccupancy.length,
    },
    by_branch: branchRows,
    trend: normalizeOccupancyTrend(trend),
  };
};

const getUserStatistics = async (query = {}) => {
  const [overview, roleBreakdown, trend] = await Promise.all([
    repo.findUserOverview(),
    repo.findUserRoleBreakdown(),
    repo.findUserTrend(query),
  ]);

  return {
    filters: {
      from_date: query.from_date || null,
      to_date: query.to_date || null,
      group_by: query.group_by,
    },
    overview: mapNumberFields(overview, [
      'total_users',
      'members',
      'admins',
      'new_today',
      'new_this_month',
    ]),
    role_breakdown: mapRows(roleBreakdown, ['user_count']),
    trend: mapRows(trend, ['new_users']),
  };
};

const getWorkoutStatistics = async (query = {}) => {
  const [overview, goalBreakdown, exerciseBreakdown, checkinTrend] =
    await Promise.all([
      repo.findWorkoutOverview(),
      repo.findWorkoutPlanGoalBreakdown(query.limit),
      repo.findExerciseBreakdown(),
      repo.findWorkoutCheckinTrend(query),
    ]);

  return {
    filters: {
      from_date: query.from_date || null,
      to_date: query.to_date || null,
      group_by: query.group_by,
      limit: query.limit,
    },
    overview: mapNumberFields(overview, [
      'total_plans',
      'active_plans',
      'customized_plans',
      'total_exercises',
      'total_checkins',
      'members_with_checkins',
    ]),
    plan_goal_breakdown: mapRows(goalBreakdown, ['plan_count']),
    exercise_breakdown: mapRows(exerciseBreakdown, ['exercise_count']),
    checkin_trend: mapRows(checkinTrend, ['checkin_count', 'unique_members']),
  };
};

const getStreakStatistics = async (query = {}) => {
  const [overview, statusBreakdown, topStreaks, checkinTrend] =
    await Promise.all([
      repo.findStreakOverview(),
      repo.findStreakStatusBreakdown(),
      repo.findTopStreaks(query.limit),
      repo.findStreakCheckinTrend(query),
    ]);

  return {
    filters: {
      from_date: query.from_date || null,
      to_date: query.to_date || null,
      group_by: query.group_by,
      limit: query.limit,
    },
    overview: mapNumberFields(overview, [
      'total_streak_records',
      'active_streaks',
      'active_today',
      'at_risk',
      'broken',
      'average_current_streak',
      'max_current_streak',
      'max_longest_streak',
    ]),
    status_breakdown: mapRows(statusBreakdown, ['streak_count']),
    top_streaks: mapRows(topStreaks, ['current_streak', 'longest_streak']),
    checkin_trend: mapRows(checkinTrend, [
      'checkin_count',
      'unique_members',
      'distinct_checkin_dates',
    ]),
  };
};

const getPaymentStatistics = async (query = {}) => {
  const [overview, statusBreakdown, providerBreakdown, revenueTrend] =
    await Promise.all([
      repo.findPaymentOverview(query),
      repo.findPaymentStatusBreakdown(query),
      repo.findPaymentProviderBreakdown(query),
      repo.findPaymentRevenueTrend(query),
    ]);

  return {
    filters: {
      from_date: query.from_date || null,
      to_date: query.to_date || null,
      group_by: query.group_by,
    },
    overview: mapNumberFields(overview, [
      'total_payments',
      'pending_payments',
      'completed_payments',
      'failed_payments',
      'refunded_payments',
      'completed_amount',
      'pending_amount',
      'refunded_amount',
    ]),
    status_breakdown: mapRows(statusBreakdown, ['payment_count', 'amount']),
    provider_breakdown: mapRows(providerBreakdown, ['payment_count', 'amount']),
    revenue_trend: normalizeRevenueRows(revenueTrend),
  };
};

module.exports = {
  getDashboard,
  getRevenueReport,
  getMembershipsReport,
  getOccupancyReport,
  getUserStatistics,
  getWorkoutStatistics,
  getStreakStatistics,
  getPaymentStatistics,

  // Exported for focused unit tests.
  mapNumberFields,
  normalizeCurrentOccupancy,
};
