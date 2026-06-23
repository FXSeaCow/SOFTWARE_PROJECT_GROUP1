/**
 * auth.middleware.js
 * Verifies the JWT access token on every protected route.
 * Attaches the decoded payload to req.user so downstream
 * controllers/services can access { id, role } without
 * hitting the database again.
 *
 * Usage in routes:
 *   router.get('/me', authenticate, ctrl.getMe);
 *
 * Token must be sent as:
 *   Authorization: Bearer <access_token>
 */

const { verifyAccessToken } = require('../utils/Jwt');
const ApiError              = require('../utils/Apierror');
const asyncHandler          = require('../utils/Asynchandler');
const db                    = require('../config/db');

/**
 * authenticate
 * Validates the Bearer token and sets req.user = { id, role, email }.
 * Also does a lightweight DB check to confirm the user still exists
 * (handles the case where an account is deleted but the token is still valid).
 */
const authenticate = asyncHandler(async (req, res, next) => {
  // 1. Extract token from header
  // sample header: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw ApiError.unauthorized('Access token missing');
  }
  const token = authHeader.split(' ')[1];

  // 2. Verify signature and expiry
  const payload = verifyAccessToken(token); // throws ApiError 401 if invalid

  // 3. Confirm user still exists in DB (light query — only id, role, email)
  const { rows } = await db.query(
    'SELECT id, role, email, full_name, account_status FROM users WHERE id = $1',
    [payload.id]
  );

  if (!rows.length) {
    throw ApiError.unauthorized('Account no longer exists');
  }

  if (rows[0].account_status === 'locked') {
    throw ApiError.forbidden('This account is locked');
  }

  // 4. Attach to request — available to all downstream handlers
  req.user = rows[0]; // { id, role, email, full_name }
  next();
});

/**
 * optionalAuthenticate
 * Same as authenticate but does NOT throw if no token is present.
 * Useful for routes that behave differently for logged-in vs guest users.
 * Sets req.user = null if no valid token is found.
 */
const optionalAuthenticate = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  try {
    const token   = authHeader.split(' ')[1];
    const payload = verifyAccessToken(token);

    const { rows } = await db.query(
      'SELECT id, role, email, full_name, account_status FROM users WHERE id = $1',
      [payload.id]
    );

    req.user = rows[0] && rows[0].account_status !== 'locked' ? rows[0] : null;
  } catch {
    req.user = null;
  }

  next();
});

module.exports = { authenticate, optionalAuthenticate };
