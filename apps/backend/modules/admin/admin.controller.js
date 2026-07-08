/**
 * admin.controller.js
 * HTTP layer for admin analytics endpoints.
 */

const service = require('./admin.service');
const asyncHandler = require('../../utils/Asynchandler');
const ApiResponse = require('../../utils/Apiresponse');

const getDashboard = asyncHandler(async (req, res) => {
  const dashboard = await service.getDashboard(req.query);
  res.json(ApiResponse.success(dashboard, 'Admin dashboard fetched successfully'));
});

const getRevenueReport = asyncHandler(async (req, res) => {
  const report = await service.getRevenueReport(req.query);
  res.json(ApiResponse.success(report, 'Revenue report fetched successfully'));
});

const getMembershipsReport = asyncHandler(async (req, res) => {
  const report = await service.getMembershipsReport(req.query);
  res.json(ApiResponse.success(report, 'Membership report fetched successfully'));
});

const getOccupancyReport = asyncHandler(async (req, res) => {
  const report = await service.getOccupancyReport(req.query);
  res.json(ApiResponse.success(report, 'Occupancy report fetched successfully'));
});

const getUserStatistics = asyncHandler(async (req, res) => {
  const statistics = await service.getUserStatistics(req.query);
  res.json(ApiResponse.success(statistics, 'User statistics fetched successfully'));
});

const getWorkoutStatistics = asyncHandler(async (req, res) => {
  const statistics = await service.getWorkoutStatistics(req.query);
  res.json(ApiResponse.success(statistics, 'Workout statistics fetched successfully'));
});

const getStreakStatistics = asyncHandler(async (req, res) => {
  const statistics = await service.getStreakStatistics(req.query);
  res.json(ApiResponse.success(statistics, 'Streak statistics fetched successfully'));
});

const getPaymentStatistics = asyncHandler(async (req, res) => {
  const statistics = await service.getPaymentStatistics(req.query);
  res.json(ApiResponse.success(statistics, 'Payment statistics fetched successfully'));
});

module.exports = {
  getDashboard,
  getRevenueReport,
  getMembershipsReport,
  getOccupancyReport,
  getUserStatistics,
  getWorkoutStatistics,
  getStreakStatistics,
  getPaymentStatistics,
};
