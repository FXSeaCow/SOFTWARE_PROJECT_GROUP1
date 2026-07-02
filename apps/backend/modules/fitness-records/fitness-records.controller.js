/**
 * fitness-records.controller.js
 * HTTP layer for fitness record operations.
 *
 * Controllers parse req data, call the service layer, and send standard
 * ApiResponse objects. They do not contain calculation or database logic.
 */

const service = require('./fitness-records.service');
const asyncHandler = require('../../utils/Asynchandler');
const ApiResponse = require('../../utils/Apiresponse');
const {
  FITNESS_RECORD_MESSAGES,
} = require('./fitness-records.constants');

/**
 * POST /api/fitness-records
 * Create a new record for the authenticated member.
 */
const createRecord = asyncHandler(async (req, res) => {
  const record = await service.createRecord(req.user.id, req.body);
  res.status(201).json(
    ApiResponse.created(record, FITNESS_RECORD_MESSAGES.CREATED)
  );
});

/**
 * GET /api/fitness-records/me
 * List records for the authenticated member.
 */
const listMyRecords = asyncHandler(async (req, res) => {
  const { records, total, page, limit } = await service.listMyRecords(
    req.user.id,
    req.query
  );

  res.json(
    ApiResponse.paginated(
      records,
      total,
      page,
      limit,
      FITNESS_RECORD_MESSAGES.LIST_FETCHED
    )
  );
});

/**
 * GET /api/fitness-records/me/latest
 * Return the latest record for the authenticated member.
 */
const getLatestRecord = asyncHandler(async (req, res) => {
  const record = await service.getLatestRecord(req.user.id);
  res.json(ApiResponse.success(record, FITNESS_RECORD_MESSAGES.LATEST_FETCHED));
});

/**
 * GET /api/fitness-records/me/progress
 * Analyze progress for the authenticated member.
 */
const getMyProgress = asyncHandler(async (req, res) => {
  const progress = await service.getProgress(req.user.id, req.query);
  res.json(ApiResponse.success(progress, FITNESS_RECORD_MESSAGES.PROGRESS_FETCHED));
});

/**
 * GET /api/fitness-records/:recordId
 * Return one record owned by the authenticated member.
 */
const getMyRecordById = asyncHandler(async (req, res) => {
  const record = await service.getMyRecordById(
    req.params.recordId,
    req.user.id
  );
  res.json(ApiResponse.success(record, FITNESS_RECORD_MESSAGES.FETCHED));
});

/**
 * PATCH /api/fitness-records/:recordId
 * Update one record owned by the authenticated member.
 */
const updateRecord = asyncHandler(async (req, res) => {
  const record = await service.updateRecord(
    req.params.recordId,
    req.user.id,
    req.body
  );
  res.json(ApiResponse.success(record, FITNESS_RECORD_MESSAGES.UPDATED));
});

/**
 * DELETE /api/fitness-records/:recordId
 * Delete one record owned by the authenticated member.
 */
const deleteRecord = asyncHandler(async (req, res) => {
  await service.deleteRecord(req.params.recordId, req.user.id);
  res.json(ApiResponse.success(null, FITNESS_RECORD_MESSAGES.DELETED));
});

/**
 * GET /api/fitness-records/admin
 * Admin lists records across all users.
 */
const listAllRecords = asyncHandler(async (req, res) => {
  const { records, total, page, limit } = await service.listAllRecords(req.query);

  res.json(
    ApiResponse.paginated(
      records,
      total,
      page,
      limit,
      FITNESS_RECORD_MESSAGES.LIST_FETCHED
    )
  );
});

/**
 * GET /api/fitness-records/admin/:recordId
 * Admin reads any record by ID.
 */
const getRecordById = asyncHandler(async (req, res) => {
  const record = await service.getRecordById(req.params.recordId);
  res.json(ApiResponse.success(record, FITNESS_RECORD_MESSAGES.FETCHED));
});

/**
 * GET /api/fitness-records/admin/users/:userId/progress
 * Admin analyzes progress for a specific user.
 */
const getUserProgress = asyncHandler(async (req, res) => {
  const progress = await service.getProgress(req.params.userId, req.query);
  res.json(ApiResponse.success(progress, FITNESS_RECORD_MESSAGES.PROGRESS_FETCHED));
});

module.exports = {
  createRecord,
  listMyRecords,
  getLatestRecord,
  getMyProgress,
  getMyRecordById,
  updateRecord,
  deleteRecord,
  listAllRecords,
  getRecordById,
  getUserProgress,
};
