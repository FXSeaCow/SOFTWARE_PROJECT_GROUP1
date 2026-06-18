/**
 * users.validation.js
 * Joi schemas for user profile endpoints.
 *
 * Covers:
 *   - Update own profile  (PATCH /api/users/me)
 *   - Change password     (PATCH /api/users/me/password)
 *   - UUID param check    (GET  /api/users/:userId)   [admin]
 *   - List users query    (GET  /api/users)           [admin]
 */

const Joi = require('joi');

// ─── Reusable fields ──────────────────────────────────────────────────────────

const uuidParam = Joi.object({
  userId: Joi.string().uuid().required().messages({
    'string.uuid':  'userId must be a valid UUID',
    'any.required': 'userId is required',
  }),
});

// ─── Schemas ──────────────────────────────────────────────────────────────────

/**
 * PATCH /api/users/me
 * All fields optional — only provided fields are updated.
 */
const updateProfileSchema = Joi.object({
  full_name: Joi.string().trim().min(2).max(100).messages({
    'string.min': 'Full name must be at least 2 characters',
  }),
  phone: Joi.string()
    .pattern(/^\+?[0-9\s\-().]{7,20}$/)
    .allow('', null)
    .messages({
      'string.pattern.base': 'Please provide a valid phone number',
    }),
}).min(1).messages({
  'object.min': 'At least one field must be provided to update',
});

/**
 * PATCH /api/users/me/password
 */
const changePasswordSchema = Joi.object({
  current_password: Joi.string().required().messages({
    'any.required': 'Current password is required',
  }),
  new_password: Joi.string()
    .min(8)
    .max(72)
    .pattern(/[A-Z]/, 'uppercase letter')
    .pattern(/[0-9]/, 'number')
    .required()
    .messages({
      'string.min':          'New password must be at least 8 characters',
      'string.max':          'New password must not exceed 72 characters',
      'string.pattern.name': 'New password must contain at least one {#name}',
      'any.required':        'New password is required',
    }),
  confirm_new_password: Joi.string()
    .valid(Joi.ref('new_password'))
    .required()
    .messages({
      'any.only':     'Passwords do not match',
      'any.required': 'Please confirm your new password',
    }),
});

/**
 * GET /api/users  [admin]
 * Optional query filters.
 */
const listUsersQuerySchema = Joi.object({
  page:   Joi.number().integer().min(1).default(1),
  limit:  Joi.number().integer().min(1).max(100).default(10),
  role:   Joi.string().valid('member', 'admin').optional(),
  search: Joi.string().trim().max(100).optional(), // search by name or email
});

module.exports = {
  uuidParam,
  updateProfileSchema,
  changePasswordSchema,
  listUsersQuerySchema,
};