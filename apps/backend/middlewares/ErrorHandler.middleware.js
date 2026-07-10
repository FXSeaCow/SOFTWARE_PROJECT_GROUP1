/**
 * errorHandler.middleware.js
 * Global Express error-handling middleware.
 * Must be the LAST middleware registered in app.js.
 *
 * Handles two categories:
 *   1. Operational errors (ApiError) — expected, thrown intentionally by services
 *   2. Unexpected errors (programming bugs, DB crashes) — logged with stack trace,
 *      client receives a generic 500 with no internal details leaked
 *
 * Every error response has the shape:
 *   {
 *     success: false,
 *     message: "...",
 *     errors: [{ field, message }]   // only present on validation errors
 *   }
 *
 * Registration in app.js (must be last):
 *   app.use(errorHandler);
 */

const ApiError   = require('../utils/Apierror');
const ApiResponse = require('../utils/Apiresponse');
const logger     = require('../utils/Logger');

/**
 * Map common PostgreSQL error codes to meaningful ApiErrors.
 * Full list: https://www.postgresql.org/docs/current/errcodes-appendix.html
 *
 * @param {Error} err
 * @returns {ApiError|null}
 */
const handleDatabaseError = (err) => {
  if (!err.code) return null;

  switch (err.code) {
    // Unique constraint violation (e.g. duplicate email)
    case '23505': {
      // err.detail looks like: Key (email)=(foo@bar.com) already exists.
      const match  = err.detail?.match(/Key \((.+?)\)=\((.+?)\) already exists/);
      const field  = match ? match[1] : 'field';
      const value  = match ? match[2] : '';
      return ApiError.conflict(`${field} '${value}' is already in use`);
    }

    // Foreign key violation (e.g. referencing a non-existent user_id)
    case '23503': {
      const match  = err.detail?.match(/Key \((.+?)\)=\((.+?)\) is not present/);
      const field  = match ? match[1] : 'reference';
      return ApiError.badRequest(`Referenced ${field} does not exist`);
    }

    // Not null violation (required field missing at DB level)
    case '23502':
      return ApiError.badRequest(
        `Required field missing: ${err.column || 'unknown'}`
      );

    // Check constraint violation (e.g. day_of_week NOT BETWEEN 1 AND 7)
    case '23514':
      return ApiError.badRequest(`Value violates constraint: ${err.constraint}`);

    // Invalid UUID format
    case '22P02':
      return ApiError.badRequest('Invalid ID format — must be a valid UUID');

    default:
      return null;
  }
};

/**
 * errorHandler
 * Express 4-argument error middleware (err, req, res, next).
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  // ── 1. Try to map DB errors to clean ApiErrors ─────────────────────────────
  const dbError = handleDatabaseError(err);
  if (dbError) {
    logger.warn('Database constraint error', {
      code: err.code,
      detail: err.detail,
      path: req.path,
    });
    return res
      .status(dbError.statusCode)
      .json(ApiResponse.error(dbError.message, dbError.errors));
  }

  // ── 2. Known operational errors (thrown by services with ApiError) ──────────
  if (err instanceof ApiError && err.isOperational) {
    // Warn level for client errors, error level for server errors
    const logLevel = err.statusCode >= 500 ? 'error' : 'warn';
    logger[logLevel](`[${err.statusCode}] ${err.message}`, {
      path: req.path,
      method: req.method,
      errors: err.errors,
    });

    return res
      .status(err.statusCode)
      .json(ApiResponse.error(err.message, err.errors));
  }

  // ── 3. Unexpected / programming errors — log full stack, hide details ───────
  logger.error('Unexpected error', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: req.body,
  });

  // Never leak internal error details to the client in production
  const message =
    process.env.NODE_ENV === 'development'
      ? err.message
      : 'An unexpected error occurred. Please try again later.';

  return res.status(500).json(ApiResponse.error(message));
};

module.exports = errorHandler;