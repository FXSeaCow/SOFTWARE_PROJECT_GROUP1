/**
 * payments.test.js
 * Integration tests for the simplified payment module.
 *
 * Run: npx jest --testPathPattern=modules/payments --runInBand --forceExit
 *
 * Flow under test:
 *   Member requests payment → pending
 *   Admin confirms          → completed + membership activated
 *   Admin rejects           → failed
 *   Admin refunds           → refunded
 *
 * Test groups:
 *   1.  POST /api/payments/request                   — submit request  FR-25
 *   2.  GET  /api/payments/me                        — own history     FR-26
 *   3.  GET  /api/payments/admin                     — all payments    FR-30
 *   4.  GET  /api/payments/admin/revenue             — revenue report  FR-29
 *   5.  POST /api/payments/admin/:id/confirm         — confirm         FR-27
 *   6.  POST /api/payments/admin/:id/reject          — reject
 *   7.  POST /api/payments/admin/:id/refund          — refund
 */

const request = require('supertest');
const app     = require('../../../app');
const db      = require('../../../config/db');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const registerAndLogin = async (overrides = {}) => {
  const userData = {
    full_name:        'Test Member',
    email:            'member@example.com',
    password:         'Password1',
    confirm_password: 'Password1',
    ...overrides,
  };
  const res = await request(app).post('/api/auth/register').send(userData);
  return { user: res.body.data.user, accessToken: res.body.data.accessToken };
};

const registerAndLoginAdmin = async () => {
  const { user } = await registerAndLogin({
    email: 'admin@example.com', full_name: 'Admin User',
  });
  await db.query(`UPDATE users SET role = 'admin' WHERE id = $1`, [user.id]);
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@example.com', password: 'Password1' });
  return { user: res.body.data.user, accessToken: res.body.data.accessToken };
};

