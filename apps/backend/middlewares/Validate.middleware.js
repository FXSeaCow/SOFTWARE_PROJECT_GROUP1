/**
 * validate.middleware.js
 * Generic request validation using Joi schemas.
 * Returns a structured 400 response with field-level errors
 * when validation fails — never reaches the controller.
 *
 * Usage in routes:
 *   const { registerSchema } = require('./auth.validation');
 *   router.post('/register', validate(registerSchema), ctrl.register);
 *
 *   // Validate different parts of the request separately:
 *   router.get('/:id', validate(null, paramsSchema), ctrl.getById);
 *   router.get('/', validate(null, null, querySchema), ctrl.list);
 */

const ApiError = require('../utils/ApiError');

const JOI_OPTIONS = {
  abortEarly: false,  // collect ALL errors, not just the first one
  stripUnknown: true, // silently remove fields not in the schema
  errors: {
    wrap: { label: false }, // don't wrap field names in quotes in messages
  },
};

/**
 * validate(bodySchema, paramsSchema, querySchema)
 * Returns a middleware that validates the specified parts of the request.
 *
 * @param {import('joi').Schema|null} bodySchema   - validates req.body
 * @param {import('joi').Schema|null} paramsSchema - validates req.params
 * @param {import('joi').Schema|null} querySchema  - validates req.query
 */
const validate = (bodySchema = null, paramsSchema = null, querySchema = null) => {
  return (req, res, next) => {
    const validationErrors = [];

    // Validate body
    if (bodySchema) {
      const { error, value } = bodySchema.validate(req.body, JOI_OPTIONS);
      if (error) {
        validationErrors.push(
          ...error.details.map((d) => ({
            field: d.path.join('.'),
            message: d.message,
          }))
        );
      } else {
        req.body = value; // replace with sanitized value
      }
    }

    // Validate params
    if (paramsSchema) {
      const { error, value } = paramsSchema.validate(req.params, JOI_OPTIONS);
      if (error) {
        validationErrors.push(
          ...error.details.map((d) => ({
            field: `params.${d.path.join('.')}`,
            message: d.message,
          }))
        );
      } else {
        req.params = value;
      }
    }

    // Validate query
    if (querySchema) {
      const { error, value } = querySchema.validate(req.query, JOI_OPTIONS);
      if (error) {
        validationErrors.push(
          ...error.details.map((d) => ({
            field: `query.${d.path.join('.')}`,
            message: d.message,
          }))
        );
      } else {
        req.query = value;
      }
    }

    if (validationErrors.length > 0) {
      return next(ApiError.badRequest('Validation failed', validationErrors));
    }

    next();
  };
};

module.exports = { validate };