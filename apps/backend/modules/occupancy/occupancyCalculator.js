/**
 * occupancyCalculator.js
 * Pure calculation helpers for gym occupancy analytics.
 *
 * This file does not import the database. It receives session-like objects and
 * returns derived metrics such as current occupancy, rate, peak hour, average
 * occupancy, and daily reports.
 */

const {
  DEFAULT_GYM_CAPACITY,
  OCCUPANCY_STATUS,
  OCCUPANCY_THRESHOLDS,
} = require('./occupancy.constants');

/**
 * Clamp a number into a safe non-negative range.
 *
 * @param {number} value
 * @returns {number}
 */
const clampNonNegative = (value) => Math.max(0, Number(value) || 0);

/**
 * Round a number to two decimal places.
 *
 * @param {number} value
 * @returns {number}
 */
const roundTwo = (value) => Math.round((Number(value) || 0) * 100) / 100;

/**
 * Calculate occupancy rate as a percentage.
 *
 * @param {number} currentOccupancy
 * @param {number} capacity
 * @returns {number}
 */
const calculateOccupancyRate = (currentOccupancy, capacity = DEFAULT_GYM_CAPACITY) => {
  const safeCapacity = Math.max(1, Number(capacity) || DEFAULT_GYM_CAPACITY);
  return roundTwo((clampNonNegative(currentOccupancy) / safeCapacity) * 100);
};

/**
 * Resolve a human-readable status bucket from an occupancy rate.
 *
 * @param {number} occupancyRate
 * @returns {string}
 */
const getOccupancyStatus = (occupancyRate) => {
  if (occupancyRate <= 0) return OCCUPANCY_STATUS.EMPTY;
  if (occupancyRate >= OCCUPANCY_THRESHOLDS.FULL) return OCCUPANCY_STATUS.FULL;
  if (occupancyRate >= OCCUPANCY_THRESHOLDS.NEAR_FULL) return OCCUPANCY_STATUS.NEAR_FULL;
  if (occupancyRate >= OCCUPANCY_THRESHOLDS.BUSY) return OCCUPANCY_STATUS.BUSY;
  return OCCUPANCY_STATUS.NORMAL;
};

/**
 * Calculate the current occupancy summary.
 *
 * @param {number} openSessionCount
 * @param {number} capacity
 * @returns {object}
 */
const calculateCurrentOccupancy = (
  openSessionCount,
  capacity = DEFAULT_GYM_CAPACITY
) => {
  const safeCapacity = Math.max(1, Number(capacity) || DEFAULT_GYM_CAPACITY);
  const currentOccupancy = clampNonNegative(openSessionCount);
  const occupancyRate = calculateOccupancyRate(currentOccupancy, safeCapacity);

  return {
    current_occupancy: currentOccupancy,
    capacity: safeCapacity,
    available_slots: Math.max(0, safeCapacity - currentOccupancy),
    occupancy_rate: occupancyRate,
    status: getOccupancyStatus(occupancyRate),
    is_full: currentOccupancy >= safeCapacity,
  };
};

/**
 * Return local day boundaries for a YYYY-MM-DD date.
 *
 * @param {string} dateString
 * @returns {{ start: Date, end: Date }}
 */
const getDayBounds = (dateString) => {
  const start = new Date(`${dateString}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
};

/**
 * Convert a date-ish value into a Date instance.
 *
 * @param {Date|string|null|undefined} value
 * @returns {Date|null}
 */
const toDate = (value) => {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
};

/**
 * Check whether a session overlaps a specific hour window.
 *
 * @param {object} session
 * @param {Date} hourStart
 * @param {Date} hourEnd
 * @param {Date} fallbackEnd
 * @returns {boolean}
 */
const overlapsHour = (session, hourStart, hourEnd, fallbackEnd) => {
  const checkInAt = toDate(session.checked_in_at || session.check_in_at);
  if (!checkInAt) return false;

  const checkOutAt = toDate(session.checked_out_at || session.check_out_at) || fallbackEnd;
  return checkInAt < hourEnd && checkOutAt > hourStart;
};

/**
 * Calculate occupancy for each hour of a day.
 *
 * @param {object[]} sessions
 * @param {string} dateString - YYYY-MM-DD
 * @returns {Array<{ hour: string, occupancy: number }>}
 */
const calculateHourlyOccupancy = (sessions = [], dateString) => {
  const { start, end } = getDayBounds(dateString);
  const now = new Date();
  const fallbackEnd = now < end ? now : end;

  return Array.from({ length: 24 }, (_, hour) => {
    const hourStart = new Date(start);
    hourStart.setHours(hour, 0, 0, 0);

    const hourEnd = new Date(hourStart);
    hourEnd.setHours(hour + 1, 0, 0, 0);

    const occupancy = sessions.filter((session) =>
      overlapsHour(session, hourStart, hourEnd, fallbackEnd)
    ).length;

    return {
      hour: `${String(hour).padStart(2, '0')}:00`,
      occupancy,
    };
  });
};

/**
 * Calculate the busiest hour for a day.
 *
 * @param {object[]} sessions
 * @param {string} dateString - YYYY-MM-DD
 * @returns {{ hour: string|null, occupancy: number }}
 */
const calculatePeakHour = (sessions = [], dateString) => {
  const hourly = calculateHourlyOccupancy(sessions, dateString);

  return hourly.reduce(
    (peak, item) => (item.occupancy > peak.occupancy ? item : peak),
    { hour: null, occupancy: 0 }
  );
};

/**
 * Calculate average occupancy from hourly occupancy buckets.
 *
 * @param {object[]} sessions
 * @param {string} dateString - YYYY-MM-DD
 * @returns {number}
 */
const calculateAverageOccupancy = (sessions = [], dateString) => {
  const hourly = calculateHourlyOccupancy(sessions, dateString);
  const total = hourly.reduce((sum, item) => sum + item.occupancy, 0);
  return roundTwo(total / hourly.length);
};

/**
 * Build a complete daily occupancy report.
 *
 * @param {object[]} sessions
 * @param {{ date: string, capacity?: number }} options
 * @returns {object}
 */
const buildDailyReport = (
  sessions = [],
  { date, capacity = DEFAULT_GYM_CAPACITY }
) => {
  const safeCapacity = Math.max(1, Number(capacity) || DEFAULT_GYM_CAPACITY);
  const hourlyOccupancy = calculateHourlyOccupancy(sessions, date);
  const peakHour = calculatePeakHour(sessions, date);
  const averageOccupancy = calculateAverageOccupancy(sessions, date);
  const uniqueMembers = new Set(sessions.map((session) => session.user_id)).size;
  const openSessions = sessions.filter(
    (session) => !(session.checked_out_at || session.check_out_at)
  ).length;

  return {
    date,
    capacity: safeCapacity,
    total_visits: sessions.length,
    unique_members: uniqueMembers,
    open_sessions: openSessions,
    peak_hour: peakHour,
    average_occupancy: averageOccupancy,
    average_occupancy_rate: calculateOccupancyRate(averageOccupancy, safeCapacity),
    hourly_occupancy: hourlyOccupancy,
  };
};

module.exports = {
  calculateCurrentOccupancy,
  calculateOccupancyRate,
  calculatePeakHour,
  calculateAverageOccupancy,
  buildDailyReport,
  getOccupancyStatus,
  calculateHourlyOccupancy,
};
