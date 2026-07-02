/**
 * streaks.controller.js
 * HTTP layer for workout streak operations.
 *
 * Controllers parse request data, call the service layer, and return a
 * standard ApiResponse. They do not contain streak business rules.
 */

const service = require('./streaks.service');
const asyncHandler = require('../../utils/Asynchandler');
const ApiResponse = require('../../utils/Apiresponse');
const { STREAK_MESSAGES } = require('./streaks.constants');

/**
 * GET /api/streaks/me
 * Return the authenticated member's streak summary.
 */
const getMyStreak = asyncHandler(async (req, res) => {
  const streak = await service.getMyStreak(req.user.id);
  res.json(ApiResponse.success(streak, STREAK_MESSAGES.SUMMARY_FETCHED));
});

/**
 * GET /api/streaks/me/checkins
 * Return the authenticated member's workout check-in history.
 */
const listMyCheckins = asyncHandler(async (req, res) => {
  const { checkins, total, page, limit } = await service.listMyCheckins(
    req.user.id,
    req.query
  );

  res.json(
    ApiResponse.paginated(
      checkins,
      total,
      page,
      limit,
      STREAK_MESSAGES.CHECKINS_FETCHED
    )
  );
});

/**
 * POST /api/streaks/checkins
 * Record a workout check-in for the authenticated member.
 */
const recordCheckin = asyncHandler(async (req, res) => {
  const result = await service.recordCheckin(req.user.id, req.body);

  const message = result.already_checked_in
    ? STREAK_MESSAGES.CHECKIN_ALREADY_EXISTS
    : STREAK_MESSAGES.CHECKIN_CREATED;

  const statusCode = result.already_checked_in ? 200 : 201;
  res.status(statusCode).json(ApiResponse.success(result, message));
});

/**
 * GET /api/streaks/leaderboard
 * Return members ranked by current streak, then longest streak.
 */
const getLeaderboard = asyncHandler(async (req, res) => {
  const leaderboard = await service.getLeaderboard(req.query);
  res.json(ApiResponse.success(leaderboard, STREAK_MESSAGES.LEADERBOARD_FETCHED));
});

/**
 * GET /api/streaks/admin/:userId
 * Admin reads one user's streak summary.
 */
const getUserStreak = asyncHandler(async (req, res) => {
  const result = await service.getUserStreak(req.params.userId);
  res.json(ApiResponse.success(result, STREAK_MESSAGES.USER_STREAK_FETCHED));
});

/**
 * POST /api/streaks/admin/:userId/recalculate
 * Admin rebuilds a user's streak counters from check-in history.
 */
const recalculateUserStreak = asyncHandler(async (req, res) => {
  const result = await service.recalculateUserStreak(req.params.userId);
  res.json(ApiResponse.success(result, STREAK_MESSAGES.USER_STREAK_RECALCULATED));
});

module.exports = {
  getMyStreak,
  listMyCheckins,
  recordCheckin,
  getLeaderboard,
  getUserStreak,
  recalculateUserStreak,
};
