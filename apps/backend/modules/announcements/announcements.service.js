const repo = require('./announcements.repository');
const logger = require('../../utils/Logger');
const ApiError = require('../../utils/Apierror');
const { withTransaction } = require('../../utils/Transaction');

const listAnnouncementHistory = async () => {
  return repo.listAnnouncementHistory();
};

const createAnnouncement = async (adminUser, payload) => {
  const publishedAt = new Date().toISOString();

  return withTransaction(async (client) => {
    const recipients =
      payload.send_to === 'all'
        ? await repo.findAllRecipientUsers(client)
        : await repo.findRecipientUsers(payload.user_ids, client);

    if (recipients.length === 0) {
      throw ApiError.badRequest('No active recipients found for this announcement');
    }

    if (payload.send_to === 'selected' && recipients.length !== payload.user_ids.length) {
      throw ApiError.badRequest('One or more selected users were not found');
    }

    const lockedRecipients = recipients.filter((recipient) => recipient.account_status !== 'active');
    if (lockedRecipients.length > 0) {
      throw ApiError.badRequest('Selected recipients must have active accounts');
    }

    const announcement = await repo.createAnnouncement(
      {
        createdBy: adminUser.id,
        title: payload.title,
        body: payload.body,
        publishedAt,
        sendTo: payload.send_to,
      },
      client
    );

    const notifications = await repo.createNotifications(
      {
        announcementId: announcement.id,
        recipients,
        title: payload.title,
        body: payload.body,
        type: payload.type,
      },
      client
    );

    logger.info('Announcement created', {
      announcementId: announcement.id,
      createdBy: adminUser.id,
      recipients: notifications.length,
      sendTo: payload.send_to,
    });

    return {
      ...announcement,
      recipient_count: notifications.length,
      recipients: recipients.map((recipient) => ({
        id: recipient.id,
        email: recipient.email,
        full_name: recipient.full_name,
      })),
    };
  });
};

module.exports = {
  listAnnouncementHistory,
  createAnnouncement,
};
