/**
 * payments.controller.js
 * HTTP layer for the simplified payment module.
 * Parses req, calls service, sends res. Zero business logic.
 */

const service      = require('./payments.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse  = require('../../utils/ApiResponse');

// ─── Member routes ────────────────────────────────────────────────────────────

/**
 * POST /api/payments/request  (FR-25)
 * Member submits a payment request (banking or cash).
 * Payment starts as 'pending' until admin confirms or rejects.
 */
const requestPayment = asyncHandler(async (req, res) => {
  const { membership_id, provider, transfer_note } = req.body;
  const payment = await service.requestPayment(req.user.id, {
    membership_id,
    provider,
    transfer_note,
  });
  res.status(201).json(
    ApiResponse.created(
      payment,
      `Payment request submitted. An admin will ${provider === 'banking'
        ? 'verify your bank transfer'
        : 'confirm your cash payment'
      } shortly.`
    )
  );
});

/**
 * GET /api/payments/me  (FR-26)
 * Return the authenticated member's payment history.
 */
const getMyPayments = asyncHandler(async (req, res) => {
  const { payments, total, page, limit } =
    await service.getMyPayments(req.user.id, req.query);
  res.json(ApiResponse.paginated(payments, total, page, limit));
});

// ─── Admin routes ─────────────────────────────────────────────────────────────

/**
 * GET /api/payments/admin  (FR-30)
 * Admin lists all payment transactions with filters.
 */
const listAllPayments = asyncHandler(async (req, res) => {
  const { payments, total, page, limit } =
    await service.listAllPayments(req.query);
  res.json(ApiResponse.paginated(payments, total, page, limit));
});

/**
 * GET /api/payments/admin/revenue  (FR-29)
 * Admin views revenue report — completed payments only.
 */
const getRevenueSummary = asyncHandler(async (req, res) => {
  const summary = await service.getRevenueSummary(req.query);
  res.json(ApiResponse.success(summary));
});

/**
 * POST /api/payments/admin/:paymentId/confirm  (FR-27)
 * Admin confirms a pending payment → 'completed' + activates membership.
 */
const confirmPayment = asyncHandler(async (req, res) => {
  const payment = await service.confirmPayment(
    req.params.paymentId,
    req.user.id,
    req.body.note || null
  );
  res.json(ApiResponse.success(payment, 'Payment confirmed. Membership activated.'));
});

/**
 * POST /api/payments/admin/:paymentId/reject
 * Admin rejects a pending payment → 'failed'.
 */
const rejectPayment = asyncHandler(async (req, res) => {
  const payment = await service.rejectPayment(
    req.params.paymentId,
    req.user.id,
    req.body.reason
  );
  res.json(ApiResponse.success(payment, 'Payment rejected.'));
});

/**
 * POST /api/payments/admin/:paymentId/refund
 * Admin refunds a completed payment → 'refunded'.
 */
const refundPayment = asyncHandler(async (req, res) => {
  const payment = await service.refundPayment(
    req.params.paymentId,
    req.user.id,
    req.body.reason
  );
  res.json(ApiResponse.success(payment, 'Payment refunded.'));
});

module.exports = {
  requestPayment,
  getMyPayments,
  listAllPayments,
  getRevenueSummary,
  confirmPayment,
  rejectPayment,
  refundPayment,
};