/**
 * announcements.test.js
 * Unit tests for the announcements module.
 *
 * The repository and transaction helper are mocked so announcement business
 * rules can be verified without requiring announcement rows in PostgreSQL.
 */

jest.mock('../announcements.repository', () => ({
  listAnnouncementHistory: jest.fn(),
  findRecipientUsers: jest.fn(),
  findAllRecipientUsers: jest.fn(),
  createAnnouncement: jest.fn(),
  createNotifications: jest.fn(),
}));

jest.mock('../../../utils/Transaction', () => ({
  withTransaction: jest.fn(async (callback) => callback({ tx: true })),
}));

jest.mock('../../../utils/Logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const repo = require('../announcements.repository');
const logger = require('../../../utils/Logger');
const { withTransaction } = require('../../../utils/Transaction');
const service = require('../announcements.service');
const routes = require('../announcements.routes');
const { createAnnouncementSchema } = require('../announcements.validation');

const adminUser = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'admin@example.com',
  full_name: 'Admin User',
  role: 'admin',
};

const memberOne = {
  id: '22222222-2222-4222-8222-222222222222',
  email: 'member1@example.com',
  full_name: 'Member One',
  role: 'member',
  account_status: 'active',
};

const memberTwo = {
  id: '33333333-3333-4333-8333-333333333333',
  email: 'member2@example.com',
  full_name: 'Member Two',
  role: 'member',
  account_status: 'active',
};

const lockedMember = {
  id: '44444444-4444-4444-8444-444444444444',
  email: 'locked@example.com',
  full_name: 'Locked Member',
  role: 'member',
  account_status: 'locked',
};

const makePayload = (overrides = {}) => ({
  title: 'Holiday schedule',
  body: 'The gym will close earlier than usual this Friday.',
  type: 'announcement',
  send_to: 'all',
  user_ids: [],
  ...overrides,
});

const makeAnnouncement = (overrides = {}) => ({
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  created_by: adminUser.id,
  title: 'Holiday schedule',
  body: 'The gym will close earlier than usual this Friday.',
  published_at: '2026-07-01T00:00:00.000Z',
  created_at: '2026-07-01T00:00:00.000Z',
  ...overrides,
});

