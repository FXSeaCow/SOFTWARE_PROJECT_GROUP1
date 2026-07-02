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
  NOTIFICATION_PRIORITY,
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
 * Template definitions.
 *
 * Each template returns a normalized notification payload.
 */
const TEMPLATES = {
  [NOTIFICATION_TEMPLATE.MEMBERSHIP_EXPIRING]: (context = {}) => ({
    type: NOTIFICATION_TYPE.MEMBERSHIP_EXPIRING,
    priority: NOTIFICATION_PRIORITY.HIGH,
    title: 'Membership expiring soon',
    message: `Your membership expires in ${value(context, 'days_remaining', '?')} day(s). Please renew to keep training without interruption.`,
  }),

  [NOTIFICATION_TEMPLATE.MEMBERSHIP_EXPIRED]: () => ({
    type: NOTIFICATION_TYPE.MEMBERSHIP_EXPIRED,
    priority: NOTIFICATION_PRIORITY.HIGH,
    title: 'Membership expired',
    message: 'Your membership has expired. Renew your plan to continue using member features.',
  }),

  [NOTIFICATION_TEMPLATE.STREAK_AT_RISK]: (context = {}) => ({
    type: NOTIFICATION_TYPE.STREAK_AT_RISK,
    priority: NOTIFICATION_PRIORITY.NORMAL,
    title: 'Your workout streak needs attention',
    message: `Your last workout check-in was on ${value(context, 'last_active_date', 'yesterday')}. Check in today to keep the streak alive.`,
  }),

  [NOTIFICATION_TEMPLATE.GYM_CAPACITY_ALERT]: (context = {}) => ({
    type: NOTIFICATION_TYPE.GYM_CAPACITY_ALERT,
    priority: NOTIFICATION_PRIORITY.URGENT,
    title: 'Gym capacity alert',
    message: `Gym occupancy is currently ${value(context, 'occupancy_rate', '?')}%. Capacity is getting tight.`,
  }),

  [NOTIFICATION_TEMPLATE.PAYMENT_CONFIRMED]: (context = {}) => ({
    type: NOTIFICATION_TYPE.PAYMENT_CONFIRMED,
    priority: NOTIFICATION_PRIORITY.NORMAL,
    title: 'Payment confirmed',
    message: `Your payment for ${value(context, 'plan_name', 'your membership')} has been confirmed.`,
  }),

  [NOTIFICATION_TEMPLATE.PAYMENT_REJECTED]: (context = {}) => ({
    type: NOTIFICATION_TYPE.PAYMENT_REJECTED,
    priority: NOTIFICATION_PRIORITY.HIGH,
    title: 'Payment rejected',
    message: `Your payment could not be confirmed. Reason: ${value(context, 'reason', 'not provided')}.`,
  }),

  [NOTIFICATION_TEMPLATE.WORKOUT_REMINDER]: (context = {}) => ({
    type: NOTIFICATION_TYPE.WORKOUT_REMINDER,
    priority: NOTIFICATION_PRIORITY.LOW,
    title: 'Workout reminder',
    message: value(context, 'message', 'Remember to complete your workout today.'),
  }),

  [NOTIFICATION_TEMPLATE.ANNOUNCEMENT]: (context = {}) => ({
    type: NOTIFICATION_TYPE.ANNOUNCEMENT,
    priority: value(context, 'priority', NOTIFICATION_PRIORITY.NORMAL),
    title: value(context, 'title', 'Announcement'),
    message: value(context, 'message', 'Please check the latest gym announcement.'),
  }),
};

/**
 * Render a template by key.
 *
 * @param {string} templateKey
 * @param {object} context
 * @returns {{ type: string, priority: string, title: string, message: string }}
 */
const renderTemplate = (templateKey, context = {}) => {
  const renderer = TEMPLATES[templateKey];

  if (!renderer) {
    return {
      type: NOTIFICATION_TYPE.SYSTEM,
      priority: NOTIFICATION_PRIORITY.NORMAL,
      title: value(context, 'title', 'Notification'),
      message: value(context, 'message', 'You have a new notification.'),
    };
  }

  return renderer(context);
};

module.exports = {
  TEMPLATES,
  renderTemplate,
};
