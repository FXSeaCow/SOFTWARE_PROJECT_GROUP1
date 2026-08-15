/**
 * memberships.test.js
 * Integration tests for the memberships module.
 *
 * Run: npx jest --testPathPattern=modules/memberships --runInBand --forceExit
 *
 * Test groups:
 *   1.  GET  /api/memberships/plans               — list active plans
 *   2.  GET  /api/memberships/plans/:planId        — single plan
 *   3.  GET  /api/memberships/me                  — own membership (FR-04)
 *   4.  GET  /api/memberships/me/history          — membership history
 *   5.  POST /api/memberships/renew               — renew membership (FR-05)
 *   6.  GET  /api/memberships/admin               — list all (FR-28)
 *   7.  POST /api/memberships/admin               — admin create (FR-06)
 *   8.  GET  /api/memberships/admin/plans         — all plans
 *   9.  POST /api/memberships/admin/plans         — create plan
 *   10. PATCH /api/memberships/admin/plans/:id    — update plan
 *   11. PATCH /api/memberships/admin/:id/status   — update status (FR-06)
 *   12. POST /api/memberships/admin/expire-overdue
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
    email:     'admin@example.com',
    full_name: 'Admin User',
  });
  await db.query(`UPDATE users SET role = 'admin' WHERE id = $1`, [user.id]);
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@example.com', password: 'Password1' });
  return { user: res.body.data.user, accessToken: res.body.data.accessToken };
};

/**
 * Seed a membership plan directly into the DB and return it.
 */
const seedPlan = async (overrides = {}) => {
  const { rows } = await db.query(
    `INSERT INTO membership_plans (name, description, price, duration_days, is_active)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      overrides.name          || '1-Month Basic',
      overrides.description   || 'Basic plan',
      overrides.price         ?? 299000,
      overrides.duration_days ?? 30,
      overrides.is_active     ?? true,
    ]
  );
  return rows[0];
};

/**
 * Seed an active membership for a user directly into the DB.
 */
const seedMembership = async (userId, planId, overrides = {}) => {
  const startDate = overrides.start_date || new Date().toISOString().slice(0, 10);
  const endDate   = overrides.end_date   ||
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const status    = overrides.status || 'active';

  const { rows } = await db.query(
    `INSERT INTO memberships (user_id, plan_id, start_date, end_date, status)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [userId, planId, startDate, endDate, status]
  );
  return rows[0];
};

beforeEach(async () => {
  await global.truncateAll();
});

// =============================================================================
// 1. GET /api/memberships/plans
// =============================================================================
describe('GET /api/memberships/plans', () => {

  it('should return only active plans', async () => {
    await seedPlan({ name: 'Active Plan',   is_active: true });
    await seedPlan({ name: 'Inactive Plan', is_active: false });

    const { accessToken } = await registerAndLogin();
    const res = await request(app)
      .get('/api/memberships/plans')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].name).toBe('Active Plan');
  });

  it('should return plans sorted by price ascending', async () => {
    await seedPlan({ name: 'Expensive', price: 500000 });
    await seedPlan({ name: 'Cheap',     price: 100000 });

    const { accessToken } = await registerAndLogin();
    const res = await request(app)
      .get('/api/memberships/plans')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data[0].name).toBe('Cheap');
    expect(res.body.data[1].name).toBe('Expensive');
  });

  it('should return empty array when no active plans exist', async () => {
    const { accessToken } = await registerAndLogin();
    const res = await request(app)
      .get('/api/memberships/plans')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('should return 401 without a token', async () => {
    const res = await request(app).get('/api/memberships/plans');
    expect(res.status).toBe(401);
  });
});


