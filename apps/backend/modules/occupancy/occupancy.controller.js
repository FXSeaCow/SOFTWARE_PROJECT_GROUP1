/**
 * occupancy.controller.js
 * HTTP layer for gym occupancy operations.
 *
 * Controllers only parse request data, call services, and send ApiResponse
 * objects. Occupancy rules stay in occupancy.service.js.
 */

const service = require('./occupancy.service');
const asyncHandler = require('../../utils/Asynchandler');
const ApiResponse = require('../../utils/Apiresponse');
const { OCCUPANCY_MESSAGES } = require('./occupancy.constants');

/**
 * GET /api/occupancy/current
 * Return current gym occupancy.
 */
const getCurrentOccupancy = asyncHandler(async (req, res) => {
  const occupancy = await service.getCurrentOccupancy();
  res.json(ApiResponse.success(occupancy, OCCUPANCY_MESSAGES.CURRENT_FETCHED));
});

/**
 * POST /api/occupancy/checkin
 * Check the authenticated member, or scanned QR member, into the gym.
 */
const checkIn = asyncHandler(async (req, res) => {
  const result = await service.checkIn(req.user, req.body);
  res.status(201).json(ApiResponse.created(result, OCCUPANCY_MESSAGES.CHECKED_IN));
});

/**
 * POST /api/occupancy/checkout
 * Check the authenticated member, or scanned QR member, out of the gym.
 */
const checkOut = asyncHandler(async (req, res) => {
  const result = await service.checkOut(req.user, req.body);
  res.json(ApiResponse.success(result, OCCUPANCY_MESSAGES.CHECKED_OUT));
});

/**
 * GET /api/occupancy/me/sessions
 * Return the authenticated member's gym session history.
 */
const listMySessions = asyncHandler(async (req, res) => {
  const { sessions, total, page, limit } = await service.listMySessions(
    req.user.id,
    req.query
  );

  res.json(
    ApiResponse.paginated(
      sessions,
      total,
      page,
      limit,
      OCCUPANCY_MESSAGES.MY_SESSIONS_FETCHED
    )
  );
});

/**
 * GET /api/occupancy/admin/sessions
 * Admin lists all gym sessions with optional filters.
 */
const listSessions = asyncHandler(async (req, res) => {
  const { sessions, total, page, limit } = await service.listSessions(req.query);

  res.json(
    ApiResponse.paginated(
      sessions,
      total,
      page,
      limit,
      OCCUPANCY_MESSAGES.SESSIONS_FETCHED
    )
  );
});

/**
 * GET /api/occupancy/admin/daily-report
 * Admin gets a daily occupancy report.
 */
const getDailyReport = asyncHandler(async (req, res) => {
  const report = await service.getDailyReport(req.query);
  res.json(ApiResponse.success(report, OCCUPANCY_MESSAGES.DAILY_REPORT_FETCHED));
});

/**
 * POST /api/occupancy/admin/reset-open-sessions
 * Admin closes all currently open sessions.
 */
const resetOpenSessions = asyncHandler(async (req, res) => {
  const result = await service.resetOpenSessions(req.body);
  res.json(ApiResponse.success(result, OCCUPANCY_MESSAGES.OPEN_SESSIONS_RESET));
});

module.exports = {
  getCurrentOccupancy,
  checkIn,
  checkOut,
  listMySessions,
  listSessions,
  getDailyReport,
  resetOpenSessions,
};
