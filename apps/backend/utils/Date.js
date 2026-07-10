/**
 * date.js
 * Date helpers used across the GymHub domain:
 *   - Membership expiry calculations (FR-05, FR-22)
 *   - Streak logic helpers (FR-13, FR-16)
 *   - Consistent date formatting for API responses
 *
 * Built on the native Date object + Intl — no heavy dependencies.
 * If you need timezone-aware recurrence later, add date-fns-tz.
 */

// ─── Membership helpers ───────────────────────────────────────────────────────

/**
 * Compute the end date of a membership by adding duration_days to start_date.
 *
 * @param {Date|string} startDate
 * @param {number}      durationDays - from membership_plans.duration_days
 * @returns {Date}
 */
const computeEndDate = (startDate, durationDays) => {
  const date = new Date(startDate);
  date.setDate(date.getDate() + durationDays);
  return date;
};

/**
 * Return the number of days remaining until a membership expires.
 * Returns 0 if already expired.
 *
 * @param {Date|string} endDate - memberships.end_date
 * @returns {number} days remaining (0 if expired)
 */
const daysUntilExpiry = (endDate) => {
  const now   = new Date();
  const end   = new Date(endDate);
  const diffMs = end - now;
  return diffMs > 0 ? Math.ceil(diffMs / (1000 * 60 * 60 * 24)) : 0;
};

/**
 * Check if a membership is expiring within the given warning window.
 * Used to trigger FR-22 expiry notifications.
 *
 * @param {Date|string} endDate
 * @param {number}      warningDays - default 7 days
 * @returns {boolean}
 */
const isExpiringSoon = (endDate, warningDays = 7) => {
  const days = daysUntilExpiry(endDate);
  return days > 0 && days <= warningDays;
};

// ─── Streak helpers ───────────────────────────────────────────────────────────

/**
 * Return today's date as a YYYY-MM-DD string (local time).
 * Used when inserting workout_checkins.checkin_date.
 *
 * @returns {string}  e.g. "2026-06-16"
 */
const todayDateString = () => {
  return new Date().toISOString().slice(0, 10);
};

/**
 * Check whether two date strings (YYYY-MM-DD) are consecutive calendar days.
 * Used in streak calculation: last_active_date vs today.
 *
 * @param {string} dateA - earlier date  e.g. "2026-06-15"
 * @param {string} dateB - later date    e.g. "2026-06-16"
 * @returns {boolean}
 */
const areConsecutiveDays = (dateA, dateB) => {
  const a = new Date(dateA);
  const b = new Date(dateB);
  const diffMs   = b - a;
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return diffDays === 1;
};

/**
 * Check whether a streak is at risk — i.e. last active date was yesterday,
 * and the member has NOT yet checked in today.
 * Used to trigger FR-16 streak warning notifications.
 *
 * @param {string|null} lastActiveDate - workout_streaks.last_active_date
 * @returns {boolean}
 */
const isStreakAtRisk = (lastActiveDate) => {
  if (!lastActiveDate) return false;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);
  return lastActiveDate === yesterdayStr;
};

/**
 * Check whether a streak is already broken — i.e. last active date
 * is more than 1 day ago.
 *
 * @param {string|null} lastActiveDate
 * @returns {boolean}
 */
const isStreakBroken = (lastActiveDate) => {
  if (!lastActiveDate) return false;
  const today = new Date();
  const last  = new Date(lastActiveDate);
  const diffDays = Math.round((today - last) / (1000 * 60 * 60 * 24));
  return diffDays > 1;
};

// ─── Formatting ───────────────────────────────────────────────────────────────

/**
 * Format a Date to a readable string for notifications/display.
 *
 * @param {Date|string} date
 * @param {string}      locale  - default 'en-US'
 * @returns {string}  e.g. "June 16, 2026"
 */
const formatDate = (date, locale = 'en-US') => {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric', month: 'long', day: 'numeric',
  }).format(new Date(date));
};

module.exports = {
  computeEndDate,
  daysUntilExpiry,
  isExpiringSoon,
  todayDateString,
  areConsecutiveDays,
  isStreakAtRisk,
  isStreakBroken,
  formatDate,
};