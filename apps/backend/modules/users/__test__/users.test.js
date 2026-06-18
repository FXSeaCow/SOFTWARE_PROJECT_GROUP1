/**
 * users.test.js
 * Integration tests for the users module.
 *
 * Run: npx jest --testPathPattern=modules/users --runInBand --forceExit
 *
 * Test groups:
 *   1. GET    /api/users/me
 *   2. PATCH  /api/users/me
 *   3. PATCH  /api/users/me/password
 *   4. GET    /api/users/me/qr
 *   5. POST   /api/users/me/qr/regenerate
 *   6. GET    /api/users             [admin]
 *   7. GET    /api/users/:userId     [admin]
 *   8. DELETE /api/users/:userId     [admin]
 */

const request = require('supertest');
const app     = require('../../../app');
const db      = require('../../../config/db');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const registerAndLogin = async (overrides = {}) => {
  const userData = {
    full_name:        'Nguyen Van A',
    email:            'member@example.com',
    password:         'Password1',
    confirm_password: 'Password1',
    phone:            '0901234567',
    ...overrides,
  };

  const regRes = await request(app)
    .post('/api/auth/register')
    .send(userData);

  return {
    user:        regRes.body.data.user,
    accessToken: regRes.body.data.accessToken,
    password:    userData.password,
  };
};

const registerAndLoginAdmin = async () => {
  // Register a normal user first, then manually promote to admin
  const { user, accessToken } = await registerAndLogin({
    email: 'admin@example.com',
    full_name: 'Admin User',
  });

  await db.query(
    `UPDATE users SET role = 'admin' WHERE id = $1`,
    [user.id]
  );

  // Re-login to get an admin-role token
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@example.com', password: 'Password1' });

  return {
    user:        loginRes.body.data.user,
    accessToken: loginRes.body.data.accessToken,
  };
};

// ─── Reset DB between every test ─────────────────────────────────────────────
beforeEach(async () => {
  await global.truncateAll();
});

// =============================================================================
// 1. GET /api/users/me
// =============================================================================
describe('GET /api/users/me', () => {

  it('should return the authenticated user profile', async () => {
    const { user, accessToken } = await registerAndLogin();

    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      id:        user.id,
      email:     'member@example.com',
      full_name: 'Nguyen Van A',
      role:      'member',
    });
  });

  it('should include phone in the profile', async () => {
    const { accessToken } = await registerAndLogin();

    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.body.data.phone).toBe('0901234567');
  });

  it('should never expose password_hash', async () => {
    const { accessToken } = await registerAndLogin();

    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.body.data.password_hash).toBeUndefined();
  });

  it('should return 401 when no token is provided', async () => {
    const res = await request(app).get('/api/users/me');

    expect(res.status).toBe(401);
  });
});


// =============================================================================
// 2. PATCH /api/users/me
// =============================================================================
describe('PATCH /api/users/me', () => {

  it('should update full_name successfully', async () => {
    const { accessToken } = await registerAndLogin();

    const res = await request(app)
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ full_name: 'Nguyen Van B' });

    expect(res.status).toBe(200);
    expect(res.body.data.full_name).toBe('Nguyen Van B');
  });

  it('should update phone successfully', async () => {
    const { accessToken } = await registerAndLogin();

    const res = await request(app)
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ phone: '0909999999' });

    expect(res.status).toBe(200);
    expect(res.body.data.phone).toBe('0909999999');
  });

  it('should update both full_name and phone in one request', async () => {
    const { accessToken } = await registerAndLogin();

    const res = await request(app)
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ full_name: 'Tran Thi B', phone: '0912345678' });

    expect(res.status).toBe(200);
    expect(res.body.data.full_name).toBe('Tran Thi B');
    expect(res.body.data.phone).toBe('0912345678');
  });

  it('should allow clearing phone by sending null', async () => {
    const { accessToken } = await registerAndLogin();

    const res = await request(app)
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ phone: null });

    expect(res.status).toBe(200);
    expect(res.body.data.phone).toBeNull();
  });

  it('should return 400 when body is empty', async () => {
    const { accessToken } = await registerAndLogin();

    const res = await request(app)
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('should return 400 for invalid phone format', async () => {
    const { accessToken } = await registerAndLogin();

    const res = await request(app)
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ phone: 'not-a-phone' });

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'phone' }),
      ])
    );
  });

  it('should return 400 for full_name shorter than 2 chars', async () => {
    const { accessToken } = await registerAndLogin();

    const res = await request(app)
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ full_name: 'A' });

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'full_name' }),
      ])
    );
  });

  it('should not allow updating email via this endpoint (stripped by Joi)', async () => {
    const { accessToken } = await registerAndLogin();

    const res = await request(app)
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ full_name: 'Valid Name', email: 'hacker@example.com' });

    // Joi strips unknown fields, so email is ignored
    // but full_name update should succeed
    expect(res.status).toBe(200);

    // Email unchanged in DB
    const { rows } = await db.query(
      `SELECT email FROM users WHERE email = 'hacker@example.com'`
    );
    expect(rows).toHaveLength(0);
  });

  it('should return 401 without a token', async () => {
    const res = await request(app)
      .patch('/api/users/me')
      .send({ full_name: 'Someone' });

    expect(res.status).toBe(401);
  });
});


