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
  findRecipientUsers,
  findAllRecipientUsers,
  createAnnouncement,
  createNotifications,
};
