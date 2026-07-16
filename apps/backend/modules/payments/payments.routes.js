/**
 * payments.routes.js
 * Registers all payment endpoints.
 *
 * Base path (mounted in app.js): /api/payments
 *
 * Member routes:
 *   POST  /api/payments/request                    — submit payment request  FR-25
 *   GET   /api/payments/me                         — own payment history     FR-26
 *
 * Admin routes:
 *   GET   /api/payments/admin                      — all transactions        FR-30
 *   GET   /api/payments/admin/revenue              — revenue report          FR-29
 *   POST  /api/payments/admin/:paymentId/confirm   — confirm → completed     FR-27
 *   POST  /api/payments/admin/:paymentId/reject    — reject  → failed
 *   POST  /api/payments/admin/:paymentId/refund    — refund  → refunded
 */

const router = require('express').Router();
const ctrl   = require('./payments.controller');

const { authenticate }  = require('../../middlewares/Auth.middleware');
const { requireRole }   = require('../../middlewares/Role.middleware');
const { validate }      = require('../../middlewares/Validate.middleware');
const {
  uuidParam,
  requestPaymentSchema,
  confirmPaymentSchema,
  rejectPaymentSchema,
  refundPaymentSchema,
  listPaymentsQuerySchema,
  myPaymentsQuerySchema,
} = require('./payments.validation');

// All payment routes require authentication
router.use(authenticate);

// ── Member routes ─────────────────────────────────────────────────────────────

router.post(
  '/request',
  validate(requestPaymentSchema),
  ctrl.requestPayment
);

router.get(
  '/me',
  validate(null, null, myPaymentsQuerySchema),
  ctrl.getMyPayments
);

// ── Admin routes ──────────────────────────────────────────────────────────────

router.get(
  '/admin',
  requireRole('admin'),
  validate(null, null, listPaymentsQuerySchema),
  ctrl.listAllPayments
);

router.get(
  '/admin/revenue',
  requireRole('admin'),
  ctrl.getRevenueSummary
);

router.post(
  '/admin/:paymentId/confirm',
  requireRole('admin'),
  validate(confirmPaymentSchema, uuidParam('paymentId')),
  ctrl.confirmPayment
);

router.post(
  '/admin/:paymentId/reject',
  requireRole('admin'),
  validate(rejectPaymentSchema, uuidParam('paymentId')),
  ctrl.rejectPayment
);

router.post(
  '/admin/:paymentId/refund',
  requireRole('admin'),
  validate(refundPaymentSchema, uuidParam('paymentId')),
  ctrl.refundPayment
);

module.exports = router;