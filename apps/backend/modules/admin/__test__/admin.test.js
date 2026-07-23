/**
 * admin.test.js
 * Unit tests for the admin analytics module.
 */

jest.mock('../admin.repository', () => ({
  findDashboardOverview: jest.fn(),
  findRecentRevenueRows: jest.fn(),
  findRevenueReport: jest.fn(),
  findRevenueTotals: jest.fn(),
  findMembershipOverview: jest.fn(),
  findMembershipPlanBreakdown: jest.fn(),
  findMembershipTrend: jest.fn(),
  findExpiringMemberships: jest.fn(),
  findCurrentOccupancyRows: jest.fn(),
  findOccupancyTrend: jest.fn(),
  findOccupancyByBranch: jest.fn(),
  findUserOverview: jest.fn(),
  findUserRoleBreakdown: jest.fn(),
  findUserTrend: jest.fn(),
  findWorkoutOverview: jest.fn(),
  findWorkoutPlanGoalBreakdown: jest.fn(),
  findExerciseBreakdown: jest.fn(),
  findWorkoutCheckinTrend: jest.fn(),
  findStreakOverview: jest.fn(),
  findStreakStatusBreakdown: jest.fn(),
  findTopStreaks: jest.fn(),
  findStreakCheckinTrend: jest.fn(),
  findPaymentOverview: jest.fn(),
  findPaymentStatusBreakdown: jest.fn(),
  findPaymentProviderBreakdown: jest.fn(),
  findPaymentRevenueTrend: jest.fn(),
}));

const request = require('supertest');
const app = require('../../../app');
const repo = require('../admin.repository');
const service = require('../admin.service');
const routes = require('../admin.routes');
const {
  revenueReportQuerySchema,
  occupancyReportQuerySchema,
} = require('../admin.validation');

