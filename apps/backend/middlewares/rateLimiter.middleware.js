/**
 * rateLimiter.middleware.js
 * Prevents brute-force attacks on sensitive endpoints (login, register,
 * password reset) by capping how many requests a single IP can make
 * within a time window.
 *
 * Built on express-rate-limit (install: npm install express-rate-limit).
 *
 * Three limiters with different thresholds:
 *
 *   authLimiter      → /api/auth/login, /api/auth/register
 *                      10 requests / 15 minutes per IP
 *                      (stops credential stuffing & signup spam)
 *
 *   passwordLimiter  → /api/auth/forgot-password, /api/auth/reset-password
 *                      5 requests / 60 minutes per IP
 *                      (email bombing protection)
 *
 *   generalLimiter   → all other /api/* routes
 *                      200 requests / 15 minutes per IP
 *                      (basic DDoS protection, satisfies NFR-01)
 *
 * Usage in routes:
 *   const { authLimiter } = require('../../middlewares/rateLimiter.middleware');
 *   router.post('/login', authLimiter, validate(loginSchema), ctrl.login);
 *
 * Usage in app.js (general limiter for all routes):
 *   app.use('/api', generalLimiter);
 */

const rateLimit = require('express-rate-limit');
const ApiResponse = require('../utils/Apiresponse');

/**
 * Shared handler: returns a consistent JSON error instead of the default HTML page.
 */
const rateLimitHandler = (req, res) => {
  res.status(429).json(
    ApiResponse.error(
      'Too many requests from this IP. Please try again later.'
    )
  );
};

/**
 * authLimiter
 * Tight limit for login & register endpoints.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,    // Return rate limit info in RateLimit-* headers
  legacyHeaders: false,
  handler: rateLimitHandler,
  // Skip successful requests — only count failures toward the limit
  // Disable limiter during tests by default to avoid flakiness from many
  // synthetic requests originating from the test runner process/IP.
  // Tests that need the limiter can opt-in by setting `ENABLE_RATE_LIMITER=true`.
  skip: () => process.env.NODE_ENV === 'test' && process.env.ENABLE_RATE_LIMITER !== 'true',
  skipSuccessfulRequests: true,
});

/**
 * passwordLimiter
 * Very tight limit for password reset to prevent email bombing.
 */
const passwordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 60 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  // Disable limiter during tests to avoid flakiness from many synthetic
  // requests originating from the test runner process/IP.
  // Opt-in via ENABLE_RATE_LIMITER=true when a test needs real rate limiting.
  skip: () => process.env.NODE_ENV === 'test' && process.env.ENABLE_RATE_LIMITER !== 'true',
});

/**
 * GetExercisesLimiter
 * Loose limit applied to all API routes as a baseline DDoS guard.
 */
const getExercisesLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20000,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  // Opt-in via ENABLE_RATE_LIMITER=true when a test needs real rate limiting.
  skip: () => process.env.NODE_ENV === 'test' && process.env.ENABLE_RATE_LIMITER !== 'true',
});


/**
 * generalLimiter
 * Loose limit applied to all API routes as a baseline DDoS guard.
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  // Opt-in via ENABLE_RATE_LIMITER=true when a test needs real rate limiting.
  skip: () => process.env.NODE_ENV === 'test' && process.env.ENABLE_RATE_LIMITER !== 'true',
});

module.exports = { authLimiter, passwordLimiter, getExercisesLimiter, generalLimiter };