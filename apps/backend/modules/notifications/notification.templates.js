/**
 * notification.templates.js
 * Template rendering helpers for notification titles and messages.
 *
 * Keeping templates outside the service prevents notifications.service.js from
 * becoming a pile of string concatenation as new notification types are added.
 */

const {
  NOTIFICATION_TEMPLATE,
  NOTIFICATION_TYPE,
  NOTIFICATION_SEVERITY,
} = require('./notifications.constants');

/**
 * Safely read a value from template context.
 *
 * @param {object} context
 * @param {string} key
 * @param {string|number} fallback
 * @returns {string|number}
 */
const value = (context, key, fallback = '') =>
  context && context[key] !== undefined && context[key] !== null
    ? context[key]
    : fallback;

/**
 * Build user-facing guidance for an occupancy alert.
 *
 * @param {object} context
 * @returns {string}
 */
const occupancyAdvice = (context = {}) =>
  value(context, 'reason', 'crowded') === 'full'
    ? 'It has reached full capacity. Please choose another branch or visit later.'
    : 'It is above the crowding threshold. You may want to choose another branch or visit later.';

/**
 * Template definitions.
 *
 * Each template returns a normalized notification payload.
 */
const TEMPLATES = {
  [NOTIFICATION_TEMPLATE.MEMBERSHIP_EXPIRY]: (context = {}) => ({
    type: NOTIFICATION_TYPE.MEMBERSHIP_EXPIRY,
    severity: NOTIFICATION_SEVERITY.WARNING,
    title: 'Membership expiring soon',
    body: `Your membership expires in ${value(context, 'days_remaining', '?')} day(s). Please renew to keep training without interruption.`,
  }),

  [NOTIFICATION_TEMPLATE.STREAK_WARNING]: (context = {}) => ({
    type: NOTIFICATION_TYPE.STREAK_WARNING,
    severity: NOTIFICATION_SEVERITY.WARNING,
    title: 'Your workout streak needs attention',
    body: `Your last workout check-in was on ${value(context, 'last_active_date', 'yesterday')}. Check in today to keep the streak alive.`,
  }),

  [NOTIFICATION_TEMPLATE.OCCUPANCY_ALERT]: (context = {}) => ({
    type: NOTIFICATION_TYPE.OCCUPANCY_ALERT,
    severity: NOTIFICATION_SEVERITY.DANGER,
    title: `${value(context, 'branch_name', 'This branch')} is crowded`,
    body: `${value(context, 'branch_name', 'This branch')} is currently at ${value(context, 'occupancy_rate', '?')}% capacity (${value(context, 'current_occupancy', '?')}/${value(context, 'capacity', '?')}). ${occupancyAdvice(context)}`,
  }),

  [NOTIFICATION_TEMPLATE.WORKOUT_REMINDER]: (context = {}) => ({
    type: NOTIFICATION_TYPE.WORKOUT_REMINDER,
    severity: NOTIFICATION_SEVERITY.INFO,
    title: 'Workout reminder',
    body: value(context, 'body', "Don't forget your workout today! Keep your streak going."),
  }),

  [NOTIFICATION_TEMPLATE.ANNOUNCEMENT]: (context = {}) => ({
    type: NOTIFICATION_TYPE.ANNOUNCEMENT,
    severity: value(context, 'severity', NOTIFICATION_SEVERITY.INFO),
    title: value(context, 'title', 'Announcement'),
    body: value(context, 'body', 'Please check the latest gym announcement.'),
  }),
};

/**
 * Render a template by key.
 *
 * @param {string} templateKey
 * @param {object} context
 * @returns {{ type: string, severity: string, title: string, body: string }}
 */
const renderTemplate = (templateKey, context = {}) => {
  const renderer = TEMPLATES[templateKey];

  if (!renderer) {
    return {
      type: NOTIFICATION_TYPE.ANNOUNCEMENT,
      severity: NOTIFICATION_SEVERITY.INFO,
      title: value(context, 'title', 'Notification'),
      body: value(context, 'body', 'You have a new notification.'),
    };
  }

  return renderer(context);
};

module.exports = {
  TEMPLATES,
  renderTemplate,
};