// =============================================================================
// 2. GET /api/memberships/plans/:planId
// =============================================================================
describe('GET /api/memberships/plans/:planId', () => {

  it('should return a plan by ID', async () => {
    const plan = await seedPlan({ name: '3-Month Premium' });
    const { accessToken } = await registerAndLogin();

    const res = await request(app)
      .get(`/api/memberships/plans/${plan.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(plan.id);
    expect(res.body.data.name).toBe('3-Month Premium');
  });

  it('should return 404 for a non-existent plan', async () => {
    const { accessToken } = await registerAndLogin();

    const res = await request(app)
      .get('/api/memberships/plans/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(404);
  });

  it('should return 400 for an invalid UUID', async () => {
    const { accessToken } = await registerAndLogin();

    const res = await request(app)
      .get('/api/memberships/plans/not-a-uuid')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(400);
  });
});


// =============================================================================
// 3. GET /api/memberships/me  (FR-04)
// =============================================================================
describe('GET /api/memberships/me', () => {

  it('should return active membership with days_remaining and expiring_soon', async () => {
    const { user, accessToken } = await registerAndLogin();
    const plan = await seedPlan();
    await seedMembership(user.id, plan.id);

    const res = await request(app)
      .get('/api/memberships/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      user_id:    user.id,
      status:     'active',
      plan_name:  '1-Month Basic',
    });
    expect(typeof res.body.data.days_remaining).toBe('number');
    expect(res.body.data.days_remaining).toBeGreaterThan(0);
    expect(typeof res.body.data.expiring_soon).toBe('boolean');
  });

  it('should return expiring_soon = true when membership ends within 7 days', async () => {
    const { user, accessToken } = await registerAndLogin();
    const plan = await seedPlan();

    const tomorrow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
      .toISOString().slice(0, 10);
    await seedMembership(user.id, plan.id, { end_date: tomorrow });

    const res = await request(app)
      .get('/api/memberships/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.expiring_soon).toBe(true);
  });

  it('should return 404 when user has no active membership', async () => {
    const { accessToken } = await registerAndLogin();

    const res = await request(app)
      .get('/api/memberships/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(404);
  });

  it('should return 404 for expired membership', async () => {
    const { user, accessToken } = await registerAndLogin();
    const plan = await seedPlan();

    const yesterday = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      .toISOString().slice(0, 10);
    await seedMembership(user.id, plan.id, { end_date: yesterday });

    const res = await request(app)
      .get('/api/memberships/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(404);
  });

  it('should return 401 without a token', async () => {
    const res = await request(app).get('/api/memberships/me');
    expect(res.status).toBe(401);
  });
});


// =============================================================================
// 4. GET /api/memberships/me/history
// =============================================================================
describe('GET /api/memberships/me/history', () => {

  it('should return all memberships for the user', async () => {
    const { user, accessToken } = await registerAndLogin();
    const plan = await seedPlan();

    await seedMembership(user.id, plan.id, { status: 'expired' });
    await seedMembership(user.id, plan.id, { status: 'active' });

    const res = await request(app)
      .get('/api/memberships/me/history')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
  });

  it('should return empty array when user has no membership history', async () => {
    const { accessToken } = await registerAndLogin();

    const res = await request(app)
      .get('/api/memberships/me/history')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});


// =============================================================================
// 5. POST /api/memberships/renew  (FR-05)
// =============================================================================
describe('POST /api/memberships/renew', () => {

  it('should create a new suspended membership for a user without one (Wait for admin to confirm payment to activate membership)', async () => {
    const { user, accessToken } = await registerAndLogin();
    const plan = await seedPlan({ duration_days: 30 });

    const res = await request(app)
      .post('/api/memberships/renew')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ plan_id: plan.id });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      user_id:   user.id,
      plan_id:   plan.id,
      status:    'suspended',
    });

    // Confirm in DB
    const { rows } = await db.query(
      `SELECT * FROM memberships WHERE user_id = $1 AND status = 'suspended'`,
      [user.id]
    );
    expect(rows).toHaveLength(1);
  });

  it('should stack new membership on top of existing active one', async () => {
    const { user, accessToken } = await registerAndLogin();
    const plan = await seedPlan({ duration_days: 30 });

    const existingEnd = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)
      .toISOString().slice(0, 10);
    await seedMembership(user.id, plan.id, { end_date: existingEnd });

    const res = await request(app)
      .post('/api/memberships/renew')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ plan_id: plan.id });

    expect(res.status).toBe(201);

    // New membership should start from current end_date
    const receivedStartDate = res.body.data.start_date.slice(0, 10);
    expect(receivedStartDate).toBe(existingEnd);
  });

  it('should return 404 when plan does not exist', async () => {
    const { accessToken } = await registerAndLogin();

    const res = await request(app)
      .post('/api/memberships/renew')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ plan_id: '00000000-0000-0000-0000-000000000000' });

    expect(res.status).toBe(404);
  });

  it('should return 400 when plan is inactive', async () => {
    const { accessToken } = await registerAndLogin();
    const plan = await seedPlan({ is_active: false });

    const res = await request(app)
      .post('/api/memberships/renew')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ plan_id: plan.id });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/no longer available/i);
  });

  it('should return 400 when plan_id is missing', async () => {
    const { accessToken } = await registerAndLogin();

    const res = await request(app)
      .post('/api/memberships/renew')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'plan_id' }),
      ])
    );
  });
});


// =============================================================================
// 6. GET /api/memberships/admin  (FR-28)
// =============================================================================
describe('GET /api/memberships/admin', () => {

  it('should return paginated list of all memberships', async () => {
    const { user: member } = await registerAndLogin();
    const plan = await seedPlan();
    await seedMembership(member.id, plan.id);

    const { accessToken } = await registerAndLoginAdmin();

    const res = await request(app)
      .get('/api/memberships/admin')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.pagination).toBeDefined();
  });

  it('should filter by status', async () => {
    const { user: member } = await registerAndLogin();
    const plan = await seedPlan();
    await seedMembership(member.id, plan.id, { status: 'active' });
    await seedMembership(member.id, plan.id, { status: 'suspended' });

    const { accessToken } = await registerAndLoginAdmin();

    const res = await request(app)
      .get('/api/memberships/admin?status=suspended')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    res.body.data.forEach((m) => expect(m.status).toBe('suspended'));
  });

  it('should filter memberships expiring within N days', async () => {
    const { user: member } = await registerAndLogin();
    const plan = await seedPlan();

    const soon = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
      .toISOString().slice(0, 10);
    const later = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
      .toISOString().slice(0, 10);

    await seedMembership(member.id, plan.id, { end_date: soon });
    await seedMembership(member.id, plan.id, { end_date: later });

    const { accessToken } = await registerAndLoginAdmin();

    const res = await request(app)
      .get('/api/memberships/admin?expiring_within_days=7')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
  });

  it('should include user name and email in results', async () => {
    const { user: member } = await registerAndLogin();
    const plan = await seedPlan();
    await seedMembership(member.id, plan.id);

    const { accessToken } = await registerAndLoginAdmin();

    const res = await request(app)
      .get('/api/memberships/admin')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.body.data[0].user_name).toBeDefined();
    expect(res.body.data[0].user_email).toBeDefined();
  });

  it('should return 403 for a regular member', async () => {
    const { accessToken } = await registerAndLogin();

    const res = await request(app)
      .get('/api/memberships/admin')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(403);
  });
});


// =============================================================================
// 7. POST /api/memberships/admin  (FR-06)
// =============================================================================
describe('POST /api/memberships/admin', () => {

  it('should create a membership for a user', async () => {
    const { user: member } = await registerAndLogin();
    const plan = await seedPlan({ duration_days: 30 });
    const { accessToken } = await registerAndLoginAdmin();

    const res = await request(app)
      .post('/api/memberships/admin')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ user_id: member.id, plan_id: plan.id });

    expect(res.status).toBe(201);
    expect(res.body.data.user_id).toBe(member.id);
    expect(res.body.data.status).toBe('active');
  });

  it('should calculate end_date correctly from duration_days', async () => {
    const { user: member } = await registerAndLogin();
    const plan = await seedPlan({ duration_days: 30 });
    const { accessToken } = await registerAndLoginAdmin();

    const startDate = '2026-01-01';
    const res = await request(app)
      .post('/api/memberships/admin')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ user_id: member.id, plan_id: plan.id, start_date: startDate });

    expect(res.status).toBe(201);
    expect(res.body.data.start_date).toBe('2026-01-01');
    expect(res.body.data.end_date).toBe('2026-01-31');
  });

  it('should return 400 for missing user_id', async () => {
    const plan = await seedPlan();
    const { accessToken } = await registerAndLoginAdmin();

    const res = await request(app)
      .post('/api/memberships/admin')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ plan_id: plan.id });

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'user_id' }),
      ])
    );
  });

  it('should return 403 for a regular member', async () => {
    const { user, accessToken } = await registerAndLogin();
    const plan = await seedPlan();

    const res = await request(app)
      .post('/api/memberships/admin')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ user_id: user.id, plan_id: plan.id });

    expect(res.status).toBe(403);
  });
});


// =============================================================================
// 8. GET /api/memberships/admin/plans
// =============================================================================
describe('GET /api/memberships/admin/plans', () => {

  it('should return all plans including inactive', async () => {
    await seedPlan({ name: 'Active',   is_active: true });
    await seedPlan({ name: 'Inactive', is_active: false });

    const { accessToken } = await registerAndLoginAdmin();

    const res = await request(app)
      .get('/api/memberships/admin/plans')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
    expect(res.body.data.some((p) => p.is_active === false)).toBe(true);
  });

  it('should return 403 for a regular member', async () => {
    const { accessToken } = await registerAndLogin();
    const res = await request(app)
      .get('/api/memberships/admin/plans')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(403);
  });
});


// =============================================================================
// 9. POST /api/memberships/admin/plans
// =============================================================================
describe('POST /api/memberships/admin/plans', () => {

  it('should create a new plan successfully', async () => {
    const { accessToken } = await registerAndLoginAdmin();

    const res = await request(app)
      .post('/api/memberships/admin/plans')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name:          '6-Month Premium',
        description:   'Best value plan',
        price:         999000,
        duration_days: 180,
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      name:          '6-Month Premium',
      price:         '999000.00',
      duration_days: 180,
      is_active:     true,
    });
  });

  it('should return 400 when required fields are missing', async () => {
    const { accessToken } = await registerAndLoginAdmin();

    const res = await request(app)
      .post('/api/memberships/admin/plans')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Incomplete Plan' }); // missing price and duration_days

    expect(res.status).toBe(400);
    expect(res.body.errors.length).toBeGreaterThanOrEqual(2);
  });

  it('should return 400 for a negative price', async () => {
    const { accessToken } = await registerAndLoginAdmin();

    const res = await request(app)
      .post('/api/memberships/admin/plans')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Bad Plan', price: -100, duration_days: 30 });

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'price' }),
      ])
    );
  });

  it('should return 403 for a regular member', async () => {
    const { accessToken } = await registerAndLogin();

    const res = await request(app)
      .post('/api/memberships/admin/plans')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Plan', price: 100000, duration_days: 30 });

    expect(res.status).toBe(403);
  });
});


// =============================================================================
// 10. PATCH /api/memberships/admin/plans/:planId
// =============================================================================
describe('PATCH /api/memberships/admin/plans/:planId', () => {

  it('should update plan name and price', async () => {
    const plan = await seedPlan({ name: 'Old Name', price: 100000 });
    const { accessToken } = await registerAndLoginAdmin();

    const res = await request(app)
      .patch(`/api/memberships/admin/plans/${plan.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'New Name', price: 200000 });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('New Name');
    expect(parseFloat(res.body.data.price)).toBe(200000);
  });

  it('should deactivate a plan by setting is_active = false', async () => {
    const plan = await seedPlan({ is_active: true });
    const { accessToken } = await registerAndLoginAdmin();

    const res = await request(app)
      .patch(`/api/memberships/admin/plans/${plan.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ is_active: false });

    expect(res.status).toBe(200);
    expect(res.body.data.is_active).toBe(false);
  });

  it('should return 404 for a non-existent plan', async () => {
    const { accessToken } = await registerAndLoginAdmin();

    const res = await request(app)
      .patch('/api/memberships/admin/plans/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'New Name' });

    expect(res.status).toBe(404);
  });

  it('should return 400 when body is empty', async () => {
    const plan = await seedPlan();
    const { accessToken } = await registerAndLoginAdmin();

    const res = await request(app)
      .patch(`/api/memberships/admin/plans/${plan.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});

    expect(res.status).toBe(400);
  });
});


