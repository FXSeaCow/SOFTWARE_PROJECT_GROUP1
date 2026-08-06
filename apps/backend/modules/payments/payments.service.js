/**
 * payments.service.js
 * Business logic for the simplified payment module.
 *
 * FR-25  member submits a payment request (banking or cash)
 * FR-26  member views payment history
 * FR-27  system records successful transactions (admin confirms)
 * FR-30  admin monitors payment transactions
 *
 * No webhook, no real gateway.
 * Both providers (banking, cash) go through admin confirmation.
 */

const repo                       = require('./payments.repository');
const membershipRepo             = require('../memberships/memberships.repository');
const { withTransaction }        = require('../../utils/Transaction');
const { parse: parsePagination } = require('../../utils/Pagination');
const ApiError                   = require('../../utils/Apierror');
const logger                     = require('../../utils/Logger');

// ─── FR-25: Member requests a payment ────────────────────────────────────────

/**
 * Member submits a payment request for a membership.
 * Creates a 'pending' payment record — admin must confirm or reject.
 *
 * Validations:
 *   - Membership must exist and belong to this member
 *   - No existing pending payment for the same membership
 *   - No already-completed payment for the same membership
 *
 * @param {string} userId
 * @param {{ membership_id, provider, transfer_note? }} data
 * @returns {Promise<object>} created payment
 */
const requestPayment = async (userId, { membership_id, provider, transfer_note }) => {
  // 1. Verify membership exists and belongs to member
  const membership = await membershipRepo.findById(membership_id);
  if (!membership)                       throw ApiError.notFound('Membership');
  if (membership.user_id !== userId)     throw ApiError.forbidden();

  // 2. Check for an existing completed payment
  const db = require('../../config/db');
  const { rows: completed } = await db.query(
    `SELECT id FROM payments WHERE membership_id = $1 AND status = 'completed'`,
    [membership_id]
  );
  if (completed.length > 0) {
    throw ApiError.conflict('This membership has already been paid for');
  }

  // 3. Check for an existing pending payment (avoid duplicate requests)
  const { rows: pending } = await db.query(
    `SELECT id FROM payments WHERE membership_id = $1 AND status = 'pending'`,
    [membership_id]
  );
  if (pending.length > 0) {
    throw ApiError.conflict(
      'A payment request for this membership is already pending admin confirmation'
    );
  }

  // 4. Create the pending payment
  const payment = await repo.createPayment({
    membership_id,
    user_id:       userId,
    amount:        membership.price,
    provider,
    transfer_note,
  });

  logger.info('Payment requested', {
    paymentId:    payment.id,
    userId,
    membershipId: membership_id,
    provider,
    amount:       payment.amount,
  });

  return payment;
};

// ─── Admin: confirm payment (FR-27) ──────────────────────────────────────────

/**
 * Admin confirms a pending payment.
 * Atomically: marks payment 'completed' + issues activation code for the membership.
 *
 * @param {string} paymentId
 * @param {string} adminId
 * @param {string|null} note
 * @returns {Promise<object>} confirmed payment
 */
const confirmPayment = async (paymentId, adminId, note) => {
  const payment = await repo.findById(paymentId);
  if (!payment)                         throw ApiError.notFound('Payment');
  if (payment.status !== 'pending') {
    throw ApiError.badRequest(
      `Only pending payments can be confirmed. Current status: '${payment.status}'`
    );
  }

  const confirmed = await withTransaction(async (client) => {
    // Mark payment completed
    const paid = await repo.markCompleted(paymentId, adminId, note, client);

    await client.query(
      `UPDATE memberships
       SET status = 'active',
           activated_at = now(),
           updated_at = now(),
           updated_by = $1
       WHERE id = $2`,
      [adminId, payment.membership_id]
    );

    return paid;
  });

  logger.info('Payment confirmed by admin', {
    paymentId,
    membershipId: payment.membership_id,
    adminId,
    amount:       payment.amount,
  });

  return confirmed;
};

// ─── Admin: reject payment ────────────────────────────────────────────────────

/**
 * Admin rejects a pending payment → status becomes 'failed'.
 * The membership stays as-is (not activated).
 * The member can then submit a new payment request if they wish.
 *
 * @param {string} paymentId
 * @param {string} adminId
 * @param {string} reason
 * @returns {Promise<object>} rejected payment
 */
const rejectPayment = async (paymentId, adminId, reason) => {
  const payment = await repo.findById(paymentId);
  if (!payment)                         throw ApiError.notFound('Payment');
  if (payment.status !== 'pending') {
    throw ApiError.badRequest(
      `Only pending payments can be rejected. Current status: '${payment.status}'`
    );
  }

  const rejected = await withTransaction(async (client) => {
    const rj = await repo.markFailed(paymentId, adminId, reason, client);

    // Deactivate the membership
    await client.query(
      `UPDATE memberships
      SET status = 'suspended', updated_at = now(), updated_by = $1
      WHERE id = $2`,
      [adminId, payment.membership_id]
    );

    return rj;
  });

  logger.info('Payment rejected by admin', { paymentId, adminId, reason });

  return rejected;
};

// ─── Admin: refund a completed payment ───────────────────────────────────────

/**
 * Admin refunds a completed payment → status becomes 'refunded'.
 * Does NOT automatically change the membership status — admin handles
 * that separately via the memberships module if needed.
 *
 * @param {string} paymentId
 * @param {string} adminId
 * @param {string} reason
 * @returns {Promise<object>}
 */
const refundPayment = async (paymentId, adminId, reason) => {
  const payment = await repo.findById(paymentId);
  if (!payment)                            throw ApiError.notFound('Payment');
  if (payment.status !== 'completed') {
    throw ApiError.badRequest('Only completed payments can be refunded');
  }

  const refunded = await withTransaction(async (client) => {
      
    const rf = await repo.markRefunded(paymentId, adminId, reason, client);

    // Deactivate the membership
    await client.query(
      `UPDATE memberships
       SET status = 'cancelled', updated_at = now(), updated_by = $1
       WHERE id = $2`,
      [adminId, payment.membership_id]
    );
    return rf;
  });

  logger.info('Payment refunded by admin', { paymentId, adminId, reason });

  return refunded;
};

// ─── FR-26: Member views own payment history ──────────────────────────────────

/**
 * @param {string} userId
 * @param {object} query - req.query
 * @returns {Promise<object>}
 */
const getMyPayments = async (userId, query) => {
  const { page, limit, offset } = parsePagination(query);
  const { rows, total } = await repo.findAllByUser(userId, { limit, offset });
  return { payments: rows, total, page, limit };
};

// ─── FR-30: Admin views all payments ─────────────────────────────────────────

/**
 * @param {object} query - req.query
 * @returns {Promise<object>}
 */
const listAllPayments = async (query) => {
  const { page, limit, offset } = parsePagination(query);
  const { rows, total } = await repo.findAll({
    status:    query.status,
    user_id:   query.user_id,
    provider:  query.provider,
    from_date: query.from_date,
    to_date:   query.to_date,
    limit,
    offset,
  });
  return { payments: rows, total, page, limit };
};

// ─── FR-29: Revenue summary ───────────────────────────────────────────────────

/**
 * @param {{ from_date?, to_date? }} query
 * @returns {Promise<object[]>}
 */
const getRevenueSummary = async (query) => {
  return repo.getRevenueSummary({
    from_date: query.from_date,
    to_date:   query.to_date,
  });
};

module.exports = {
  requestPayment,
  confirmPayment,
  rejectPayment,
  refundPayment,
  getMyPayments,
  listAllPayments,
  getRevenueSummary,
};
