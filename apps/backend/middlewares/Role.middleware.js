/**
 * role.middleware.js
 * Restricts access to routes based on req.user.role.
 * Must always be used AFTER authenticate — it relies on req.user
 * being already set.
 *
 * Usage:
 *   // Admin-only route
 *   router.get('/reports', authenticate, requireRole('admin'), ctrl.getReports);
 *
 *   // Multiple roles allowed
 *   router.get('/dashboard', authenticate, requireRole('admin', 'member'), ctrl.getDashboard);
 */

const ApiError = require('../utils/Apierror');

/**
 * requireRole(...roles)
 * Returns a middleware that allows the request through only if
 * req.user.role is included in the provided roles list.
 *
 * @param {...string} roles - Allowed roles: 'member', 'admin'
 */
const requireRole = (...roles) => (req, res, next) => {
  // Safety net: authenticate should always run first
  if (!req.user) {
    return next(ApiError.unauthorized('Authentication required'));
  }

  if (!roles.includes(req.user.role)) {
    return next(
      ApiError.forbidden(
        `Access denied. Required role: ${roles.join(' or ')}`
      )
    );
  }

  next();
};

/**
 * requireSelf
 * Ensures the authenticated user can only access their own resources.
 * Admins bypass this check and can access any user's resource.
 *
 * Usage:
 *   // GET /api/users/:userId/profile
 *   router.get('/:userId/profile', authenticate, requireSelf('userId'), ctrl.getProfile);
 *
 * @param {string} paramName - The req.params key holding the target user's ID (default: 'userId')
 */
const requireSelf = (paramName = 'userId') => (req, res, next) => {
  if (!req.user) {
    return next(ApiError.unauthorized('Authentication required'));
  }

  // Admins can access any user's data
  if (req.user.role === 'admin') return next();

  // Members can only access their own data
  if (req.user.id !== req.params[paramName]) {
    return next(ApiError.forbidden('You can only access your own data'));
  }

  next();
};

module.exports = { requireRole, requireSelf };