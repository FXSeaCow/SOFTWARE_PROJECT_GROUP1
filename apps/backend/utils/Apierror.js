/**
 * ApiError
 * Custom error class that carries an HTTP status code alongside the message.
 * Thrown from services/repositories and caught by errorHandler middleware.
 *
 * Usage:
 *   throw new ApiError(404, 'User not found');
 *   throw new ApiError(400, 'Invalid input', [{ field: 'email', msg: 'required' }]);
 */
class ApiError extends Error {
  /**
   * @param {number} statusCode  - HTTP status code (400, 401, 403, 404, 409, 500 ...)
   * @param {string} message     - Human-readable error message
   * @param {Array}  errors      - Optional array of field-level validation errors
   */
  constructor(statusCode, message, errors = []) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errors = errors;       // e.g. [{ field: 'email', message: 'Invalid format' }]
    this.isOperational = true;  // distinguishes expected errors from unexpected crashes

    // Maintain proper stack trace in V8 (Node.js)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }
}

// ─── Convenience factory methods ──────────────────────────────────────────────

ApiError.badRequest = (message, errors = []) =>
  new ApiError(400, message, errors);

ApiError.unauthorized = (message = 'Unauthorized') =>
  new ApiError(401, message);

ApiError.forbidden = (message = 'Forbidden') =>
  new ApiError(403, message);

ApiError.notFound = (resource = 'Resource') =>
  new ApiError(404, `${resource} not found`);

ApiError.conflict = (message) =>
  new ApiError(409, message);

ApiError.internal = (message = 'Internal server error') =>
  new ApiError(500, message);

module.exports = ApiError;