const seedPlan = async (overrides = {}) => {
  const { rows } = await db.query(
    `INSERT INTO membership_plans (name, price, duration_days, is_active)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [
      overrides.name          || '1-Month Basic',
      overrides.price         ?? 299000,
      overrides.duration_days ?? 30,
      overrides.is_active     ?? true,
    ]
  );
  return rows[0];
};

const seedMembership = async (userId, planId, overrides = {}) => {
  const end    = overrides.end_date ||
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const status = overrides.status || 'active';
  const { rows } = await db.query(
    `INSERT INTO memberships (user_id, plan_id, start_date, end_date, status)
     VALUES ($1, $2, CURRENT_DATE, $3, $4) RETURNING *`,
    [userId, planId, end, status]
  );
  return rows[0];
};

/** Seed a payment directly for setup purposes */
const seedPayment = async (userId, membershipId, overrides = {}) => {
  const { rows } = await db.query(
    `INSERT INTO payments (user_id, membership_id, amount, provider, status, provider_tx_id, paid_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [
      userId,
      membershipId,
      overrides.amount       ?? 299000,
      overrides.provider     || 'cash',
      overrides.status       || 'pending',
      overrides.provider_tx_id || null,
      overrides.paid_at      || null,
    ]
  );
  return rows[0];
};

beforeEach(async () => {
  await truncateAll();
});

// =============================================================================
// 1. POST /api/payments/request  (FR-25)
// =============================================================================
describe('POST /api/payments/request', () => {

  it('should create a pending payment for a cash provider', async () => {
    const { user, accessToken } = await registerAndLogin();
    const plan       = await seedPlan();
    const membership = await seedMembership(user.id, plan.id);

    const res = await request(app)
      .post('/api/payments/request')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ membership_id: membership.id, provider: 'cash' });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      user_id:       user.id,
      membership_id: membership.id,
      status:        'pending',
      provider:      'cash',
    });
    expect(res.body.message).toMatch(/cash payment/i);
  });

  it('should create a pending payment for a banking provider with transfer_note', async () => {
    const { user, accessToken } = await registerAndLogin();
    const plan       = await seedPlan();
    const membership = await seedMembership(user.id, plan.id);

    const res = await request(app)
      .post('/api/payments/request')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        membership_id: membership.id,
        provider:      'banking',
        transfer_note: 'TXN-20260601-001',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.provider).toBe('banking');
    expect(res.body.data.status).toBe('pending');
    // transfer_note stored in provider_tx_id
    expect(res.body.data.provider_tx_id).toBe('TXN-20260601-001');
    expect(res.body.message).toMatch(/bank transfer/i);
  });

  it('should use the plan price as the payment amount', async () => {
    const { user, accessToken } = await registerAndLogin();
    const plan       = await seedPlan({ price: 350000 });
    const membership = await seedMembership(user.id, plan.id);

    const res = await request(app)
      .post('/api/payments/request')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ membership_id: membership.id, provider: 'cash' });

    expect(res.status).toBe(201);
    expect(parseFloat(res.body.data.amount)).toBe(350000);
  });

  it('should return 403 when member tries to pay for another user\'s membership', async () => {
    const { accessToken }        = await registerAndLogin();
    const { user: otherUser }    = await registerAndLogin({ email: 'other@example.com' });
    const plan       = await seedPlan();
    const membership = await seedMembership(otherUser.id, plan.id);

    const res = await request(app)
      .post('/api/payments/request')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ membership_id: membership.id, provider: 'cash' });

    expect(res.status).toBe(403);
  });

  it('should return 409 when membership already has a completed payment', async () => {
    const { user, accessToken } = await registerAndLogin();
    const plan       = await seedPlan();
    const membership = await seedMembership(user.id, plan.id);
    await seedPayment(user.id, membership.id, { status: 'completed', paid_at: new Date() });

    const res = await request(app)
      .post('/api/payments/request')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ membership_id: membership.id, provider: 'cash' });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already been paid/i);
  });

  it('should return 409 when a pending payment already exists for the membership', async () => {
    const { user, accessToken } = await registerAndLogin();
    const plan       = await seedPlan();
    const membership = await seedMembership(user.id, plan.id);
    await seedPayment(user.id, membership.id, { status: 'pending' });

    const res = await request(app)
      .post('/api/payments/request')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ membership_id: membership.id, provider: 'banking' });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already pending/i);
  });

  it('should return 404 when membership does not exist', async () => {
    const { accessToken } = await registerAndLogin();

    const res = await request(app)
      .post('/api/payments/request')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ membership_id: '00000000-0000-0000-0000-000000000000', provider: 'cash' });

    expect(res.status).toBe(404);
  });

  it('should return 400 for an invalid provider', async () => {
    const { user, accessToken } = await registerAndLogin();
    const plan       = await seedPlan();
    const membership = await seedMembership(user.id, plan.id);

    const res = await request(app)
      .post('/api/payments/request')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ membership_id: membership.id, provider: 'stripe' }); // not allowed

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'provider' }),
      ])
    );
  });

  it('should return 400 when membership_id is missing', async () => {
    const { accessToken } = await registerAndLogin();

    const res = await request(app)
      .post('/api/payments/request')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ provider: 'cash' });

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'membership_id' }),
      ])
    );
  });

  it('should return 401 without a token', async () => {
    const res = await request(app)
      .post('/api/payments/request')
      .send({ provider: 'cash' });
    expect(res.status).toBe(401);
  });
});


