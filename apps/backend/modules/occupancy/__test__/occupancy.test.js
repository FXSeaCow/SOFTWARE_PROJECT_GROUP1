/**
 * occupancy.test.js
 * Unit tests for the branch-aware occupancy module.
 *
 * Repository, notification, and transaction helpers are mocked so the tests
 * focus on module behavior, calculations, and scheduler orchestration.
 */

jest.mock('../occupancy.repository', () => ({
  findActiveBranches: jest.fn(),
  findBranchById: jest.fn(),
  findCurrentOccupancy: jest.fn(),
  findUserByQrToken: jest.fn(),
  findUsersWithQrTokens: jest.fn(),
  findUserById: jest.fn(),
  findActiveMembership: jest.fn(),
  countOpenSessions: jest.fn(),
  countActiveMembersInBranch: jest.fn(),
  findOpenSessionByUser: jest.fn(),
  createSession: jest.fn(),
  closeSession: jest.fn(),
  closeOpenSessions: jest.fn(),
  findSessions: jest.fn(),
  findSessionsByDate: jest.fn(),
  findWorkoutCheckinByUserAndDate: jest.fn(),
  createWorkoutCheckin: jest.fn(),
  findWorkoutCheckinDatesByUser: jest.fn(),
  ensureWorkoutStreak: jest.fn(),
  updateWorkoutStreak: jest.fn(),
}));

jest.mock('../../notifications/notifications.service', () => ({
  createFromTemplate: jest.fn(),
  broadcastFromTemplate: jest.fn(),
}));

jest.mock('../../../utils/Transaction', () => ({
  withTransaction: jest.fn(async (callback) => callback({ tx: true })),
}));

