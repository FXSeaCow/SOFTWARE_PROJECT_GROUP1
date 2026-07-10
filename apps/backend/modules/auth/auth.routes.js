/**
 * auth.routes.js
 * Registers all authentication endpoints.
 *
 * Base path (mounted in app.js): /api/auth
 *
 * Public routes (no token required):
 *   POST   /api/auth/register          FR-01
 *   POST   /api/auth/login             FR-02
 *   POST   /api/auth/refresh-token
 *   POST   /api/auth/logout
 *   POST   /api/auth/forgot-password   FR-03
 *   POST   /api/auth/reset-password    FR-03
 *
 * Protected routes (token required):
 *   GET    /api/auth/me
 */

const router  = require('express').Router();
const ctrl    = require('./auth.controller');
const { validate }            = require('../../middlewares/Validate.middleware');
const { authenticate }        = require('../../middlewares/Auth.middleware');
const { authLimiter,
        passwordLimiter }     = require('../../middlewares/RateLimiter.middleware');
const {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  refreshTokenSchema,
} = require('./auth.validation');

// ── Public routes ─────────────────────────────────────────────────────────────

// Register a new account (FR-01)
router.post(
  '/register',
  authLimiter,
  validate(registerSchema),
  ctrl.register
);

// Login (FR-02)
router.post(
  '/login',
  authLimiter,
  validate(loginSchema),
  ctrl.login
);

// Refresh access token
router.post(
  '/refresh-token',
  // Allow refresh token to come from either an httpOnly cookie OR the request body.
  // If a cookie is present we skip body validation; otherwise validate the body.
  (req, res, next) => {
    if (req.cookies && req.cookies.refreshToken) return next();
    return validate(refreshTokenSchema)(req, res, next);
  },
  ctrl.refreshToken
);

// Logout (clears cookie)
router.post('/logout', ctrl.logout);

// Reset password with token (FR-03)
router.post(
  '/reset-password',
  passwordLimiter,
  validate(resetPasswordSchema),
  ctrl.resetPassword
);

// ── Protected routes ──────────────────────────────────────────────────────────

// Get current user profile
router.get('/me', authenticate, ctrl.getMe);

module.exports = router;