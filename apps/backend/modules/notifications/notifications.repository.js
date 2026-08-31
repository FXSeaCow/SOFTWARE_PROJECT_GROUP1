/**
 * notifications.repository.js
 * Raw PostgreSQL queries for the notifications schema in gym.sql.
 *
 * Database columns:
 *   id, user_id, announcement_id, type, title, body, is_read, sent_at, read_at
 *
 * This layer contains no business logic. Services decide what should be sent;
 * the repository only reads and writes rows.
 */

const db = require('../../config/db');

/**
 * Shared SELECT projection for notification rows.
 *
 * @param {string} alias
 * @returns {string}
 */
const notificationSelect = (alias = 'n') => `
  ${alias}.id,
  ${alias}.user_id,
  ${alias}.announcement_id,
  ${alias}.type,
  ${alias}.title,
  ${alias}.body,
  ${alias}.is_read,
  ${alias}.sent_at,
  ${alias}.read_at
`;

/**
 * Find a user by ID.
 *
 * @param {string} userId
 * @returns {Promise<object|null>}
 */
const findUserById = async (userId) => {
  const { rows } = await db.query(
    `SELECT id, email, full_name, role
     FROM users
     WHERE id = $1`,
    [userId]
  );
  return rows[0] || null;
};

/**
 * Find users for broadcast delivery.
 *
 * @param {{ role?: string }} filters
 * @returns {Promise<object[]>}
 */
const findUsers = async ({ role } = {}) => {
  const values = [];
  const where = role ? 'WHERE role = $1' : '';
  if (role) values.push(role);

  const { rows } = await db.query(
    `SELECT id, email, full_name, role
     FROM users
     ${where}
     ORDER BY created_at DESC`,
    values
  );
  return rows;
};

/**
 * Create one notification.
 *
 * @param {{ user_id, type, title, body, announcement_id? }} data
 * @param {import('pg').PoolClient} [client]
 * @returns {Promise<object>}
 */
const createNotification = async ({
  user_id,
  type,
  title,
  body,
  announcement_id,
}, client) => {
  const runner = client || db;
  const { rows } = await runner.query(
    `INSERT INTO notifications (user_id, announcement_id, type, title, body)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${notificationSelect('notifications')}`,
    [user_id, announcement_id || null, type, title, body || null]
  );
  return rows[0];
};

/**
 * Create notifications for many users.
 *
 * @param {string[]} userIds
 * @param {{ type, title, body, announcement_id? }} data
 * @returns {Promise<object[]>}
 */
const createBulkNotifications = async (userIds, data) => {
  const created = [];

  for (const userId of userIds) {
    created.push(
      await createNotification({
        user_id: userId,
        type: data.type,
        title: data.title,
        body: data.body,
        announcement_id: data.announcement_id || null,
      })
    );
  }

  return created;
};

/**
 * Find a notification by ID and owner.
 *
 * @param {string} notificationId
 * @param {string} userId
 * @returns {Promise<object|null>}
 */
const findByIdAndUser = async (notificationId, userId) => {
  const { rows } = await db.query(
    `SELECT ${notificationSelect('n')}
     FROM notifications n
     WHERE n.id = $1
       AND n.user_id = $2`,
    [notificationId, userId]
  );
  return rows[0] || null;
};

/**
 * Admin: find any notification by ID.
 *
 * @param {string} notificationId
 * @returns {Promise<object|null>}
 */
const findById = async (notificationId) => {
  const { rows } = await db.query(
    `SELECT ${notificationSelect('n')},
            u.full_name AS user_name,
            u.email AS user_email
     FROM notifications n
     JOIN users u ON u.id = n.user_id
     WHERE n.id = $1`,
    [notificationId]
  );
  return rows[0] || null;
};

/**
 * Build dynamic filters for notification lists.
 *
 * @param {{ user_id?: string, type?: string, is_read?: boolean }} filters
 * @returns {{ where: string, values: Array, nextIndex: number }}
 */
const buildNotificationFilters = (filters = {}) => {
  const conditions = [];
  const values = [];
  let idx = 1;

  if (filters.user_id) {
    conditions.push(`n.user_id = $${idx++}`);
    values.push(filters.user_id);
  }

  if (filters.type) {
    conditions.push(`n.type = $${idx++}`);
    values.push(filters.type);
  }

  if (filters.is_read !== undefined) {
    conditions.push(`n.is_read = $${idx++}`);
    values.push(filters.is_read);
  }

  return {
    where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    values,
    nextIndex: idx,
  };
};