jest.mock('../../../utils/Logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const repo = require('../occupancy.repository');
const notificationsService = require('../../notifications/notifications.service');
const calculator = require('../occupancyCalculator');
const service = require('../occupancy.service');
const scheduler = require('../occupancy.scheduler');
const routes = require('../occupancy.routes');
const request = require('supertest');
const app = require('../../../app');
const { NOTIFICATION_TEMPLATE } = require('../../notifications/notifications.constants');

const member = {
  id: 'user-1',
  role: 'member',
  email: 'member@example.com',
  full_name: 'Member One',
};

const membership = {
  id: 'membership-1',
  user_id: 'user-1',
  status: 'active',
};

const branch = {
  id: 'branch-1',
  name: 'Central Branch',
  address: '123 Main Street',
  city: 'Ho Chi Minh City',
  phone: '0900000000',
  opening_time: '06:00:00',
  closing_time: '22:00:00',
  capacity: 20,
  is_active: true,
};

const dateOnly = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

describe('occupancy module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    scheduler.stopOccupancyScheduler();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    scheduler.stopOccupancyScheduler();
  });

  it('loads the Express router', () => {
    expect(routes).toBeDefined();
  });

  it('calculates current occupancy, available slots, rate, and status', () => {
    const result = calculator.calculateCurrentOccupancy(85, 100);

    expect(result).toEqual({
      current_occupancy: 85,
      capacity: 100,
      available_slots: 15,
      occupancy_rate: 85,
      status: 'near_full',
      is_full: false,
    });
    expect(calculator.calculateOccupancyRate(25, 80)).toBe(31.25);
  });

  it('builds hourly occupancy, peak hour, average occupancy, and daily reports', () => {
    const sessions = [
      {
        id: 'session-1',
        user_id: 'user-1',
        checked_in_at: '2026-07-01T08:15:00',
        checked_out_at: '2026-07-01T10:10:00',
      },
      {
        id: 'session-2',
        user_id: 'user-2',
        checked_in_at: '2026-07-01T09:00:00',
        checked_out_at: '2026-07-01T11:00:00',
      },
      {
        id: 'session-3',
        user_id: 'user-1',
        checked_in_at: '2026-07-01T09:30:00',
        checked_out_at: '2026-07-01T10:30:00',
      },
    ];

    const peak = calculator.calculatePeakHour(sessions, '2026-07-01');
    const report = calculator.buildDailyReport(sessions, {
      date: '2026-07-01',
      capacity: 100,
    });

    expect(peak).toEqual({ hour: '09:00', occupancy: 3 });
    expect(report).toMatchObject({
      date: '2026-07-01',
      total_visits: 3,
      unique_members: 2,
      open_sessions: 0,
      peak_hour: { hour: '09:00', occupancy: 3 },
    });
    expect(report.average_occupancy).toBeGreaterThan(0);
    expect(report.hourly_occupancy).toHaveLength(24);
  });

  it('returns current occupancy for all active branches', async () => {
    repo.findActiveBranches.mockResolvedValue([branch]);
    repo.findCurrentOccupancy.mockResolvedValue([
      {
        branch_id: branch.id,
        branch_name: branch.name,
        active_members_in_gym: 12,
        capacity: branch.capacity,
      },
    ]);

    const result = await service.getCurrentOccupancy();

    expect(repo.findActiveBranches).toHaveBeenCalled();
    expect(repo.findCurrentOccupancy).toHaveBeenCalledWith();
    expect(result.current_occupancy).toBe(12);
    expect(result.total_branches).toBe(1);
    expect(result.branches[0]).toMatchObject({
      branch_id: branch.id,
      branch_name: branch.name,
      current_occupancy: 12,
      capacity: 20,
    });
  });

  it('returns current occupancy for one branch', async () => {
    repo.findBranchById.mockResolvedValue(branch);
    repo.findCurrentOccupancy.mockResolvedValue([
      {
        branch_id: branch.id,
        branch_name: branch.name,
        active_members_in_gym: 18,
        capacity: branch.capacity,
      },
    ]);

    const result = await service.getCurrentOccupancy({ branch_id: branch.id });

    expect(repo.findBranchById).toHaveBeenCalledWith(branch.id, undefined);
    expect(repo.findCurrentOccupancy).toHaveBeenCalledWith(branch.id);
    expect(result).toMatchObject({
      branch_id: branch.id,
      current_occupancy: 18,
      occupancy_rate: 90,
      is_crowded: true,
    });
  });

  it('returns active member count for one branch', async () => {
    const branchId = '11111111-1111-4111-8111-111111111111';
    const branchWithUuid = { ...branch, id: branchId, capacity: 10 };

    repo.findBranchById.mockResolvedValue(branchWithUuid);
    repo.countActiveMembersInBranch.mockResolvedValue(7);

    const result = await service.getBranchActiveMembers(branchId);

    expect(repo.countActiveMembersInBranch).toHaveBeenCalledWith(branchId);
    expect(result).toMatchObject({
      active_members: 7,
      current_occupancy: 7,
      capacity: 10,
      available_slots: 3,
      occupancy_rate: 70,
      is_full: false,
    });

    const res = await request(app)
      .get(`/api/occupancy/branches/${branchId}/active-members`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      active_members: 7,
      current_occupancy: 7,
      occupancy_rate: 70,
    });
  });

  it('checks a member into a branch, creates a session, and syncs workout streak data', async () => {
    const today = dateOnly();

    repo.findUserById.mockResolvedValue(member);
    repo.findActiveMembership.mockResolvedValue(membership);
    repo.findBranchById.mockResolvedValue(branch);
    repo.findOpenSessionByUser.mockResolvedValue(null);
    repo.countOpenSessions.mockResolvedValueOnce(11);
    repo.createSession.mockResolvedValue({
      id: 'session-1',
      user_id: 'user-1',
      branch_id: branch.id,
      checked_in_at: new Date(),
      checked_out_at: null,
    });
    repo.ensureWorkoutStreak.mockResolvedValue({ id: 'streak-1' });
    repo.findWorkoutCheckinByUserAndDate.mockResolvedValue(null);
    repo.createWorkoutCheckin.mockResolvedValue({
      id: 'checkin-1',
      user_id: 'user-1',
      branch_id: branch.id,
      checkin_date: today,
    });
    repo.findWorkoutCheckinDatesByUser.mockResolvedValue([today]);
    repo.updateWorkoutStreak.mockResolvedValue({
      id: 'streak-1',
      user_id: 'user-1',
      current_streak: 1,
      longest_streak: 1,
      last_active_date: today,
    });

    const result = await service.checkIn(member, { branch_id: branch.id });

    expect(repo.createSession).toHaveBeenCalledWith(
      'user-1',
      branch.id,
      expect.any(Date),
      expect.any(Object)
    );
    expect(repo.createWorkoutCheckin).toHaveBeenCalledWith(
      'user-1',
      branch.id,
      today,
      expect.any(Date),
      expect.any(Object)
    );
    expect(result.branch.branch_id).toBe(branch.id);
    expect(result.occupancy.current_occupancy).toBe(11);
    expect(result.workout_checkin_created).toBe(true);
    expect(notificationsService.broadcastFromTemplate).not.toHaveBeenCalled();
  });

  it('broadcasts an occupancy alert when check-in makes a branch crowded', async () => {
    const today = dateOnly();

    repo.findUserById.mockResolvedValue(member);
    repo.findActiveMembership.mockResolvedValue(membership);
    repo.findBranchById.mockResolvedValue({ ...branch, capacity: 10 });
    repo.findOpenSessionByUser.mockResolvedValue(null);
    repo.countOpenSessions.mockResolvedValueOnce(9);
    repo.createSession.mockResolvedValue({
      id: 'session-1',
      user_id: 'user-1',
      branch_id: branch.id,
      checked_in_at: new Date(),
      checked_out_at: null,
    });
    repo.ensureWorkoutStreak.mockResolvedValue({ id: 'streak-1' });
    repo.createWorkoutCheckin.mockResolvedValue({
      id: 'checkin-1',
      user_id: 'user-1',
      branch_id: branch.id,
      checkin_date: today,
    });
    repo.findWorkoutCheckinDatesByUser.mockResolvedValue([today]);
    repo.updateWorkoutStreak.mockResolvedValue({ id: 'streak-1' });
    notificationsService.broadcastFromTemplate.mockResolvedValue({
      audience_count: 2,
      created_count: 2,
      notifications: [{ id: 'alert-1' }, { id: 'alert-2' }],
    });

    const result = await service.checkIn(member, { branch_id: branch.id });

    expect(notificationsService.broadcastFromTemplate).toHaveBeenCalledWith(
      NOTIFICATION_TEMPLATE.OCCUPANCY_ALERT,
      expect.objectContaining({
        branch_name: branch.name,
        occupancy_rate: 90,
        current_occupancy: 9,
        capacity: 10,
        reason: 'crowded',
      }),
      { role: 'member' }
    );
    expect(result.crowding_alert).toMatchObject({
      audience_count: 2,
      created_count: 2,
    });
  });

  it('allows check-in and broadcasts when the branch is full', async () => {
    const today = dateOnly();

    repo.findUserById.mockResolvedValue(member);
    repo.findActiveMembership.mockResolvedValue(membership);
    repo.findBranchById.mockResolvedValue({ ...branch, capacity: 10 });
    repo.findOpenSessionByUser.mockResolvedValue(null);
    repo.countOpenSessions.mockResolvedValueOnce(11);
    repo.createSession.mockResolvedValue({
      id: 'session-full',
      user_id: 'user-1',
      branch_id: branch.id,
      checked_in_at: new Date(),
      checked_out_at: null,
    });
    repo.ensureWorkoutStreak.mockResolvedValue({ id: 'streak-1' });
    repo.createWorkoutCheckin.mockResolvedValue({
      id: 'checkin-full',
      user_id: 'user-1',
      branch_id: branch.id,
      checkin_date: today,
    });
    repo.findWorkoutCheckinDatesByUser.mockResolvedValue([today]);
    repo.updateWorkoutStreak.mockResolvedValue({
      id: 'streak-1',
      user_id: 'user-1',
      current_streak: 1,
      longest_streak: 1,
      last_active_date: today,
    });
    notificationsService.broadcastFromTemplate.mockResolvedValue({
      audience_count: 3,
      created_count: 3,
      notifications: [],
    });

    const result = await service.checkIn(member, { branch_id: branch.id });

    expect(repo.createSession).toHaveBeenCalled();
    expect(notificationsService.broadcastFromTemplate).toHaveBeenCalledWith(
      NOTIFICATION_TEMPLATE.OCCUPANCY_ALERT,
      expect.objectContaining({
        reason: 'full',
        current_occupancy: 11,
        capacity: 10,
      }),
      { role: 'member' }
    );
    expect(result.occupancy.is_full).toBe(true);
  });

  it('rejects check-in when the member already has an open session', async () => {
    repo.findUserById.mockResolvedValue(member);
    repo.findActiveMembership.mockResolvedValue(membership);
    repo.findBranchById.mockResolvedValue(branch);
    repo.findOpenSessionByUser.mockResolvedValue({
      id: 'session-open',
      user_id: 'user-1',
      branch_id: branch.id,
      branch_name: branch.name,
    });

    await expect(
      service.checkIn(member, { branch_id: branch.id })
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(repo.createSession).not.toHaveBeenCalled();
  });

  it('checks a member out and updates the branch occupancy', async () => {
    repo.findUserById.mockResolvedValue(member);
    repo.findOpenSessionByUser.mockResolvedValue({
      id: 'session-1',
      user_id: 'user-1',
      branch_id: branch.id,
      branch_name: branch.name,
    });
    repo.findBranchById.mockResolvedValue(branch);
    repo.closeSession.mockResolvedValue({
      id: 'session-1',
      user_id: 'user-1',
      branch_id: branch.id,
      checked_out_at: new Date(),
    });
    repo.countOpenSessions.mockResolvedValue(3);

    const result = await service.checkOut(member, {});

    expect(repo.closeSession).toHaveBeenCalledWith(
      'session-1',
      expect.any(Date),
      expect.any(Object)
    );
    expect(repo.countOpenSessions).toHaveBeenCalledWith(
      branch.id,
      expect.any(Object)
    );
    expect(result.occupancy.current_occupancy).toBe(3);
  });

  it('lists sessions and builds daily reports through the service', async () => {
    repo.findSessions.mockResolvedValue({
      rows: [{ id: 'session-1' }],
      total: 1,
    });
    repo.findActiveBranches.mockResolvedValue([branch]);
    repo.findSessionsByDate.mockResolvedValue([
      {
        id: 'session-1',
        user_id: 'user-1',
        branch_id: branch.id,
        checked_in_at: '2026-07-01T09:00:00',
        checked_out_at: '2026-07-01T10:00:00',
      },
    ]);

    const list = await service.listMySessions('user-1', {
      page: '1',
      limit: '5',
      branch_id: branch.id,
    });
    const report = await service.getDailyReport({ date: '2026-07-01' });

    expect(repo.findSessions).toHaveBeenCalledWith(
      expect.objectContaining({ branch_id: branch.id })
    );
    expect(repo.findSessionsByDate).toHaveBeenCalledWith('2026-07-01', null);
    expect(list).toMatchObject({ total: 1, page: 1, limit: 5 });
    expect(report).toMatchObject({
      date: '2026-07-01',
      total_visits: 1,
      branches_count: 1,
    });
  });

  it('resets open sessions and refreshes the occupancy cache', async () => {
    repo.closeOpenSessions.mockResolvedValue([{ id: 'session-1' }]);
    repo.findActiveBranches.mockResolvedValue([branch]);
    repo.findCurrentOccupancy.mockResolvedValue([
      {
        branch_id: branch.id,
        branch_name: branch.name,
        active_members_in_gym: 0,
        capacity: branch.capacity,
      },
    ]);

    const reset = await service.resetOpenSessions();
    const cache = await service.refreshOccupancyCache();

    expect(repo.closeOpenSessions).toHaveBeenCalledWith(
      expect.any(Date),
      null,
      expect.any(Object)
    );
    expect(reset.closed_count).toBe(1);
    expect(cache.data.current_occupancy).toBe(0);
    expect(service.getOccupancyCache().data.current_occupancy).toBe(0);
  });

  it('runs scheduler jobs by delegating to occupancy services', async () => {
    const refreshSpy = jest
      .spyOn(service, 'refreshOccupancyCache')
      .mockResolvedValue({
        data: {
          occupancy_rate: 50,
          current_occupancy: 25,
          total_branches: 1,
        },
      });
    const currentSpy = jest
      .spyOn(service, 'getCurrentOccupancy')
      .mockResolvedValue({
        occupancy_rate: 95,
        current_occupancy: 95,
        capacity: 100,
        branches: [
          {
            branch_id: branch.id,
            branch_name: branch.name,
            occupancy_rate: 95,
            current_occupancy: 95,
            capacity: 100,
          },
        ],
      });
    const reportSpy = jest
      .spyOn(service, 'getDailyReport')
      .mockResolvedValue({ total_visits: 10 });
    const resetSpy = jest
      .spyOn(service, 'resetOpenSessions')
      .mockResolvedValue({ closed_count: 2 });

    await scheduler.refreshCacheJob();
    await scheduler.capacityAlertJob();
    const maintenance = await scheduler.dailyMaintenanceJob();

    expect(refreshSpy).toHaveBeenCalled();
    expect(currentSpy).toHaveBeenCalled();
    expect(reportSpy).toHaveBeenCalled();
    expect(resetSpy).toHaveBeenCalled();
    expect(maintenance.reset.closed_count).toBe(2);
  });

  it('starts and stops the scheduler without creating jobs when all options are disabled', () => {
    const started = scheduler.startOccupancyScheduler({
      cache: false,
      alerts: false,
      dailyMaintenance: false,
    });

    expect(started.state.started).toBe(true);
    expect(started.state.handles).toHaveLength(0);

    scheduler.stopOccupancyScheduler();
  });
});