// =============================================================================
// 11. PATCH /api/memberships/admin/:membershipId/status  (FR-06)
// =============================================================================
describe('PATCH /api/memberships/admin/:membershipId/status', () => {

  it('should suspend an active membership', async () => {
    const { user: member } = await registerAndLogin();
    const plan = await seedPlan();
    const membership = await seedMembership(member.id, plan.id);
    const { accessToken } = await registerAndLoginAdmin();

    const res = await request(app)
      .patch(`/api/memberships/admin/${membership.id}/status`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ status: 'suspended' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('suspended');
  });

  it('should cancel a membership', async () => {
    const { user: member } = await registerAndLogin();
    const plan = await seedPlan();
    const membership = await seedMembership(member.id, plan.id);
    const { accessToken } = await registerAndLoginAdmin();

    const res = await request(app)
      .patch(`/api/memberships/admin/${membership.id}/status`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ status: 'cancelled' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('cancelled');
  });

  it('should suspend all active stacked memberships for the same user', async () => {
    const { user: member } = await registerAndLogin();
    const plan = await seedPlan();
    const firstMembership = await seedMembership(member.id, plan.id);
    const secondMembership = await seedMembership(member.id, plan.id);
    const { accessToken } = await registerAndLoginAdmin();

    const res = await request(app)
      .patch(`/api/memberships/admin/${secondMembership.id}/status`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ status: 'suspended' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('suspended');

    const { rows } = await db.query(
      `SELECT id, status FROM memberships WHERE user_id = $1 ORDER BY created_at ASC`,
      [member.id]
    );
    expect(rows).toHaveLength(2);
    rows.forEach((row) => expect(row.status).toBe('suspended'));
    expect(rows.some((row) => row.id === firstMembership.id)).toBe(true);
    expect(rows.some((row) => row.id === secondMembership.id)).toBe(true);
  });

  it('should re-activate a suspended membership', async () => {
    const { user: member } = await registerAndLogin();
    const plan = await seedPlan();
    const membership = await seedMembership(member.id, plan.id, { status: 'suspended' });
    const { accessToken } = await registerAndLoginAdmin();

    const res = await request(app)
      .patch(`/api/memberships/admin/${membership.id}/status`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ status: 'active' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('active');
  });

  it('should return 400 when trying to re-activate an expired membership', async () => {
    const { user: member } = await registerAndLogin();
    const plan = await seedPlan();
    const yesterday = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      .toISOString().slice(0, 10);
    const membership = await seedMembership(member.id, plan.id, {
      end_date: yesterday,
      status:   'expired',
    });
    const { accessToken } = await registerAndLoginAdmin();

    const res = await request(app)
      .patch(`/api/memberships/admin/${membership.id}/status`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ status: 'active' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/cannot be re-activated/i);
  });

  it('should return 400 for an invalid status value', async () => {
    const { user: member } = await registerAndLogin();
    const plan = await seedPlan();
    const membership = await seedMembership(member.id, plan.id);
    const { accessToken } = await registerAndLoginAdmin();

    const res = await request(app)
      .patch(`/api/memberships/admin/${membership.id}/status`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ status: 'deleted' }); // not a valid enum value

    expect(res.status).toBe(400);
  });

  it('should return 404 for a non-existent membership', async () => {
    const { accessToken } = await registerAndLoginAdmin();

    const res = await request(app)
      .patch('/api/memberships/admin/00000000-0000-0000-0000-000000000000/status')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ status: 'suspended' });

    expect(res.status).toBe(404);
  });

  it('should return 403 for a regular member', async () => {
    const { user, accessToken } = await registerAndLogin();
    const plan = await seedPlan();
    const membership = await seedMembership(user.id, plan.id);

    const res = await request(app)
      .patch(`/api/memberships/admin/${membership.id}/status`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ status: 'suspended' });

    expect(res.status).toBe(403);
  });
});