/**
 * List notifications with optional filters and pagination.
 *
 * @param {{ user_id?: string, type?: string, is_read?: boolean, limit: number, offset: number }} opts
 * @returns {Promise<{ rows: object[], total: number }>}
 */
const findAll = async (opts) => {
  const { where, values, nextIndex } = buildNotificationFilters(opts);

  const countResult = await db.query(
    `SELECT COUNT(*)::INT AS total
     FROM notifications n
     ${where}`,
    values
  );

  const { rows } = await db.query(
    `SELECT ${notificationSelect('n')},
            u.full_name AS user_name,
            u.email AS user_email
     FROM notifications n
     JOIN users u ON u.id = n.user_id
     ${where}
     ORDER BY n.sent_at DESC
     LIMIT $${nextIndex} OFFSET $${nextIndex + 1}`,
    [...values, opts.limit, opts.offset]
  );

  return {
    rows,
    total: countResult.rows[0].total,
  };
};

/**
 * Count unread notifications for a user.
 *
 * @param {string} userId
 * @returns {Promise<number>}
 */
const countUnreadByUser = async (userId) => {
  const { rows } = await db.query(
    `SELECT COUNT(*)::INT AS total
     FROM notifications
     WHERE user_id = $1
       AND is_read = false`,
    [userId]
  );
  return rows[0].total;
};

/**
 * Mark one notification as read.
 *
 * @param {string} notificationId
 * @returns {Promise<object|null>}
 */
const markAsRead = async (notificationId) => {
  const { rows } = await db.query(
    `UPDATE notifications
     SET is_read = true,
         read_at = COALESCE(read_at, now())
     WHERE id = $1
     RETURNING ${notificationSelect('notifications')}`,
    [notificationId]
  );
  return rows[0] || null;
};

/**
 * Mark all unread notifications for a user as read.
 *
 * @param {string} userId
 * @returns {Promise<number>}
 */
const markAllAsRead = async (userId) => {
  const { rowCount } = await db.query(
    `UPDATE notifications
     SET is_read = true,
         read_at = COALESCE(read_at, now())
     WHERE user_id = $1
       AND is_read = false`,
    [userId]
  );
  return rowCount;
};

/**
 * Delete a notification owned by a user.
 *
 * @param {string} notificationId
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
const deleteByIdAndUser = async (notificationId, userId) => {
  const { rowCount } = await db.query(
    `DELETE FROM notifications
     WHERE id = $1
       AND user_id = $2`,
    [notificationId, userId]
  );
  return rowCount > 0;
};

/**
 * Admin: delete any notification.
 *
 * @param {string} notificationId
 * @returns {Promise<boolean>}
 */
const deleteById = async (notificationId) => {
  const { rowCount } = await db.query(
    `DELETE FROM notifications WHERE id = $1`,
    [notificationId]
  );
  return rowCount > 0;
};

/**
 * Find one recent notification of a type for duplicate prevention.
 *
 * @param {string} userId
 * @param {string} type
 * @param {Date} since
 * @returns {Promise<object|null>}
 */
const findRecentByType = async (userId, type, since) => {
  const { rows } = await db.query(
    `SELECT ${notificationSelect('n')}
     FROM notifications n
     WHERE n.user_id = $1
       AND n.type = $2
       AND n.sent_at >= $3
     ORDER BY n.sent_at DESC
     LIMIT 1`,
    [userId, type, since]
  );
  return rows[0] || null;
};

/**
 * Find active memberships expiring within the warning window.
 *
 * @param {number} warningDays
 * @returns {Promise<object[]>}
 */
const findMembershipsExpiringSoon = async (warningDays) => {
  const { rows } = await db.query(
    `SELECT m.id AS membership_id,
            m.user_id,
            m.end_date,
            (m.end_date - CURRENT_DATE)::INT AS days_remaining,
            u.full_name,
            u.email,
            mp.name AS plan_name
     FROM memberships m
     JOIN users u ON u.id = m.user_id
     JOIN membership_plans mp ON mp.id = m.plan_id
     WHERE m.status = 'active'
       AND m.end_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + $1::INT)
     ORDER BY m.end_date ASC`,
    [warningDays]
  );
  return rows;
};