// =============================================================================
// 2. GET /api/payments/me  (FR-26)
// =============================================================================
describe('GET /api/payments/me', () => {

  it('should return own payment history', async () => {
    const { user, accessToken } = await registerAndLogin();
    const plan = await seedPlan();
    const m1   = await seedMembership(user.id, plan.id);
    const m2   = await seedMembership(user.id, plan.id);
    await seedPayment(user.id, m1.id, { status: 'completed', paid_at: new Date() });
    await seedPayment(user.id, m2.id, { status: 'pending' });

    const res = await request(app)
      .get('/api/payments/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
    expect(res.body.pagination).toBeDefined();
  });

  it('should include plan_name in each payment', async () => {
    const { user, accessToken } = await registerAndLogin();
    const plan       = await seedPlan({ name: '3-Month Gold' });
    const membership = await seedMembership(user.id, plan.id);
    await seedPayment(user.id, membership.id);

    const res = await request(app)
      .get('/api/payments/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data[0].plan_name).toBe('3-Month Gold');
  });

  it('should not return another member\'s payments', async () => {
    const { user: user1, accessToken } = await registerAndLogin();
    const { user: user2 }              = await registerAndLogin({ email: 'user2@example.com' });
    const plan = await seedPlan();
    const m1   = await seedMembership(user1.id, plan.id);
    const m2   = await seedMembership(user2.id, plan.id);
    await seedPayment(user1.id, m1.id);
    await seedPayment(user2.id, m2.id);

    const res = await request(app)
      .get('/api/payments/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
  });

  it('should return empty array when no payments exist', async () => {
    const { accessToken } = await registerAndLogin();

    const res = await request(app)
      .get('/api/payments/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('should return 401 without a token', async () => {
    const res = await request(app).get('/api/payments/me');
    expect(res.status).toBe(401);
  });
});


// =============================================================================
// 3. GET /api/payments/admin  (FR-30)
// =============================================================================
describe('GET /api/payments/admin', () => {

  it('should return paginated list of all payments with user and plan info', async () => {
    const { user: member } = await registerAndLogin();
    const plan       = await seedPlan();
    const membership = await seedMembership(member.id, plan.id);
    await seedPayment(member.id, membership.id, { status: 'pending' });

    const { accessToken } = await registerAndLoginAdmin();

    const res = await request(app)
      .get('/api/payments/admin')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0].user_name).toBeDefined();
    expect(res.body.data[0].user_email).toBeDefined();
    expect(res.body.data[0].plan_name).toBeDefined();
    expect(res.body.pagination).toBeDefined();
  });

  it('should filter by status=pending', async () => {
    const { user: member } = await registerAndLogin();
    const plan = await seedPlan();
    const m1   = await seedMembership(member.id, plan.id);
    const m2   = await seedMembership(member.id, plan.id);
    await seedPayment(member.id, m1.id, { status: 'pending' });
    await seedPayment(member.id, m2.id, { status: 'completed', paid_at: new Date() });

    const { accessToken } = await registerAndLoginAdmin();

    const res = await request(app)
      .get('/api/payments/admin?status=pending')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    res.body.data.forEach((p) => expect(p.status).toBe('pending'));
  });

  it('should filter by provider=banking', async () => {
    const { user: member } = await registerAndLogin();
    const plan = await seedPlan();
    const m1   = await seedMembership(member.id, plan.id);
    const m2   = await seedMembership(member.id, plan.id);
    await seedPayment(member.id, m1.id, { provider: 'banking' });
    await seedPayment(member.id, m2.id, { provider: 'cash' });

    const { accessToken } = await registerAndLoginAdmin();

    const res = await request(app)
      .get('/api/payments/admin?provider=banking')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    res.body.data.forEach((p) => expect(p.provider).toBe('banking'));
  });

  it('should return 403 for a regular member', async () => {
    const { accessToken } = await registerAndLogin();

    const res = await request(app)
      .get('/api/payments/admin')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(403);
  });
});


// =============================================================================
// 4. GET /api/payments/admin/revenue  (FR-29)
// =============================================================================
describe('GET /api/payments/admin/revenue', () => {

  it('should return daily revenue from completed payments only', async () => {
    const { user: member } = await registerAndLogin();
    const plan = await seedPlan({ price: 199000 });
    const m1   = await seedMembership(member.id, plan.id);
    const m2   = await seedMembership(member.id, plan.id);
    await seedPayment(member.id, m1.id, {
      status: 'completed', amount: 199000, paid_at: new Date(),
    });
    await seedPayment(member.id, m2.id, { status: 'pending' }); // excluded

    const { accessToken } = await registerAndLoginAdmin();

    const res = await request(app)
      .get('/api/payments/admin/revenue')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);

    const total = res.body.data.reduce(
      (sum, row) => sum + parseInt(row.transaction_count), 0
    );
    expect(total).toBe(1); // only completed counts
  });

  it('should return empty array when no completed payments', async () => {
    const { accessToken } = await registerAndLoginAdmin();

    const res = await request(app)
      .get('/api/payments/admin/revenue')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('should return 403 for a regular member', async () => {
    const { accessToken } = await registerAndLogin();
    const res = await request(app)
      .get('/api/payments/admin/revenue')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(403);
  });
});


// =============================================================================
// 5. POST /api/payments/admin/:paymentId/confirm  (FR-27)
// =============================================================================
describe('POST /api/payments/admin/:paymentId/confirm', () => {

  it('should confirm a pending payment → completed', async () => {
    const { user: member } = await registerAndLogin();
    const plan       = await seedPlan();
    const membership = await seedMembership(member.id, plan.id);
    const payment    = await seedPayment(member.id, membership.id, { status: 'pending' });

    const { accessToken } = await registerAndLoginAdmin();

    const res = await request(app)
      .post(`/api/payments/admin/${payment.id}/confirm`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ note: 'Cash received at front desk' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('completed');
    expect(res.body.message).toMatch(/membership activated/i);
  });

  it('should record who confirmed it in provider_tx_id', async () => {
    const { user: member } = await registerAndLogin();
    const plan       = await seedPlan();
    const membership = await seedMembership(member.id, plan.id);
    const payment    = await seedPayment(member.id, membership.id, { status: 'pending' });

    const { user: admin, accessToken } = await registerAndLoginAdmin();

    await request(app)
      .post(`/api/payments/admin/${payment.id}/confirm`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ note: 'Verified' });

    const { rows } = await db.query(
      `SELECT provider_tx_id FROM payments WHERE id = $1`, [payment.id]
    );
    expect(rows[0].provider_tx_id).toContain(admin.id);
    expect(rows[0].provider_tx_id).toContain('Verified');
  });

  it('should set paid_at timestamp on confirmation', async () => {
    const { user: member } = await registerAndLogin();
    const plan       = await seedPlan();
    const membership = await seedMembership(member.id, plan.id);
    const payment    = await seedPayment(member.id, membership.id, { status: 'pending' });
    const { accessToken } = await registerAndLoginAdmin();

    await request(app)
      .post(`/api/payments/admin/${payment.id}/confirm`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});

    const { rows } = await db.query(
      `SELECT paid_at FROM payments WHERE id = $1`, [payment.id]
    );
    expect(rows[0].paid_at).not.toBeNull();
  });

  it('should activate the membership after confirmation', async () => {
    const { user: member } = await registerAndLogin();
    const plan       = await seedPlan();
    // Start membership as pending (no payment yet)
    const membership = await seedMembership(member.id, plan.id, { status: 'suspended' });
    const payment    = await seedPayment(member.id, membership.id, { status: 'pending' });
    const { accessToken } = await registerAndLoginAdmin();

    await request(app)
      .post(`/api/payments/admin/${payment.id}/confirm`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});

    const { rows } = await db.query(
      `SELECT status FROM memberships WHERE id = $1`, [membership.id]
    );
    expect(rows[0].status).toBe('active');
  });

  it('should work without an optional note', async () => {
    const { user: member } = await registerAndLogin();
    const plan       = await seedPlan();
    const membership = await seedMembership(member.id, plan.id);
    const payment    = await seedPayment(member.id, membership.id, { status: 'pending' });
    const { accessToken } = await registerAndLoginAdmin();

    const res = await request(app)
      .post(`/api/payments/admin/${payment.id}/confirm`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({}); // no note

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('completed');
  });

  it('should return 400 when confirming a non-pending payment', async () => {
    const { user: member } = await registerAndLogin();
    const plan       = await seedPlan();
    const membership = await seedMembership(member.id, plan.id);
    const payment    = await seedPayment(member.id, membership.id, {
      status: 'completed', paid_at: new Date(),
    });
    const { accessToken } = await registerAndLoginAdmin();

    const res = await request(app)
      .post(`/api/payments/admin/${payment.id}/confirm`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/only pending payments/i);
  });

  it('should return 404 for a non-existent payment', async () => {
    const { accessToken } = await registerAndLoginAdmin();

    const res = await request(app)
      .post('/api/payments/admin/00000000-0000-0000-0000-000000000000/confirm')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});

    expect(res.status).toBe(404);
  });

  it('should return 403 for a regular member', async () => {
    const { user, accessToken } = await registerAndLogin();
    const plan       = await seedPlan();
    const membership = await seedMembership(user.id, plan.id);
    const payment    = await seedPayment(user.id, membership.id, { status: 'pending' });

    const res = await request(app)
      .post(`/api/payments/admin/${payment.id}/confirm`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});

    expect(res.status).toBe(403);
  });
});


