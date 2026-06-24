const db = require('../../config/db');

const listAnnouncementHistory = async () => {
  const { rows } = await db.query(
    `SELECT
       a.id,
       a.title,
       a.body,
       a.published_at,
       a.created_at,
       a.created_by,
       COALESCE(u.full_name, u.email, 'Unknown admin') AS created_by_name,
       COUNT(n.id)::int AS recipient_count,
       COUNT(*) FILTER (WHERE n.is_read = true)::int AS read_count
     FROM announcements a
     LEFT JOIN users u ON u.id = a.created_by
     LEFT JOIN notifications n ON n.announcement_id = a.id
     GROUP BY a.id, u.full_name, u.email
     ORDER BY a.published_at DESC, a.created_at DESC`
  );

  return rows;
};

const listUserNotifications = async (userId) => {
  const { rows } = await db.query(
    `SELECT
       n.id,
       n.user_id,
       n.announcement_id,
       n.type,
       n.title,
       n.body,
       n.is_read,
       n.sent_at,
       n.read_at,
       a.published_at,
       COALESCE(u.full_name, u.email, 'System') AS created_by_name
     FROM notifications n
     LEFT JOIN announcements a ON a.id = n.announcement_id
     LEFT JOIN users u ON u.id = a.created_by
     WHERE n.user_id = $1
     ORDER BY n.sent_at DESC
     LIMIT 20`,
    [userId]
  );

  return rows;
};

const markNotificationAsRead = async (notificationId, userId) => {
  const { rows } = await db.query(
    `UPDATE notifications
     SET is_read = true,
         read_at = COALESCE(read_at, now())
     WHERE id = $1 AND user_id = $2
     RETURNING id, user_id, announcement_id, type, title, body, is_read, sent_at, read_at`,
    [notificationId, userId]
  );

  return rows[0] || null;
};

const markAllNotificationsAsRead = async (userId) => {
  const { rowCount } = await db.query(
    `UPDATE notifications
     SET is_read = true,
         read_at = COALESCE(read_at, now())
     WHERE user_id = $1 AND is_read = false`,
    [userId]
  );

  return rowCount;
};

const findRecipientUsers = async (userIds, client) => {
  const runner = client || db;
  const { rows } = await runner.query(
    `SELECT id, email, full_name, role, account_status
     FROM users
     WHERE id = ANY($1::uuid[])
     ORDER BY full_name ASC, email ASC`,
    [userIds]
  );

  return rows;
};

const findAllRecipientUsers = async (client) => {
  const runner = client || db;
  const { rows } = await runner.query(
    `SELECT id, email, full_name, role, account_status
     FROM users
     WHERE account_status = 'active'
     ORDER BY full_name ASC, email ASC`
  );

  return rows;
};

const createAnnouncement = async ({ createdBy, title, body, publishedAt }, client) => {
  const runner = client || db;
  const { rows } = await runner.query(
    `INSERT INTO announcements (created_by, title, body, published_at)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [createdBy, title, body, publishedAt]
  );

  return rows[0];
};

const createNotifications = async ({ announcementId, recipients, title, body, type }, client) => {
  const runner = client || db;

  if (recipients.length === 0) {
    return [];
  }

  const placeholders = recipients.map((_, index) => {
    const base = index * 5;
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`;
  });

  const values = recipients.flatMap((recipient) => [
    recipient.id,
    announcementId,
    type,
    title,
    body,
  ]);

  const { rows } = await runner.query(
    `INSERT INTO notifications (user_id, announcement_id, type, title, body)
     VALUES ${placeholders.join(', ')}
     RETURNING id, user_id, announcement_id, type, title, body, is_read, sent_at, read_at`,
    values
  );

  return rows;
};

module.exports = {
  listAnnouncementHistory,
  listUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  findRecipientUsers,
  findAllRecipientUsers,
  createAnnouncement,
  createNotifications,
};