describe('announcements module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads the Express router', () => {
    expect(routes).toBeDefined();
  });

  it('validates announcement payload defaults and selected recipients', () => {
    const allRecipients = createAnnouncementSchema.validate({
      title: '  Holiday schedule  ',
      body: '  The gym will close earlier than usual this Friday.  ',
      send_to: 'all',
    });
    const missingSelectedUsers = createAnnouncementSchema.validate({
      title: 'Holiday schedule',
      body: 'The gym will close earlier than usual this Friday.',
      send_to: 'selected',
    });
    const invalidAllRecipients = createAnnouncementSchema.validate({
      title: 'Holiday schedule',
      body: 'The gym will close earlier than usual this Friday.',
      send_to: 'all',
      user_ids: [memberOne.id],
    });

    expect(allRecipients.error).toBeUndefined();
    expect(allRecipients.value).toMatchObject({
      title: 'Holiday schedule',
      type: 'announcement',
      send_to: 'all',
      user_ids: [],
    });
    expect(missingSelectedUsers.error).toBeDefined();
    expect(
      missingSelectedUsers.error.details.some((detail) =>
        detail.path.includes('user_ids')
      )
    ).toBe(true);
    expect(invalidAllRecipients.error).toBeDefined();
  });

  it('delegates announcement history listing to the repository', async () => {
    const history = [
      {
        id: 'announcement-1',
        title: 'Holiday schedule',
        recipient_count: 2,
        read_count: 1,
      },
    ];
    repo.listAnnouncementHistory.mockResolvedValue(history);

    const result = await service.listAnnouncementHistory();

    expect(repo.listAnnouncementHistory).toHaveBeenCalledTimes(1);
    expect(result).toBe(history);
  });

  it('creates an announcement for all active recipients in one transaction', async () => {
    const recipients = [memberOne, memberTwo];
    const announcement = makeAnnouncement();
    const notifications = [
      { id: 'notification-1', user_id: memberOne.id },
      { id: 'notification-2', user_id: memberTwo.id },
    ];

    repo.findAllRecipientUsers.mockResolvedValue(recipients);
    repo.createAnnouncement.mockResolvedValue(announcement);
    repo.createNotifications.mockResolvedValue(notifications);

    const result = await service.createAnnouncement(adminUser, makePayload());

    expect(withTransaction).toHaveBeenCalledTimes(1);
    expect(repo.findAllRecipientUsers).toHaveBeenCalledWith({ tx: true });
    expect(repo.findRecipientUsers).not.toHaveBeenCalled();
    expect(repo.createAnnouncement).toHaveBeenCalledWith(
      expect.objectContaining({
        createdBy: adminUser.id,
        title: 'Holiday schedule',
        body: 'The gym will close earlier than usual this Friday.',
        publishedAt: expect.any(String),
      }),
      { tx: true }
    );
    expect(repo.createNotifications).toHaveBeenCalledWith(
      {
        announcementId: announcement.id,
        recipients,
        title: 'Holiday schedule',
        body: 'The gym will close earlier than usual this Friday.',
        type: 'announcement',
      },
      { tx: true }
    );
    expect(logger.info).toHaveBeenCalledWith('Announcement created', {
      announcementId: announcement.id,
      createdBy: adminUser.id,
      recipients: 2,
      sendTo: 'all',
    });
    expect(result).toMatchObject({
      id: announcement.id,
      recipient_count: 2,
      recipients: [
        {
          id: memberOne.id,
          email: memberOne.email,
          full_name: memberOne.full_name,
        },
        {
          id: memberTwo.id,
          email: memberTwo.email,
          full_name: memberTwo.full_name,
        },
      ],
    });
    expect(result.recipients[0].account_status).toBeUndefined();
  });

  it('creates an announcement for selected active recipients', async () => {
    const recipients = [memberOne, memberTwo];
    const announcement = makeAnnouncement({
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      title: 'Class update',
    });
    repo.findRecipientUsers.mockResolvedValue(recipients);
    repo.createAnnouncement.mockResolvedValue(announcement);
    repo.createNotifications.mockResolvedValue([
      { id: 'notification-1', user_id: memberOne.id },
      { id: 'notification-2', user_id: memberTwo.id },
    ]);

    const payload = makePayload({
      title: 'Class update',
      type: 'schedule',
      send_to: 'selected',
      user_ids: [memberOne.id, memberTwo.id],
    });

    const result = await service.createAnnouncement(adminUser, payload);

    expect(repo.findRecipientUsers).toHaveBeenCalledWith(
      [memberOne.id, memberTwo.id],
      { tx: true }
    );
    expect(repo.findAllRecipientUsers).not.toHaveBeenCalled();
    expect(repo.createNotifications).toHaveBeenCalledWith(
      expect.objectContaining({
        announcementId: announcement.id,
        recipients,
        title: 'Class update',
        type: 'schedule',
      }),
      { tx: true }
    );
    expect(result.recipient_count).toBe(2);
  });

  it('rejects announcements when no active recipients are found', async () => {
    repo.findAllRecipientUsers.mockResolvedValue([]);

    await expect(
      service.createAnnouncement(adminUser, makePayload())
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'No active recipients found for this announcement',
    });

    expect(repo.createAnnouncement).not.toHaveBeenCalled();
    expect(repo.createNotifications).not.toHaveBeenCalled();
  });

  it('rejects selected announcements when any selected user is missing', async () => {
    repo.findRecipientUsers.mockResolvedValue([memberOne]);

    await expect(
      service.createAnnouncement(
        adminUser,
        makePayload({
          send_to: 'selected',
          user_ids: [memberOne.id, memberTwo.id],
        })
      )
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'One or more selected users were not found',
    });

    expect(repo.createAnnouncement).not.toHaveBeenCalled();
    expect(repo.createNotifications).not.toHaveBeenCalled();
  });

  it('rejects selected announcements for locked accounts', async () => {
    repo.findRecipientUsers.mockResolvedValue([lockedMember]);

    await expect(
      service.createAnnouncement(
        adminUser,
        makePayload({
          send_to: 'selected',
          user_ids: [lockedMember.id],
        })
      )
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'Selected recipients must have active accounts',
    });

    expect(repo.createAnnouncement).not.toHaveBeenCalled();
    expect(repo.createNotifications).not.toHaveBeenCalled();
  });
});
