/**
 * occupancy.test.js
 * Unit tests for the occupancy module.
 *
 * Repository and transaction helpers are mocked so the tests focus on module
 * behavior, calculations, and scheduler orchestration.
 */

jest.mock('../occupancy.repository', () => ({
  findUserByQrToken: jest.fn(),
  findUserById: jest.fn(),
  findActiveMembership: jest.fn(),
  countOpenSessions: jest.fn(),
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

jest.mock('../../../utils/Transaction', () => ({
  withTransaction: jest.fn(async (callback) => callback({ tx: true })),
}));

jest.mock('../../../utils/Logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const repo = require('../occupancy.repository');
const calculator = require('../occupancyCalculator');
const service = require('../occupancy.service');
const scheduler = require('../occupancy.scheduler');
const routes = require('../occupancy.routes');

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
        check_in_at: '2026-07-01T08:15:00',
        check_out_at: '2026-07-01T10:10:00',
      },
      {
        id: 'session-2',
        user_id: 'user-2',
        check_in_at: '2026-07-01T09:00:00',
        check_out_at: '2026-07-01T11:00:00',
      },
      {
        id: 'session-3',
        user_id: 'user-1',
        check_in_at: '2026-07-01T09:30:00',
        check_out_at: '2026-07-01T10:30:00',
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

  it('returns current occupancy from open gym sessions', async () => {
    repo.countOpenSessions.mockResolvedValue(12);

    const result = await service.getCurrentOccupancy();

    expect(repo.countOpenSessions).toHaveBeenCalled();
    expect(result.current_occupancy).toBe(12);
  });

  it('checks a member in, creates a session, and syncs workout streak data', async () => {
    const today = dateOnly();

    repo.findUserById.mockResolvedValue(member);
    repo.findActiveMembership.mockResolvedValue(membership);
    repo.findOpenSessionByUser.mockResolvedValue(null);
    repo.countOpenSessions
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(11);
    repo.createSession.mockResolvedValue({
      id: 'session-1',
      user_id: 'user-1',
      check_in_at: new Date(),
      check_out_at: null,
    });
    repo.ensureWorkoutStreak.mockResolvedValue({ id: 'streak-1' });
    repo.findWorkoutCheckinByUserAndDate.mockResolvedValue(null);
    repo.createWorkoutCheckin.mockResolvedValue({
      id: 'checkin-1',
      user_id: 'user-1',
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

    const result = await service.checkIn(member, {});

    expect(repo.createSession).toHaveBeenCalledWith(
      'user-1',
      expect.any(Date),
      expect.any(Object)
    );
    expect(repo.createWorkoutCheckin).toHaveBeenCalledWith(
      'user-1',
      today,
      expect.any(Object)
    );
    expect(result.occupancy.current_occupancy).toBe(11);
    expect(result.workout_checkin_created).toBe(true);
  });

  it('rejects check-in when the member already has an open session', async () => {
    repo.findUserById.mockResolvedValue(member);
    repo.findActiveMembership.mockResolvedValue(membership);
    repo.findOpenSessionByUser.mockResolvedValue({
      id: 'session-open',
      user_id: 'user-1',
    });

    await expect(service.checkIn(member, {})).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(repo.createSession).not.toHaveBeenCalled();
  });

  it('checks a member out and updates occupancy', async () => {
    repo.findUserById.mockResolvedValue(member);
    repo.findOpenSessionByUser.mockResolvedValue({
      id: 'session-1',
      user_id: 'user-1',
    });
    repo.closeSession.mockResolvedValue({
      id: 'session-1',
      user_id: 'user-1',
      check_out_at: new Date(),
    });
    repo.countOpenSessions.mockResolvedValue(3);

    const result = await service.checkOut(member, {});

    expect(repo.closeSession).toHaveBeenCalledWith(
      'session-1',
      expect.any(Date),
      expect.any(Object)
    );
    expect(result.occupancy.current_occupancy).toBe(3);
  });

  it('lists sessions and builds daily reports through the service', async () => {
    repo.findSessions.mockResolvedValue({
      rows: [{ id: 'session-1' }],
      total: 1,
    });
    repo.findSessionsByDate.mockResolvedValue([
      {
        id: 'session-1',
        user_id: 'user-1',
        check_in_at: '2026-07-01T09:00:00',
        check_out_at: '2026-07-01T10:00:00',
      },
    ]);

    const list = await service.listMySessions('user-1', { page: '1', limit: '5' });
    const report = await service.getDailyReport({ date: '2026-07-01' });

    expect(list).toMatchObject({ total: 1, page: 1, limit: 5 });
    expect(report).toMatchObject({ date: '2026-07-01', total_visits: 1 });
  });

  it('resets open sessions and refreshes the occupancy cache', async () => {
    repo.closeOpenSessions.mockResolvedValue([{ id: 'session-1' }]);
    repo.countOpenSessions.mockResolvedValue(0);

    const reset = await service.resetOpenSessions();
    const cache = await service.refreshOccupancyCache();

    expect(reset.closed_count).toBe(1);
    expect(cache.data.current_occupancy).toBe(0);
    expect(service.getOccupancyCache().data.current_occupancy).toBe(0);
  });

  it('runs scheduler jobs by delegating to occupancy services', async () => {
    const refreshSpy = jest
      .spyOn(service, 'refreshOccupancyCache')
      .mockResolvedValue({
        data: { occupancy_rate: 50, current_occupancy: 25 },
      });
    const currentSpy = jest
      .spyOn(service, 'getCurrentOccupancy')
      .mockResolvedValue({
        occupancy_rate: 95,
        current_occupancy: 95,
        capacity: 100,
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