// =============================================================================
// 3. PATCH /api/users/me/password
// =============================================================================
describe('PATCH /api/users/me/password', () => {

  it('should change password successfully with correct current password', async () => {
    const { accessToken } = await registerAndLogin();

    const res = await request(app)
      .patch('/api/users/me/password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        current_password:    'Password1',
        new_password:        'NewPassword2',
        confirm_new_password: 'NewPassword2',
      });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/password changed/i);
  });

  it('should allow login with new password after change', async () => {
    const { accessToken } = await registerAndLogin();

    await request(app)
      .patch('/api/users/me/password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        current_password:    'Password1',
        new_password:        'NewPassword2',
        confirm_new_password: 'NewPassword2',
      });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'member@example.com', password: 'NewPassword2' });

    expect(loginRes.status).toBe(200);
  });

  it('should block login with old password after change', async () => {
    const { accessToken } = await registerAndLogin();

    await request(app)
      .patch('/api/users/me/password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        current_password:    'Password1',
        new_password:        'NewPassword2',
        confirm_new_password: 'NewPassword2',
      });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'member@example.com', password: 'Password1' });

    expect(loginRes.status).toBe(401);
  });

  it('should return 400 when current password is wrong', async () => {
    const { accessToken } = await registerAndLogin();

    const res = await request(app)
      .patch('/api/users/me/password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        current_password:    'WrongPassword1',
        new_password:        'NewPassword2',
        confirm_new_password: 'NewPassword2',
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/current password is incorrect/i);
  });

  it('should return 400 when new password is the same as current', async () => {
    const { accessToken } = await registerAndLogin();

    const res = await request(app)
      .patch('/api/users/me/password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        current_password:    'Password1',
        new_password:        'Password1',
        confirm_new_password: 'Password1',
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/must be different/i);
  });

  it('should return 400 when new passwords do not match', async () => {
    const { accessToken } = await registerAndLogin();

    const res = await request(app)
      .patch('/api/users/me/password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        current_password:    'Password1',
        new_password:        'NewPassword2',
        confirm_new_password: 'DifferentPass2',
      });

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'confirm_new_password' }),
      ])
    );
  });

  it('should return 400 when new password is too weak', async () => {
    const { accessToken } = await registerAndLogin();

    const res = await request(app)
      .patch('/api/users/me/password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        current_password:    'Password1',
        new_password:        'weakpassword',
        confirm_new_password: 'weakpassword',
      });

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'new_password' }),
      ])
    );
  });
});


// =============================================================================
// 4. GET /api/users/me/qr
// =============================================================================
describe('GET /api/users/me/qr', () => {

  it('should return a base64 QR code data URL', async () => {
    const { accessToken } = await registerAndLogin();

    const res = await request(app)
      .get('/api/users/me/qr')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.qrCode).toBeDefined();
    expect(res.body.data.qrCode).toMatch(/^data:image\/png;base64,/);
  });

  it('should return 401 without a token', async () => {
    const res = await request(app).get('/api/users/me/qr');
    expect(res.status).toBe(401);
  });
});


// =============================================================================
// 5. POST /api/users/me/qr/regenerate
// =============================================================================
describe('POST /api/users/me/qr/regenerate', () => {

  it('should return a new QR code and invalidate the old one', async () => {
    const { user, accessToken } = await registerAndLogin();

    // Get original QR
    const qr1Res = await request(app)
      .get('/api/users/me/qr')
      .set('Authorization', `Bearer ${accessToken}`);
    const originalQr = qr1Res.body.data.qrCode;

    // Regenerate
    const regenRes = await request(app)
      .post('/api/users/me/qr/regenerate')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(regenRes.status).toBe(200);
    expect(regenRes.body.data.qrCode).toBeDefined();
    expect(regenRes.body.data.qrCode).toMatch(/^data:image\/png;base64,/);

    // New QR is different
    expect(regenRes.body.data.qrCode).not.toBe(originalQr);

    // qr_code_token in DB is updated
    const { rows } = await db.query(
      `SELECT qr_code_token FROM users WHERE id = $1`,
      [user.id]
    );
    // New token must differ from what was originally generated
    expect(rows[0].qr_code_token).not.toBe(user.qr_code_token);
  });

  it('should return 401 without a token', async () => {
    const res = await request(app).post('/api/users/me/qr/regenerate');
    expect(res.status).toBe(401);
  });
});


