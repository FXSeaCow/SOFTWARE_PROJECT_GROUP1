const Joi = require('joi');

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
      'string.min': 'New password must be at least 8 characters',
      'string.max': 'New password must not exceed 72 characters',
      'string.pattern.name': 'New password must contain at least one {#name}',
      'any.required': 'New password is required',
    }),
  confirm_new_password: Joi.string()
    .valid(Joi.ref('new_password'))
    .required()
    .messages({
      'any.only': 'Passwords do not match',
      'any.required': 'Please confirm your new password',
    }),
});

module.exports = {
  changePasswordSchema,
};
