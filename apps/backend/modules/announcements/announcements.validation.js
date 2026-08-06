const Joi = require('joi');

const createAnnouncementSchema = Joi.object({
  title: Joi.string().trim().min(3).max(160).required().messages({
    'string.empty': 'title is required',
    'string.min': 'title must be at least 3 characters',
    'string.max': 'title must be at most 160 characters',
    'any.required': 'title is required',
  }),
  body: Joi.string().trim().min(10).max(5000).required().messages({
    'string.empty': 'body is required',
    'string.min': 'body must be at least 10 characters',
    'string.max': 'body must be at most 5000 characters',
    'any.required': 'body is required',
  }),
  type: Joi.string().valid('announcement', 'system', 'membership', 'schedule').default('announcement'),
  send_to: Joi.string().valid('all', 'selected').required().messages({
    'any.only': 'send_to must be either all or selected',
    'any.required': 'send_to is required',
  }),
  user_ids: Joi.alternatives().conditional('send_to', {
    is: 'selected',
    then: Joi.array().items(Joi.string().uuid()).min(1).required().messages({
      'array.min': 'user_ids must contain at least 1 user',
      'any.required': 'user_ids is required when send_to is selected',
    }),
    otherwise: Joi.array().items(Joi.string().uuid()).max(0).default([]),
  }),
});

module.exports = {
  createAnnouncementSchema,
};