// =============================================================================
// 6. GET /api/users  [admin]
// =============================================================================
describe('GET /api/users (admin)', () => {

  it('should return a paginated list of all users for admin', async () => {
    await registerAndLogin({ email: 'member1@example.com' });
    await registerAndLogin({ email: 'member2@example.com', full_name: 'Member Two' });
    const { accessToken } = await registerAndLoginAdmin();

    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    expect(res.body.pagination).toMatchObject({
      total:      expect.any(Number),
      page:       1,
      limit:      10,
      totalPages: expect.any(Number),
    });
  });

  it('should filter users by role', async () => {
    await registerAndLogin({ email: 'member1@example.com' });
    const { accessToken } = await registerAndLoginAdmin();

    const res = await request(app)
      .get('/api/users?role=member')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    res.body.data.forEach((u) => expect(u.role).toBe('member'));
  });

  it('should filter users by search term (name match)', async () => {
    await registerAndLogin({
      email: 'searchable@example.com',
      full_name: 'Unique Search Name',
    });
    const { accessToken } = await registerAndLoginAdmin();

    const res = await request(app)
      .get('/api/users?search=Unique Search')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(
      res.body.data.some((u) => u.full_name === 'Unique Search Name')
    ).toBe(true);
  });

  it('should respect pagination params', async () => {
    const { accessToken } = await registerAndLoginAdmin();

    const res = await request(app)
      .get('/api/users?page=1&limit=2')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(2);
    expect(res.body.pagination.limit).toBe(2);
  });

  it('should never expose password_hash in list', async () => {
    const { accessToken } = await registerAndLoginAdmin();

    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${accessToken}`);

    res.body.data.forEach((u) => {
      expect(u.password_hash).toBeUndefined();
    });
  });

  it('should return 403 for a regular member', async () => {
    const { accessToken } = await registerAndLogin();

    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(403);
  });

  it('should return 401 without a token', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(401);
  });
});


// =============================================================================
// 7. GET /api/users/:userId  [admin]
// =============================================================================
describe('GET /api/users/:userId (admin)', () => {

  it('should return a specific user profile for admin', async () => {
    const { user: member } = await registerAndLogin();
    const { accessToken }  = await registerAndLoginAdmin();

    const res = await request(app)
      .get(`/api/users/${member.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(member.id);
    expect(res.body.data.email).toBe('member@example.com');
  });

  it('should return 404 for a non-existent user ID', async () => {
    const { accessToken } = await registerAndLoginAdmin();

    const res = await request(app)
      .get('/api/users/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(404);
  });

  it('should return 400 for an invalid UUID format', async () => {
    const { accessToken } = await registerAndLoginAdmin();

    const res = await request(app)
      .get('/api/users/not-a-uuid')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(400);
  });

  it('should return 403 for a regular member', async () => {
    const { user: member, accessToken } = await registerAndLogin();

    const res = await request(app)
      .get(`/api/users/${member.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(403);
  });
});


// =============================================================================
// 8. DELETE /api/users/:userId  [admin]
// =============================================================================
describe('DELETE /api/users/:userId (admin)', () => {

  it('should delete a user successfully', async () => {
    const { user: member } = await registerAndLogin();
    const { accessToken }  = await registerAndLoginAdmin();

    const res = await request(app)
      .delete(`/api/users/${member.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/deleted successfully/i);

    // Confirm gone from DB
    const { rows } = await db.query(
      `SELECT id FROM users WHERE id = $1`,
      [member.id]
    );
    expect(rows).toHaveLength(0);
  });

  it('should cascade-delete related records (memberships, streaks, etc.)', async () => {
    const { user: member } = await registerAndLogin();
    const { accessToken }  = await registerAndLoginAdmin();

    // Confirm streak row was created on register
    const { rows: streaksBefore } = await db.query(
      `SELECT id FROM workout_streaks WHERE user_id = $1`,
      [member.id]
    );
    expect(streaksBefore).toHaveLength(1);

    // Delete the user
    await request(app)
      .delete(`/api/users/${member.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    // Streak row should be gone (ON DELETE CASCADE)
    const { rows: streaksAfter } = await db.query(
      `SELECT id FROM workout_streaks WHERE user_id = $1`,
      [member.id]
    );
    expect(streaksAfter).toHaveLength(0);
  });

  it('should return 400 when admin tries to delete themselves', async () => {
    const { user: admin, accessToken } = await registerAndLoginAdmin();

    const res = await request(app)
      .delete(`/api/users/${admin.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/cannot delete their own account/i);
  });

  it('should return 404 for a non-existent user ID', async () => {
    const { accessToken } = await registerAndLoginAdmin();

    const res = await request(app)
      .delete('/api/users/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(404);
  });

  it('should return 400 for an invalid UUID', async () => {
    const { accessToken } = await registerAndLoginAdmin();

    const res = await request(app)
      .delete('/api/users/not-a-valid-uuid')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(400);
  });

  it('should return 403 for a regular member', async () => {
    const { user, accessToken } = await registerAndLogin();

    const res = await request(app)
      .delete(`/api/users/${user.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(403);
  });
});