/**
 * notifications.validation.js
 * Joi schemas for notification endpoints.
 *
 * The validate middleware strips unknown fields, so services receive a clean
 * and predictable request shape.
 */

const Joi = require('joi');
const {
  NOTIFICATION_TYPE,
  NOTIFICATION_TEMPLATE,
  NOTIFICATION_LIMITS,
} = require('./notifications.constants');

/**
 * Build a UUID params schema for route IDs.
 *
 * @param {string} name
 * @returns {import('joi').ObjectSchema}
 */
const uuidParam = (name) =>
  Joi.object({
    [name]: Joi.string().uuid().required().messages({
      'string.uuid': `${name} must be a valid UUID`,
      'any.required': `${name} is required`,
    }),
  });

/**
 * GET /api/notifications/me
 * Member notification list filters.
 */
const listMyNotificationsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(NOTIFICATION_LIMITS.DEFAULT_PAGE),
  limit: Joi.number()
    .integer()
    .min(1)
    .max(NOTIFICATION_LIMITS.MAX_LIMIT)
    .default(NOTIFICATION_LIMITS.DEFAULT_LIMIT),
  type: Joi.string().valid(...Object.values(NOTIFICATION_TYPE)).optional(),
  is_read: Joi.boolean().optional(),
});

/**
 * GET /api/notifications/admin
 * Admin list filters.
 */
const listAllNotificationsQuerySchema = listMyNotificationsQuerySchema.keys({
  user_id: Joi.string().uuid().optional().messages({
    'string.uuid': 'user_id must be a valid UUID',
  }),
});

/**
 * POST /api/notifications/admin
 * Admin creates a notification for one user.
 */
const createNotificationSchema = Joi.object({
  user_id: Joi.string().uuid().required().messages({
    'string.uuid': 'user_id must be a valid UUID',
    'any.required': 'user_id is required',
  }),
  type: Joi.string()
    .valid(...Object.values(NOTIFICATION_TYPE))
    .default(NOTIFICATION_TYPE.ANNOUNCEMENT),
  announcement_id: Joi.string().uuid().allow(null).optional().messages({
    'string.uuid': 'announcement_id must be a valid UUID',
  }),
  title: Joi.string().trim().min(2).max(200).required().messages({
    'any.required': 'title is required',
  }),
  body: Joi.string().trim().min(2).max(2000).allow(null).required().messages({
    'any.required': 'body is required',
  }),
});

/**
 * POST /api/notifications/admin/template
 * Admin creates a notification for one user using a template.
 */
const createFromTemplateSchema = Joi.object({
  user_id: Joi.string().uuid().required().messages({
    'string.uuid': 'user_id must be a valid UUID',
    'any.required': 'user_id is required',
  }),
  template: Joi.string()
    .valid(...Object.values(NOTIFICATION_TEMPLATE))
    .required()
    .messages({
      'any.required': 'template is required',
    }),
  context: Joi.object().unknown(true).default({}),
  announcement_id: Joi.string().uuid().allow(null).optional().messages({
    'string.uuid': 'announcement_id must be a valid UUID',
  }),
});

/**
 * POST /api/notifications/admin/broadcast
 * Admin sends the same notification to many users.
 */
const broadcastNotificationSchema = Joi.object({
  role: Joi.string().valid('member', 'admin').optional(),
  type: Joi.string()
    .valid(...Object.values(NOTIFICATION_TYPE))
    .default(NOTIFICATION_TYPE.ANNOUNCEMENT),
  announcement_id: Joi.string().uuid().allow(null).optional().messages({
    'string.uuid': 'announcement_id must be a valid UUID',
  }),
  title: Joi.string().trim().min(2).max(200).required().messages({
    'any.required': 'title is required',
  }),
  body: Joi.string().trim().min(2).max(2000).required().messages({
    'any.required': 'body is required',
  }),
});

/**
 * POST /api/notifications/admin/run-jobs
 * Admin manually runs scheduler-backed jobs.
 */
const runJobsSchema = Joi.object({
  job: Joi.string()
    .valid('membership_expiry', 'streak_risk', 'cleanup', 'all')
    .default('all'),
  retention_days: Joi.number()
    .integer()
    .min(1)
    .max(3650)
    .default(NOTIFICATION_LIMITS.DEFAULT_RETENTION_DAYS),
});

module.exports = {
  uuidParam,
  listMyNotificationsQuerySchema,
  listAllNotificationsQuerySchema,
  createNotificationSchema,
  createFromTemplateSchema,
  broadcastNotificationSchema,
  runJobsSchema,
};