// =============================================================================
// 12. POST /api/memberships/admin/expire-overdue
// =============================================================================
describe('POST /api/memberships/admin/expire-overdue', () => {

  it('should expire overdue active memberships', async () => {
    const { user: member } = await registerAndLogin();
    const plan = await seedPlan();

    // Membership that has already passed its end_date but still marked 'active'
    const pastDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
      .toISOString().slice(0, 10);
    const membership = await seedMembership(member.id, plan.id, {
      end_date: pastDate,
      status:   'active',
    });

    const { accessToken } = await registerAndLoginAdmin();
    const res = await request(app)
      .post('/api/memberships/admin/expire-overdue')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.expired_count).toBeGreaterThanOrEqual(1);

    // Confirm status updated in DB
    const { rows } = await db.query(
      `SELECT status FROM memberships WHERE id = $1`,
      [membership.id]
    );
    expect(rows[0].status).toBe('expired');
  });

  it('should return 0 when no memberships are overdue', async () => {
    const { accessToken } = await registerAndLoginAdmin();

    const res = await request(app)
      .post('/api/memberships/admin/expire-overdue')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.expired_count).toBe(0);
  });

  it('should return 403 for a regular member', async () => {
    const { accessToken } = await registerAndLogin();

    const res = await request(app)
      .post('/api/memberships/admin/expire-overdue')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(403);
  });
});
