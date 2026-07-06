/**
 * notifications.test.js
 * Unit tests for the notifications module.
 *
 * The repository is mocked so tests verify templates, service behavior,
 * scheduler orchestration, and validation without requiring PostgreSQL.
 */

jest.mock('../notifications.repository', () => ({
  findUserById: jest.fn(),
  findUsers: jest.fn(),
  createNotification: jest.fn(),
  createBulkNotifications: jest.fn(),
  findByIdAndUser: jest.fn(),
  findById: jest.fn(),
  findAll: jest.fn(),
  countUnreadByUser: jest.fn(),
  markAsRead: jest.fn(),
  markAllAsRead: jest.fn(),
  deleteByIdAndUser: jest.fn(),
  deleteById: jest.fn(),
  findRecentByType: jest.fn(),
  findMembershipsExpiringSoon: jest.fn(),
  findStreaksAtRisk: jest.fn(),
  resetStreaksPastThreshold: jest.fn(),
  deleteOldReadNotifications: jest.fn(),
}));

jest.mock('../../../utils/Logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const repo = require('../notifications.repository');
const templates = require('../notification.templates');
const service = require('../notifications.service');
const scheduler = require('../notification.scheduler');
const routes = require('../notifications.routes');
const {
  createNotificationSchema,
  broadcastNotificationSchema,
} = require('../notifications.validation');
const {
  NOTIFICATION_TYPE,
  NOTIFICATION_TEMPLATE,
  NOTIFICATION_SEVERITY,
  NOTIFICATION_SCHEDULER,
} = require('../notifications.constants');

const user = {
  id: 'user-1',
  email: 'member@example.com',
  full_name: 'Member One',
  role: 'member',
};

const notification = {
  id: 'notification-1',
  user_id: 'user-1',
  announcement_id: null,
  type: NOTIFICATION_TYPE.ANNOUNCEMENT,
  title: 'Hello',
  body: 'Welcome back',
  is_read: false,
  read_at: null,
  sent_at: '2026-07-01T00:00:00.000Z',
};

describe('notifications module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    scheduler.stopNotificationScheduler();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    scheduler.stopNotificationScheduler();
  });

  it('loads the Express router', () => {
    expect(routes).toBeDefined();
  });

  it('renders known templates and falls back for unknown templates', () => {
    const expiring = templates.renderTemplate(
      NOTIFICATION_TEMPLATE.MEMBERSHIP_EXPIRY,
      { days_remaining: 3 }
    );
    const occupancy = templates.renderTemplate(
      NOTIFICATION_TEMPLATE.OCCUPANCY_ALERT,
      {
        branch_name: 'Central Branch',
        occupancy_rate: 100,
        current_occupancy: 20,
        capacity: 20,
        reason: 'full',
      }
    );
    const fallback = templates.renderTemplate('unknown_template', {
      title: 'Fallback title',
      body: 'Fallback body',
    });

    expect(expiring).toMatchObject({
      type: NOTIFICATION_TYPE.MEMBERSHIP_EXPIRY,
      severity: NOTIFICATION_SEVERITY.WARNING,
      title: 'Membership expiring soon',
    });
    expect(expiring.body).toContain('3 day');
    expect(occupancy).toMatchObject({
      type: NOTIFICATION_TYPE.OCCUPANCY_ALERT,
      severity: NOTIFICATION_SEVERITY.DANGER,
      title: 'Central Branch is crowded',
    });
    expect(occupancy.body).toContain('full capacity');
    expect(fallback).toMatchObject({
      type: NOTIFICATION_TYPE.ANNOUNCEMENT,
      title: 'Fallback title',
      body: 'Fallback body',
    });
  });

  it('validates required notification payloads and broadcast payloads', () => {
    const missingUser = createNotificationSchema.validate({
      title: 'Hello',
      body: 'Message',
    });
    const validBroadcast = broadcastNotificationSchema.validate({
      role: 'member',
      title: 'Announcement',
      body: 'Gym closes early today',
    });

    expect(missingUser.error).toBeDefined();
    expect(
      missingUser.error.details.some((detail) => detail.path.includes('user_id'))
    ).toBe(true);
    expect(validBroadcast.error).toBeUndefined();
    expect(validBroadcast.value.type).toBe(NOTIFICATION_TYPE.ANNOUNCEMENT);
  });

  it('normalizes notification payload defaults', () => {
    const normalized = service.normalizeNotification({
      title: 'Hello',
      body: 'Message',
    });

    expect(normalized).toEqual({
      type: NOTIFICATION_TYPE.ANNOUNCEMENT,
      announcement_id: null,
      title: 'Hello',
      body: 'Message',
    });
  });

  it('creates a notification after verifying the target user exists', async () => {
    repo.findUserById.mockResolvedValue(user);
    repo.createNotification.mockResolvedValue(notification);

    const result = await service.createNotification('user-1', {
      title: 'Hello',
      body: 'Welcome back',
    });

    expect(repo.findUserById).toHaveBeenCalledWith('user-1');
    expect(repo.createNotification).toHaveBeenCalledWith({
      user_id: 'user-1',
      type: NOTIFICATION_TYPE.ANNOUNCEMENT,
      announcement_id: null,
      title: 'Hello',
      body: 'Welcome back',
    });
    expect(result).toBe(notification);
  });

  it('returns 404 when creating a notification for a missing user', async () => {
    repo.findUserById.mockResolvedValue(null);

    await expect(
      service.createNotification('missing-user', {
        title: 'Hello',
        body: 'Welcome back',
      })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('creates a notification from a template', async () => {
    repo.findUserById.mockResolvedValue(user);
    repo.createNotification.mockImplementation(async (payload) => ({
      ...notification,
      ...payload,
      id: 'templated-1',
    }));

    const result = await service.createFromTemplate(
      'user-1',
      NOTIFICATION_TEMPLATE.STREAK_WARNING,
      { last_active_date: '2026-07-01' }
    );

    expect(repo.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        type: NOTIFICATION_TYPE.STREAK_WARNING,
        title: 'Your workout streak needs attention',
      })
    );
    expect(result.id).toBe('templated-1');
  });

  it('lists member and admin notifications with pagination', async () => {
    repo.findAll.mockResolvedValue({
      rows: [notification],
      total: 1,
    });

    const myList = await service.listMyNotifications('user-1', {
      page: '2',
      limit: '5',
      is_read: false,
    });
    const adminList = await service.listAllNotifications({
      user_id: 'user-1',
      page: '1',
      limit: '10',
    });

    expect(repo.findAll).toHaveBeenNthCalledWith(1, {
      user_id: 'user-1',
      type: undefined,
      is_read: false,
      limit: 5,
      offset: 5,
    });
    expect(myList).toMatchObject({ total: 1, page: 2, limit: 5 });
    expect(adminList.notifications).toHaveLength(1);
  });

  it('gets unread count and marks notifications as read', async () => {
    repo.countUnreadByUser.mockResolvedValue(4);
    repo.findByIdAndUser.mockResolvedValue(notification);
    repo.markAsRead.mockResolvedValue({
      ...notification,
      is_read: true,
      read_at: '2026-07-02T00:00:00.000Z',
    });
    repo.markAllAsRead.mockResolvedValue(3);

    const unread = await service.getUnreadCount('user-1');
    const read = await service.markAsRead('notification-1', 'user-1');
    const allRead = await service.markAllAsRead('user-1');

    expect(unread).toEqual({ unread_count: 4 });
    expect(repo.markAsRead).toHaveBeenCalledWith('notification-1');
    expect(read.is_read).toBe(true);
    expect(allRead).toEqual({ updated_count: 3 });
  });

  it('returns an already-read notification without updating it again', async () => {
    repo.findByIdAndUser.mockResolvedValue({
      ...notification,
      is_read: true,
    });

    const result = await service.markAsRead('notification-1', 'user-1');

    expect(repo.markAsRead).not.toHaveBeenCalled();
    expect(result.is_read).toBe(true);
  });

  it('deletes member-owned and admin-selected notifications', async () => {
    repo.findByIdAndUser.mockResolvedValue(notification);
    repo.deleteByIdAndUser.mockResolvedValue(true);
    repo.findById.mockResolvedValue(notification);
    repo.deleteById.mockResolvedValue(true);

    await expect(
      service.deleteMyNotification('notification-1', 'user-1')
    ).resolves.toBeUndefined();
    await expect(
      service.deleteNotification('notification-1')
    ).resolves.toBeUndefined();

    expect(repo.deleteByIdAndUser).toHaveBeenCalledWith(
      'notification-1',
      'user-1'
    );
    expect(repo.deleteById).toHaveBeenCalledWith('notification-1');
  });

  it('broadcasts a notification to users matching the requested role', async () => {
    repo.findUsers.mockResolvedValue([
      { id: 'user-1' },
      { id: 'user-2' },
    ]);
    repo.createBulkNotifications.mockResolvedValue([
      { id: 'notification-1' },
      { id: 'notification-2' },
    ]);

    const result = await service.broadcastNotification({
      role: 'member',
      title: 'Announcement',
      body: 'Gym closes early today',
    });

    expect(repo.findUsers).toHaveBeenCalledWith({ role: 'member' });
    expect(repo.createBulkNotifications).toHaveBeenCalledWith(
      ['user-1', 'user-2'],
      expect.objectContaining({
        type: NOTIFICATION_TYPE.ANNOUNCEMENT,
        title: 'Announcement',
      })
    );
    expect(result).toMatchObject({
      audience_count: 2,
      created_count: 2,
    });
  });

  it('broadcasts a notification from a template', async () => {
    repo.findUsers.mockResolvedValue([{ id: 'user-1' }]);
    repo.createBulkNotifications.mockResolvedValue([{ id: 'notification-1' }]);

    const result = await service.broadcastFromTemplate(
      NOTIFICATION_TEMPLATE.OCCUPANCY_ALERT,
      {
        branch_name: 'Central Branch',
        occupancy_rate: 100,
        current_occupancy: 20,
        capacity: 20,
        reason: 'full',
      },
      { role: 'member' }
    );

    expect(repo.findUsers).toHaveBeenCalledWith({ role: 'member' });
    expect(repo.createBulkNotifications).toHaveBeenCalledWith(
      ['user-1'],
      expect.objectContaining({
        type: NOTIFICATION_TYPE.OCCUPANCY_ALERT,
        title: 'Central Branch is crowded',
      })
    );
    expect(result.created_count).toBe(1);
  });

  it('sends membership expiry warnings while skipping recent duplicates', async () => {
    repo.findMembershipsExpiringSoon.mockResolvedValue([
      {
        membership_id: 'membership-1',
        user_id: 'user-1',
        days_remaining: 3,
        plan_name: 'Monthly',
      },
      {
        membership_id: 'membership-2',
        user_id: 'user-2',
        days_remaining: 5,
        plan_name: 'Premium',
      },
    ]);
    repo.findRecentByType
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'recent-1' });
    repo.findUserById.mockResolvedValue(user);
    repo.createNotification.mockImplementation(async (payload) => ({
      ...notification,
      ...payload,
      id: 'created-expiry',
    }));

    const result = await service.sendMembershipExpiryWarnings(7);

    expect(repo.findMembershipsExpiringSoon).toHaveBeenCalledWith(7);
    expect(repo.findRecentByType).toHaveBeenCalledWith(
      'user-1',
      NOTIFICATION_TYPE.MEMBERSHIP_EXPIRY,
      expect.any(Date)
    );
    expect(repo.createNotification).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      scanned_count: 2,
      created_count: 1,
      skipped_count: 1,
    });
  });

  it('sends streak risk warnings', async () => {
    repo.resetStreaksPastThreshold.mockResolvedValue([{ user_id: 'reset-1' }]);
    repo.findStreaksAtRisk.mockResolvedValue([
      {
        user_id: 'user-1',
        last_active_date: '2026-07-01',
        current_streak: 4,
      },
    ]);
    repo.findRecentByType.mockResolvedValue(null);
    repo.findUserById.mockResolvedValue(user);
    repo.createNotification.mockImplementation(async (payload) => ({
      ...notification,
      ...payload,
      id: 'created-streak',
    }));

    const result = await service.sendStreakRiskWarnings();

    expect(repo.resetStreaksPastThreshold).toHaveBeenCalledWith(
      NOTIFICATION_SCHEDULER.STREAK_RESET_THRESHOLD_DAYS
    );
    expect(repo.findStreaksAtRisk).toHaveBeenCalledWith(1);
    expect(repo.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: NOTIFICATION_TYPE.STREAK_WARNING,
      })
    );
    expect(result.reset_count).toBe(1);
    expect(result.created_count).toBe(1);
  });

  it('cleans up old read notifications and runs selected jobs', async () => {
    repo.deleteOldReadNotifications.mockResolvedValue(6);

    const cleanup = await service.cleanupOldReadNotifications(30);
    const jobs = await service.runNotificationJobs({
      job: 'cleanup',
      retention_days: 30,
    });

    expect(cleanup.deleted_count).toBe(6);
    expect(repo.deleteOldReadNotifications).toHaveBeenCalledWith(expect.any(Date));
    expect(jobs.cleanup.deleted_count).toBe(6);
  });

  it('runs scheduler jobs by delegating to notification services', async () => {
    const membershipSpy = jest
      .spyOn(service, 'sendMembershipExpiryWarnings')
      .mockResolvedValue({ created_count: 1 });
    const streakSpy = jest
      .spyOn(service, 'sendStreakRiskWarnings')
      .mockResolvedValue({ created_count: 2 });
    const cleanupSpy = jest
      .spyOn(service, 'cleanupOldReadNotifications')
      .mockResolvedValue({ deleted_count: 3 });

    await scheduler.membershipExpiryJob();
    await scheduler.streakRiskJob();
    await scheduler.cleanupJob();

    expect(membershipSpy).toHaveBeenCalled();
    expect(streakSpy).toHaveBeenCalled();
    expect(cleanupSpy).toHaveBeenCalled();
  });

  it('starts and stops the scheduler without jobs when all options are disabled', () => {
    const started = scheduler.startNotificationScheduler({
      membershipExpiry: false,
      streakRisk: false,
      cleanup: false,
    });

    expect(started.state.started).toBe(true);
    expect(started.state.handles).toHaveLength(0);

    scheduler.stopNotificationScheduler();
  });
});
