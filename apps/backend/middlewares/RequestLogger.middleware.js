/**
 * requestLogger.middleware.js
 * Logs every incoming HTTP request using morgan, piped through
 * the winston logger so all logs go to the same transport.
 *
 * Two formats:
 *   Development : colored, concise  →  POST /api/auth/login 200 45ms
 *   Production  : Apache combined format → full IP, user-agent, referrer
 *
 * Sensitive routes (login, payments) are flagged to suppress body logging.
 *
 * Registration in app.js (before routes):
 *   app.use(requestLogger);
 */

const morgan = require('morgan');
const logger = require('../utils/Logger');

const isDev = process.env.NODE_ENV !== 'production';

// ─── Custom token: request body (dev only, sensitive routes excluded) ─────────
morgan.token('body', (req) => {
  const SENSITIVE_PATHS = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/reset-password',
    '/api/payments',
  ];

  const isSensitive = SENSITIVE_PATHS.some((path) =>
    req.originalUrl.startsWith(path)
  );

  if (isSensitive || !isDev) return '[redacted]';

  const body = { ...req.body };
  // Always strip password fields even on non-sensitive routes
  delete body.password;
  delete body.password_hash;
  delete body.newPassword;

  return Object.keys(body).length ? JSON.stringify(body) : '';
});

// ─── Custom token: authenticated user ID ──────────────────────────────────────
morgan.token('user-id', (req) => req.user?.id || 'guest');

// ─── Format strings ──────────────────────────────────────────────────────────
const devFormat =
  ':method :url :status :response-time ms — user::user-id :body';

const prodFormat =
  ':remote-addr - :user-id [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"';

const requestLogger = morgan(isDev ? devFormat : prodFormat, {
  stream: logger.stream, // pipe morgan output through winston
  // Skip logging health check endpoints to reduce noise
  skip: (req) => req.originalUrl === '/health' || req.originalUrl === '/api/health',
});

module.exports = requestLogger;