/**
 * Find workout streaks that are at risk today.
 *
 * @param {string} targetDate - YYYY-MM-DD local schedule date.
 * @returns {Promise<object[]>}
 */
const findStreaksAtRisk = async (warningAfterDays = 1, targetDate) => {
  const { rows } = await db.query(
    `SELECT ws.user_id,
            ws.last_active_date::TEXT AS last_active_date,
            ws.current_streak,
            u.full_name,
            u.email
     FROM workout_streaks ws
     JOIN users u ON u.id = ws.user_id
     WHERE ws.current_streak > 0
       AND ws.last_active_date = ($2::date - $1::INT)::date`,
    [warningAfterDays, targetDate]
  );
  return rows;
};

/**
 * Find members who should receive today's workout reminder.
 *
 * A member qualifies only when they have an active membership and an active
 * workout plan selected for today's scheduled exercise day, but no workout
 * check-in yet today. The active workout plan is the user's selected plan.
 *
 * @param {string} targetDate - YYYY-MM-DD local schedule date.
 * @returns {Promise<object[]>}
 */
const findWorkoutReminderRecipients = async (targetDate) => {
  const { rows } = await db.query(
    `WITH target_day AS (
       SELECT $1::date AS reminder_date,
              EXTRACT(ISODOW FROM $1::date)::INT AS day_of_week
     )
     SELECT DISTINCT ON (u.id)
            u.id AS user_id,
            u.full_name,
            u.email,
            wp.id AS workout_plan_id,
            wp.title AS workout_plan_title,
            wd.id AS workout_day_id,
            wd.day_label,
            wd.day_of_week
     FROM users u
     CROSS JOIN target_day td
     JOIN workout_plans wp
       ON wp.user_id = u.id
      AND wp.is_active = true
     JOIN workout_days wd
       ON wd.workout_plan_id = wp.id
      AND wd.day_of_week = td.day_of_week
     WHERE u.role = 'member'
       AND COALESCE(u.account_status, 'active') = 'active'
       AND EXISTS (
         SELECT 1
         FROM workout_day_exercises wde
         WHERE wde.workout_day_id = wd.id
       )
       AND EXISTS (
         SELECT 1
         FROM memberships m
         WHERE m.user_id = u.id
           AND m.status = 'active'
           AND m.start_date <= td.reminder_date
           AND m.end_date >= td.reminder_date
       )
       AND NOT EXISTS (
         SELECT 1
         FROM workout_checkins wc
         WHERE wc.user_id = u.id
           AND wc.checkin_date = td.reminder_date
       )
     ORDER BY u.id, wp.updated_at DESC, wp.created_at DESC`,
    [targetDate]
  );

  return rows;
};

/**
 * Reset streaks that have been inactive past the configured threshold.
 *
 * @param {number} thresholdDays
 * @param {string} targetDate - YYYY-MM-DD local scheduler date.
 * @returns {Promise<object[]>}
 */
const resetStreaksPastThreshold = async (thresholdDays, targetDate) => {
  const { rows } = await db.query(
    `UPDATE workout_streaks
     SET current_streak = 0,
         updated_at = now()
     WHERE current_streak > 0
       AND last_active_date IS NOT NULL
       AND last_active_date < ($2::date - $1::INT)::date
     RETURNING user_id,
               current_streak::INT AS current_streak,
               longest_streak::INT AS longest_streak,
               last_active_date::TEXT AS last_active_date`,
    [thresholdDays, targetDate]
  );
  return rows;
};

/**
 * Delete read notifications older than the cutoff date.
 *
 * @param {Date} cutoffDate
 * @returns {Promise<number>}
 */
const deleteOldReadNotifications = async (cutoffDate) => {
  const { rowCount } = await db.query(
    `DELETE FROM notifications
     WHERE is_read = true
       AND sent_at < $1`,
    [cutoffDate]
  );
  return rowCount;
};

module.exports = {
  findUserById,
  findUsers,
  createNotification,
  createBulkNotifications,
  findByIdAndUser,
  findById,
  findAll,
  countUnreadByUser,
  markAsRead,
  markAllAsRead,
  deleteByIdAndUser,
  deleteById,
  findRecentByType,
  findMembershipsExpiringSoon,
  findStreaksAtRisk,
  findWorkoutReminderRecipients,
  resetStreaksPastThreshold,
  deleteOldReadNotifications,
};