// =============================================================================
// 6. POST /api/payments/admin/:paymentId/reject
// =============================================================================
describe('POST /api/payments/admin/:paymentId/reject', () => {

  it('should reject a pending payment → failed', async () => {
    const { user: member } = await registerAndLogin();
    const plan       = await seedPlan();
    const membership = await seedMembership(member.id, plan.id);
    const payment    = await seedPayment(member.id, membership.id, { status: 'pending' });
    const { accessToken } = await registerAndLoginAdmin();

    const res = await request(app)
      .post(`/api/payments/admin/${payment.id}/reject`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ reason: 'Transfer amount does not match' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('failed');
  });

  it('should record the rejection reason in provider_tx_id', async () => {
    const { user: member } = await registerAndLogin();
    const plan       = await seedPlan();
    const membership = await seedMembership(member.id, plan.id);
    const payment    = await seedPayment(member.id, membership.id, { status: 'pending' });
    const { user: admin, accessToken } = await registerAndLoginAdmin();

    await request(app)
      .post(`/api/payments/admin/${payment.id}/reject`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ reason: 'Wrong account number' });

    const { rows } = await db.query(
      `SELECT provider_tx_id FROM payments WHERE id = $1`, [payment.id]
    );
    expect(rows[0].provider_tx_id).toContain('Wrong account number');
    expect(rows[0].provider_tx_id).toContain(admin.id);
  });

  it('should notify the member with the rejection reason', async () => {
    const { user: member, accessToken: memberToken } = await registerAndLogin();
    const plan       = await seedPlan();
    const membership = await seedMembership(member.id, plan.id);
    const payment    = await seedPayment(member.id, membership.id, { status: 'pending' });
    const { accessToken: adminToken } = await registerAndLoginAdmin();
    const reason = 'Receipt image is unreadable';

    await request(app)
      .post(`/api/payments/admin/${payment.id}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason });

    const res = await request(app)
      .get('/api/notifications/me')
      .set('Authorization', `Bearer ${memberToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          user_id: member.id,
          type: 'membership',
          title: 'Payment rejected',
          is_read: false,
          body: expect.stringContaining(reason),
        }),
      ])
    );
  });

  it('should NOT activate the membership when payment is rejected', async () => {
    const { user: member } = await registerAndLogin();
    const plan       = await seedPlan();
    const membership = await seedMembership(member.id, plan.id, { status: 'suspended' });
    const payment    = await seedPayment(member.id, membership.id, { status: 'pending' });
    const { accessToken } = await registerAndLoginAdmin();

    await request(app)
      .post(`/api/payments/admin/${payment.id}/reject`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ reason: 'Invalid transfer' });

    const { rows } = await db.query(
      `SELECT status FROM memberships WHERE id = $1`, [membership.id]
    );
    expect(rows[0].status).toBe('suspended'); // unchanged
  });

  it('should allow member to submit a new payment after rejection', async () => {
    const { user: member, accessToken: memberToken } = await registerAndLogin();
    const plan       = await seedPlan();
    const membership = await seedMembership(member.id, plan.id);
    const payment    = await seedPayment(member.id, membership.id, { status: 'pending' });
    const { accessToken: adminToken } = await registerAndLoginAdmin();

    // Reject
    await request(app)
      .post(`/api/payments/admin/${payment.id}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Wrong amount' });

    // Member can now submit again
    const res = await request(app)
      .post('/api/payments/request')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ membership_id: membership.id, provider: 'banking', transfer_note: 'TXN-RETRY-001' });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('pending');
  });

  it('should return 400 when rejecting a non-pending payment', async () => {
    const { user: member } = await registerAndLogin();
    const plan       = await seedPlan();
    const membership = await seedMembership(member.id, plan.id);
    const payment    = await seedPayment(member.id, membership.id, {
      status: 'completed', paid_at: new Date(),
    });
    const { accessToken } = await registerAndLoginAdmin();

    const res = await request(app)
      .post(`/api/payments/admin/${payment.id}/reject`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ reason: 'Too late' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/only pending payments/i);
  });

  it('should return 400 when reason is missing', async () => {
    const { user: member } = await registerAndLogin();
    const plan       = await seedPlan();
    const membership = await seedMembership(member.id, plan.id);
    const payment    = await seedPayment(member.id, membership.id, { status: 'pending' });
    const { accessToken } = await registerAndLoginAdmin();

    const res = await request(app)
      .post(`/api/payments/admin/${payment.id}/reject`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({}); // no reason

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'reason' }),
      ])
    );
  });

  it('should return 404 for a non-existent payment', async () => {
    const { accessToken } = await registerAndLoginAdmin();

    const res = await request(app)
      .post('/api/payments/admin/00000000-0000-0000-0000-000000000000/reject')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ reason: 'Does not exist' });

    expect(res.status).toBe(404);
  });

  it('should return 403 for a regular member', async () => {
    const { user, accessToken } = await registerAndLogin();
    const plan       = await seedPlan();
    const membership = await seedMembership(user.id, plan.id);
    const payment    = await seedPayment(user.id, membership.id, { status: 'pending' });

    const res = await request(app)
      .post(`/api/payments/admin/${payment.id}/reject`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ reason: 'Self-rejection attempt' });

    expect(res.status).toBe(403);
  });
});


// =============================================================================
// 7. POST /api/payments/admin/:paymentId/refund
// =============================================================================
describe('POST /api/payments/admin/:paymentId/refund', () => {

  it('should refund a completed payment → refunded', async () => {
    const { user: member } = await registerAndLogin();
    const plan       = await seedPlan();
    const membership = await seedMembership(member.id, plan.id);
    const payment    = await seedPayment(member.id, membership.id, {
      status: 'completed', paid_at: new Date(),
    });
    const { accessToken } = await registerAndLoginAdmin();

    const res = await request(app)
      .post(`/api/payments/admin/${payment.id}/refund`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ reason: 'Member requested cancellation' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('refunded');
  });

  it('should record the refund reason in provider_tx_id', async () => {
    const { user: member } = await registerAndLogin();
    const plan       = await seedPlan();
    const membership = await seedMembership(member.id, plan.id);
    const payment    = await seedPayment(member.id, membership.id, {
      status: 'completed', paid_at: new Date(),
    });
    const { user: admin, accessToken } = await registerAndLoginAdmin();

    await request(app)
      .post(`/api/payments/admin/${payment.id}/refund`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ reason: 'Duplicate payment' });

    const { rows } = await db.query(
      `SELECT provider_tx_id FROM payments WHERE id = $1`, [payment.id]
    );
    expect(rows[0].provider_tx_id).toContain('Duplicate payment');
    expect(rows[0].provider_tx_id).toContain(admin.id);
  });

  it('should return 400 when refunding a pending payment', async () => {
    const { user: member } = await registerAndLogin();
    const plan       = await seedPlan();
    const membership = await seedMembership(member.id, plan.id);
    const payment    = await seedPayment(member.id, membership.id, { status: 'pending' });
    const { accessToken } = await registerAndLoginAdmin();

    const res = await request(app)
      .post(`/api/payments/admin/${payment.id}/refund`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ reason: 'Cannot refund pending' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/only completed payments/i);
  });

  it('should return 400 when refunding a failed payment', async () => {
    const { user: member } = await registerAndLogin();
    const plan       = await seedPlan();
    const membership = await seedMembership(member.id, plan.id);
    const payment    = await seedPayment(member.id, membership.id, { status: 'failed' });
    const { accessToken } = await registerAndLoginAdmin();

    const res = await request(app)
      .post(`/api/payments/admin/${payment.id}/refund`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ reason: 'Cannot refund failed' });

    expect(res.status).toBe(400);
  });

  it('should return 400 when reason is missing', async () => {
    const { user: member } = await registerAndLogin();
    const plan       = await seedPlan();
    const membership = await seedMembership(member.id, plan.id);
    const payment    = await seedPayment(member.id, membership.id, {
      status: 'completed', paid_at: new Date(),
    });
    const { accessToken } = await registerAndLoginAdmin();

    const res = await request(app)
      .post(`/api/payments/admin/${payment.id}/refund`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'reason' }),
      ])
    );
  });

  it('should return 404 for a non-existent payment', async () => {
    const { accessToken } = await registerAndLoginAdmin();

    const res = await request(app)
      .post('/api/payments/admin/00000000-0000-0000-0000-000000000000/refund')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ reason: 'Does not exist' });

    expect(res.status).toBe(404);
  });

  it('should return 403 for a regular member', async () => {
    const { user, accessToken } = await registerAndLogin();
    const plan       = await seedPlan();
    const membership = await seedMembership(user.id, plan.id);
    const payment    = await seedPayment(user.id, membership.id, {
      status: 'completed', paid_at: new Date(),
    });

    const res = await request(app)
      .post(`/api/payments/admin/${payment.id}/refund`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ reason: 'Self-refund attempt' });

    expect(res.status).toBe(403);
  });
});
