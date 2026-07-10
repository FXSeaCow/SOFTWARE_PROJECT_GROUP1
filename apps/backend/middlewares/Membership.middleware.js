/**
 * membership.middleware.js
 * Verifies that the authenticated user currently has an active membership
 * before allowing access to member-only features.
 *
 * Used to protect:
 *   - Workout plan generation / viewing  (FR-07, FR-08, FR-09)
 *   - Fitness progress tracking          (FR-10, FR-11, FR-12)
 *   - Streak features                    (FR-13 to FR-16)
 *   - QR check-in / check-out           (FR-17, FR-18)
 *
 * Must be used AFTER authenticate (requires req.user to be set).
 * Admins bypass this check — they don't need a personal membership.
 *
 * Usage:
 *   router.post(
 *     '/checkin',
 *     authenticate,
 *     requireActiveMembership,
 *     ctrl.checkIn
 *   );
 */

const db       = require('../config/db');
const ApiError = require('../utils/Apierror');
const asyncHandler = require('../utils/Asynchandler');

/**
 * requireActiveMembership
 * Checks that req.user has at least one membership with status = 'active'
 * and end_date >= today.
 *
 * Attaches req.membership to the request so downstream controllers
 * don't need to query it again.
 */
const requireActiveMembership = asyncHandler(async (req, res, next) => {
  // Admins don't need a personal membership
  if (req.user.role === 'admin') return next();

  const { rows } = await db.query(
    `SELECT id, plan_id, status, start_date, end_date
     FROM memberships
     WHERE user_id = $1
       AND status   = 'active'
       AND end_date >= CURRENT_DATE
     ORDER BY end_date DESC
     LIMIT 1`,
    [req.user.id]
  );

  if (!rows.length) {
    throw new ApiError(
      403,
      'An active membership is required to access this feature. ' +
      'Please renew or purchase a membership.'
    );
  }

  // Attach so controllers can use it (e.g. display days remaining)
  req.membership = rows[0];
  next();
});

module.exports = { requireActiveMembership };