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
 * GET /api/occupancy/branches
 * Return active branches with current occupancy snapshots.
 */
const listBranches = asyncHandler(async (req, res) => {
  const branches = await service.listBranches();
  res.json(ApiResponse.success(branches, OCCUPANCY_MESSAGES.BRANCHES_FETCHED));
});

/**
 * GET /api/occupancy/branches/:branchId/active-members
 * Return how many distinct members are currently training in one branch.
 */
const getBranchActiveMembers = asyncHandler(async (req, res) => {
  const result = await service.getBranchActiveMembers(req.params.branchId);
  res.json(ApiResponse.success(result, OCCUPANCY_MESSAGES.ACTIVE_MEMBERS_FETCHED));
});

/**
 * GET /api/occupancy/admin/branches
 * Admin lists every branch, including inactive ones, for management.
 */
const listAllBranches = asyncHandler(async (req, res) => {
  const branches = await service.listAllBranches();
  res.json(ApiResponse.success(branches, OCCUPANCY_MESSAGES.ADMIN_BRANCHES_FETCHED));
});

/**
 * POST /api/occupancy/admin/branches
 * Admin creates a new gym branch.
 */
const createBranch = asyncHandler(async (req, res) => {
  const branch = await service.createBranch(req.body);
  res.status(201).json(ApiResponse.created(branch, OCCUPANCY_MESSAGES.BRANCH_CREATED));
});

/**
 * PATCH /api/occupancy/admin/branches/:branchId
 * Admin updates a gym branch.
 */
const updateBranch = asyncHandler(async (req, res) => {
  const branch = await service.updateBranch(req.params.branchId, req.body);
  res.json(ApiResponse.success(branch, OCCUPANCY_MESSAGES.BRANCH_UPDATED));
});

/**
 * PATCH /api/occupancy/admin/branches/:branchId/status
 * Admin deactivates or reactivates a gym branch.
 */
const setBranchActive = asyncHandler(async (req, res) => {
  const branch = await service.setBranchActive(req.params.branchId, req.body.is_active);
  const message = req.body.is_active
    ? OCCUPANCY_MESSAGES.BRANCH_REACTIVATED
    : OCCUPANCY_MESSAGES.BRANCH_DEACTIVATED;
  res.json(ApiResponse.success(branch, message));
});

/**
 * GET /api/occupancy/current
 * Return current gym occupancy for all branches or one branch.
 */
const getCurrentOccupancy = asyncHandler(async (req, res) => {
  const occupancy = await service.getCurrentOccupancy(req.query);
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
  listBranches,
  listAllBranches,
  createBranch,
  updateBranch,
  setBranchActive,
  getBranchActiveMembers,
  getCurrentOccupancy,
  checkIn,
  checkOut,
  listMySessions,
  listSessions,
  getDailyReport,
  resetOpenSessions,
};
