/**
 * streaks.test.js
 * Unit tests for the streaks module.
 *
 * These tests mock the repository and transaction helper so the module logic
 * can be verified without requiring a live PostgreSQL database.
 */

jest.mock('../streaks.repository', () => ({
  findUserById: jest.fn(),
  findBranchById: jest.fn(),
  findStreakByUserId: jest.fn(),
  createStreakRecord: jest.fn(),
  updateStreak: jest.fn(),
  findCheckinByUserAndDate: jest.fn(),
  createCheckin: jest.fn(),
  countCheckinsByUser: jest.fn(),
  findCheckinsByUser: jest.fn(),
  findCheckinDatesByUser: jest.fn(),
  findLeaderboard: jest.fn(),
}));

jest.mock('../../../utils/Transaction', () => ({
  withTransaction: jest.fn(async (callback) => callback({ tx: true })),
}));

jest.mock('../../../utils/Logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const repo = require('../streaks.repository');
const { withTransaction } = require('../../../utils/Transaction');
const service = require('../streaks.service');
const routes = require('../streaks.routes');
const request = require('supertest');
const app = require('../../../app');
const { STREAK_STATUS } = require('../streaks.constants');

const dateOnly = (offsetDays = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const branch = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Central Branch',
  capacity: 20,
  is_active: true,
};

describe('streaks module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads the Express router', () => {
    expect(routes).toBeDefined();
  });

  it('mounts streak routes in the app', async () => {
    const res = await request(app).get('/api/streaks/me');

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/access token missing/i);
  });

  it('calculates current and longest streaks from check-in dates', () => {
    const stats = service.calculateStreakStats([
      '2026-07-01',
      '2026-07-02',
      '2026-07-04',
      '2026-07-05',
      '2026-07-06',
    ]);

    expect(stats).toEqual({
      current_streak: 3,
      longest_streak: 3,
      last_active_date: '2026-07-06',
    });
  });

  it('resolves streak status from the last active date', () => {
    expect(service.resolveStatus(null)).toBe(STREAK_STATUS.NOT_STARTED);
    expect(service.resolveStatus(dateOnly(0))).toBe(STREAK_STATUS.ACTIVE);
    expect(service.resolveStatus(dateOnly(-1))).toBe(STREAK_STATUS.AT_RISK);
    expect(service.resolveStatus(dateOnly(-3))).toBe(STREAK_STATUS.BROKEN);
  });

  it('returns the authenticated member streak summary', async () => {
    repo.findStreakByUserId.mockResolvedValue({
      id: 'streak-1',
      user_id: 'user-1',
      current_streak: 2,
      longest_streak: 5,
      last_active_date: dateOnly(0),
    });
    repo.countCheckinsByUser.mockResolvedValue(7);

    const result = await service.getMyStreak('user-1');

    expect(repo.findStreakByUserId).toHaveBeenCalledWith('user-1', undefined);
    expect(result).toMatchObject({
      user_id: 'user-1',
      current_streak: 2,
      longest_streak: 5,
      total_checkins: 7,
      status: STREAK_STATUS.ACTIVE,
    });
  });

  it('lists check-ins with parsed pagination', async () => {
    repo.findCheckinsByUser.mockResolvedValue({
      rows: [{ id: 'checkin-1', checkin_date: '2026-07-02' }],
      total: 1,
    });

    const result = await service.listMyCheckins('user-1', {
      page: '2',
      limit: '5',
      from_date: '2026-07-01',
    });

    expect(repo.findCheckinsByUser).toHaveBeenCalledWith('user-1', {
      limit: 5,
      offset: 5,
      branch_id: undefined,
      from_date: '2026-07-01',
      to_date: undefined,
    });
    expect(result).toMatchObject({ total: 1, page: 2, limit: 5 });
  });

  it('records a new check-in and recalculates the streak in one transaction', async () => {
    const today = dateOnly(0);

    repo.findStreakByUserId.mockResolvedValue({
      id: 'streak-1',
      user_id: 'user-1',
      current_streak: 0,
      longest_streak: 0,
      last_active_date: null,
    });
    repo.findBranchById.mockResolvedValue(branch);
    repo.findCheckinByUserAndDate.mockResolvedValue(null);
    repo.createCheckin.mockResolvedValue({
      id: 'checkin-1',
      user_id: 'user-1',
      branch_id: branch.id,
      checkin_date: today,
      counted_for_streak: true,
    });
    repo.findCheckinDatesByUser.mockResolvedValue([today]);
    repo.updateStreak.mockResolvedValue({
      id: 'streak-1',
      user_id: 'user-1',
      current_streak: 1,
      longest_streak: 1,
      last_active_date: today,
    });
    repo.countCheckinsByUser.mockResolvedValue(1);

    const result = await service.recordCheckin('user-1', {
      branch_id: branch.id,
      checkin_date: today,
    });

    expect(withTransaction).toHaveBeenCalledTimes(1);
    expect(repo.findBranchById).toHaveBeenCalledWith(branch.id, expect.any(Object));
    expect(repo.createCheckin).toHaveBeenCalledWith(
      'user-1',
      branch.id,
      today,
      expect.any(Date),
      true,
      expect.any(Object)
    );
    expect(repo.updateStreak).toHaveBeenCalledWith(
      'user-1',
      { current_streak: 1, longest_streak: 1, last_active_date: today },
      expect.any(Object)
    );
    expect(result.already_checked_in).toBe(false);
    expect(result.streak.current_streak).toBe(1);
  });

  it('records another same-day check-in without increasing the streak', async () => {
    const today = dateOnly(0);

    repo.findStreakByUserId.mockResolvedValue({
      id: 'streak-1',
      user_id: 'user-1',
      current_streak: 4,
      longest_streak: 4,
      last_active_date: today,
    });
    repo.findBranchById.mockResolvedValue(branch);
    repo.findCheckinByUserAndDate.mockResolvedValue({
      id: 'checkin-1',
      user_id: 'user-1',
      branch_id: branch.id,
      checkin_date: today,
      counted_for_streak: true,
    });
    repo.createCheckin.mockResolvedValue({
      id: 'checkin-2',
      user_id: 'user-1',
      branch_id: branch.id,
      checkin_date: today,
      counted_for_streak: false,
    });
    repo.findCheckinDatesByUser.mockResolvedValue([today]);
    repo.updateStreak.mockResolvedValue({
      id: 'streak-1',
      user_id: 'user-1',
      current_streak: 1,
      longest_streak: 4,
      last_active_date: today,
    });
    repo.countCheckinsByUser.mockResolvedValue(1);

    const result = await service.recordCheckin('user-1', {
      branch_id: branch.id,
      checkin_date: today,
    });

    expect(repo.createCheckin).toHaveBeenCalledWith(
      'user-1',
      branch.id,
      today,
      expect.any(Date),
      false,
      expect.any(Object)
    );
    expect(repo.updateStreak).toHaveBeenCalledWith(
      'user-1',
      { current_streak: 1, longest_streak: 1, last_active_date: today },
      expect.any(Object)
    );
    expect(result.already_checked_in).toBe(false);
    expect(result.checkin.counted_for_streak).toBe(false);
    expect(result.streak.current_streak).toBe(1);
    expect(result.streak.total_checkins).toBe(1);
  });

  it('rejects future check-in dates', async () => {
    await expect(
      service.recordCheckin('user-1', { checkin_date: '2999-01-01' })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('builds a ranked leaderboard', async () => {
    repo.findLeaderboard.mockResolvedValue([
      {
        user_id: 'user-1',
        full_name: 'Member One',
        current_streak: 8,
        longest_streak: 10,
        last_active_date: dateOnly(0),
      },
    ]);

    const result = await service.getLeaderboard({ limit: 5 });

    expect(repo.findLeaderboard).toHaveBeenCalledWith({ limit: 5 });
    expect(result[0]).toMatchObject({
      rank: 1,
      user_id: 'user-1',
      status: STREAK_STATUS.ACTIVE,
    });
  });

  it('returns 404 when admin requests a missing user streak', async () => {
    repo.findUserById.mockResolvedValue(null);

    await expect(service.getUserStreak('missing-user')).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
