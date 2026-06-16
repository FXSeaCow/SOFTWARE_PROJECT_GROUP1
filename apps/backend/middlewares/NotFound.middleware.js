/**
 * notFound.middleware.js
 * Catches any request that didn't match a defined route and
 * passes a 404 ApiError to errorHandler.
 *
 * Must be registered AFTER all route mounts, and BEFORE errorHandler:
 *
 *   app.use('/api/auth', authRoutes);
 *   app.use('/api/users', userRoutes);
 *   ...
 *   app.use(notFound);       // ← catches unmatched routes
 *   app.use(errorHandler);   // ← formats all errors as JSON
 */

const ApiError = require('../utils/Apierror');

const notFound = (req, res, next) => {
  next(
    new ApiError(
      404,
      `Route not found: ${req.method} ${req.originalUrl}`
    )
  );
};

module.exports = notFound;