describe('admin module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads and mounts admin routes', async () => {
    expect(routes).toBeDefined();

    const res = await request(app).get('/api/admin/dashboard');

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/access token missing/i);
  });

  it('validates date ranges and branch filters', () => {
    const invalidRange = revenueReportQuerySchema.validate({
      from_date: '2026-07-10',
      to_date: '2026-07-01',
    });
    const invalidBranch = occupancyReportQuerySchema.validate({
      branch_id: 'not-a-uuid',
    });

    expect(invalidRange.error).toBeDefined();
    expect(invalidRange.error.details[0].message).toMatch(/to_date/i);
    expect(invalidBranch.error).toBeDefined();
    expect(invalidBranch.error.details[0].path).toContain('branch_id');
  });

  it('builds dashboard overview with normalized numeric values', async () => {
    repo.findDashboardOverview.mockResolvedValue({
      total_users: '12',
      total_members: '10',
      total_admins: '2',
      total_memberships: '8',
      active_memberships: '6',
      memberships_expiring_soon: '1',
      active_branches: '3',
      active_gym_sessions: '4',
      active_workout_plans: '5',
      today_checkins: '7',
      pending_payments: '2',
      lifetime_revenue: '900000',
      month_revenue: '300000',
      today_revenue: '100000',
    });
    repo.findRecentRevenueRows.mockResolvedValue([
      { period: '2026-07-04', transaction_count: '2', total_revenue: '200000' },
    ]);
    repo.findMembershipOverview.mockResolvedValue([
      { status: 'active', member_count: '6' },
    ]);
    repo.findCurrentOccupancyRows.mockResolvedValue([
      {
        branch_id: 'branch-1',
        branch_name: 'Central',
        active_members_in_gym: '9',
        capacity: '10',
      },
    ]);

    const result = await service.getDashboard({
      expiring_days: 7,
      recent_limit: 5,
    });

    expect(repo.findDashboardOverview).toHaveBeenCalledWith(7);
    expect(repo.findRecentRevenueRows).toHaveBeenCalledWith(5);
    expect(result.overview.total_users).toBe(12);
    expect(result.overview.lifetime_revenue).toBe(900000);
    expect(result.recent_revenue[0].transaction_count).toBe(2);
    expect(result.current_occupancy[0]).toMatchObject({
      active_members_in_gym: 9,
      capacity: 10,
      occupancy_rate: 90,
    });
  });

  it('returns a revenue report with totals and grouped rows', async () => {
    repo.findRevenueTotals.mockResolvedValue({
      transaction_count: '3',
      total_revenue: '450000',
      average_transaction_amount: '150000',
      largest_transaction_amount: '200000',
    });
    repo.findRevenueReport.mockResolvedValue([
      { period: '2026-07-01', transaction_count: '3', total_revenue: '450000' },
    ]);

    const result = await service.getRevenueReport({
      from_date: '2026-07-01',
      to_date: '2026-07-31',
      group_by: 'day',
    });

    expect(repo.findRevenueTotals).toHaveBeenCalledWith(
      expect.objectContaining({ from_date: '2026-07-01' })
    );
    expect(result.totals.total_revenue).toBe(450000);
    expect(result.rows[0].transaction_count).toBe(3);
  });

  it('returns membership report sections', async () => {
    repo.findMembershipOverview.mockResolvedValue([
      { status: 'active', member_count: '4' },
    ]);
    repo.findMembershipPlanBreakdown.mockResolvedValue([
      {
        plan_id: 'plan-1',
        plan_name: 'Monthly',
        price: '299000',
        duration_days: '30',
        total_memberships: '5',
        active_memberships: '4',
      },
    ]);
    repo.findMembershipTrend.mockResolvedValue([
      { period: '2026-07-01', new_memberships: '5' },
    ]);
    repo.findExpiringMemberships.mockResolvedValue([
      { membership_id: 'membership-1', days_remaining: '3' },
    ]);

    const result = await service.getMembershipsReport({
      group_by: 'month',
      expiring_days: 7,
    });

    expect(result.plan_breakdown[0]).toMatchObject({
      price: 299000,
      duration_days: 30,
      active_memberships: 4,
    });
    expect(result.expiring_soon[0].days_remaining).toBe(3);
  });

  it('returns occupancy report with current summary and branch breakdown', async () => {
    repo.findCurrentOccupancyRows.mockResolvedValue([
      { branch_id: 'branch-1', active_members_in_gym: '8', capacity: '10' },
    ]);
    repo.findOccupancyByBranch.mockResolvedValue([
      {
        branch_id: 'branch-1',
        capacity: '10',
        total_sessions: '12',
        unique_members: '9',
        open_sessions: '8',
        average_duration_minutes: '45.5',
      },
    ]);
    repo.findOccupancyTrend.mockResolvedValue([
      {
        period: '2026-07-01',
        total_sessions: '12',
        unique_members: '9',
        average_duration_minutes: '45.5',
      },
    ]);

    const result = await service.getOccupancyReport({
      group_by: 'day',
      branch_id: '11111111-1111-4111-8111-111111111111',
    });

    expect(result.summary).toMatchObject({
      total_active_members: 8,
      total_capacity: 10,
      branches_count: 1,
    });
    expect(result.by_branch[0].occupancy_rate).toBe(80);
    expect(result.trend[0].average_duration_minutes).toBe(45.5);
  });

  it('returns user, workout, streak, and payment statistics', async () => {
    repo.findUserOverview.mockResolvedValue({
      total_users: '10',
      members: '9',
      admins: '1',
      new_today: '2',
      new_this_month: '5',
    });
    repo.findUserRoleBreakdown.mockResolvedValue([{ role: 'member', user_count: '9' }]);
    repo.findUserTrend.mockResolvedValue([{ period: '2026-07-01', new_users: '2' }]);

    repo.findWorkoutOverview.mockResolvedValue({
      total_plans: '6',
      active_plans: '4',
      customized_plans: '2',
      total_exercises: '20',
      total_checkins: '30',
      members_with_checkins: '8',
    });
    repo.findWorkoutPlanGoalBreakdown.mockResolvedValue([
      { goal: 'weight_loss', plan_count: '3' },
    ]);
    repo.findExerciseBreakdown.mockResolvedValue([
      { muscle_group: 'chest', difficulty: 'beginner', exercise_count: '4' },
    ]);
    repo.findWorkoutCheckinTrend.mockResolvedValue([
      { period: '2026-07-01', checkin_count: '5', unique_members: '4' },
    ]);

    repo.findStreakOverview.mockResolvedValue({
      total_streak_records: '8',
      active_streaks: '6',
      active_today: '4',
      at_risk: '1',
      broken: '1',
      average_current_streak: '2.5',
      max_current_streak: '7',
      max_longest_streak: '10',
    });
    repo.findStreakStatusBreakdown.mockResolvedValue([
      { status: 'active', streak_count: '4' },
    ]);
    repo.findTopStreaks.mockResolvedValue([
      { user_id: 'user-1', current_streak: '7', longest_streak: '10' },
    ]);
    repo.findStreakCheckinTrend.mockResolvedValue([
      {
        period: '2026-07-01',
        checkin_count: '5',
        unique_members: '4',
        distinct_checkin_dates: '1',
      },
    ]);

    repo.findPaymentOverview.mockResolvedValue({
      total_payments: '5',
      pending_payments: '1',
      completed_payments: '3',
      failed_payments: '1',
      refunded_payments: '0',
      completed_amount: '600000',
      pending_amount: '200000',
      refunded_amount: '0',
    });
    repo.findPaymentStatusBreakdown.mockResolvedValue([
      { status: 'completed', payment_count: '3', amount: '600000' },
    ]);
    repo.findPaymentProviderBreakdown.mockResolvedValue([
      { provider: 'cash', payment_count: '2', amount: '400000' },
    ]);
    repo.findPaymentRevenueTrend.mockResolvedValue([
      { period: '2026-07-01', transaction_count: '3', total_revenue: '600000' },
    ]);

    const users = await service.getUserStatistics({ group_by: 'day' });
    const workouts = await service.getWorkoutStatistics({ group_by: 'day', limit: 5 });
    const streaks = await service.getStreakStatistics({ group_by: 'day', limit: 5 });
    const payments = await service.getPaymentStatistics({ group_by: 'day' });

    expect(users.overview.total_users).toBe(10);
    expect(workouts.overview.total_checkins).toBe(30);
    expect(streaks.overview.average_current_streak).toBe(2.5);
    expect(payments.overview.completed_amount).toBe(600000);
  });
});
