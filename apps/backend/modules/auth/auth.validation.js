/**
 * auth.validation.js
 * Joi schemas cho mọi endpoint auth.
 * Được dùng bởi middleware `validate()` — nếu invalid sẽ không tới controller.
 *
 * Covers FR-01 (register), FR-02 (login), FR-03 (password recovery).
 */

const Joi = require('joi');

// ─── Các quy tắc trường tái sử dụng ─────────────────────────────────────────

const email = Joi.string().email().lowercase().trim().required().messages({
  'string.email': 'Please provide a valid email address',
  'any.required': 'Email is required',
});

const password = Joi.string()
  .min(8)
  .max(72) // bcrypt truncate beyond 72 chars
  .pattern(/[A-Z]/, 'uppercase letter')
  .pattern(/[0-9]/, 'number')
  .required()
  .messages({
    'string.min':     'Password must be at least 8 characters',
    'string.max':     'Password must not exceed 72 characters',
    'string.pattern.name': 'Password must contain at least one {#name}',
    'any.required':   'Password is required',
  });

// ─── Schemas ───────────────────────────────────────────────────────────────

const registerSchema = Joi.object({
  full_name: Joi.string().trim().min(2).max(100).required().messages({
    'string.min':   'Full name must be at least 2 characters',
    'any.required': 'Full name is required',
  }),
  email,
  password,
  confirm_password: Joi.string().valid(Joi.ref('password')).required().messages({
    'any.only':     'Passwords do not match',
    'any.required': 'Please confirm your password',
  }),
  phone: Joi.string()
    .pattern(/^\+?[0-9\s\-().]{7,20}$/)
    .optional()
    .allow('')
    .messages({
      'string.pattern.base': 'Please provide a valid phone number',
    }),
});

const loginSchema = Joi.object({
  email,
  password: Joi.string().required().messages({
    'any.required': 'Password is required',
  }),
});

const forgotPasswordSchema = Joi.object({
  email,
});

const resetPasswordSchema = Joi.object({
  token: Joi.string().required().messages({
    'any.required': 'Reset token is required',
  }),
  password,
  confirm_password: Joi.string().valid(Joi.ref('password')).required().messages({
    'any.only':     'Passwords do not match',
    'any.required': 'Please confirm your new password',
  }),
});

const refreshTokenSchema = Joi.object({
  refresh_token: Joi.string().required().messages({
    'any.required': 'Refresh token is required',
  }),
});

module.exports = {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  refreshTokenSchema,
};
