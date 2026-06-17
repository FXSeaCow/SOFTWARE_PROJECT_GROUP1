/**
 * auth.test.js
 * Integration tests for the auth module.
 * Uses Supertest to fire real HTTP requests against the Express app,
 * hitting a real test PostgreSQL database — no mocking.
 *
 * Run:  npm run test:auth
 *
 * Test groups:
 *   1. POST /api/auth/register
 *   2. POST /api/auth/login
 *   3. POST /api/auth/refresh-token
 *   4. POST /api/auth/logout
 *   5. POST /api/auth/forgot-password
 *   6. POST /api/auth/reset-password
 *   7. GET  /api/auth/me
 */

const request = require('supertest');
const crypto  = require('crypto');
const app     = require('../../../app');
const db      = require('../../../config/db');

// ─── Shared test data ─────────────────────────────────────────────────────────

const VALID_USER = {
  full_name:        'Nguyen Van A',
  email:            'nguyenvana@example.com',
  password:         'Password1',
  confirm_password: 'Password1',
  phone:            '0901234567',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Register a user and return the full response body.
 * Used as setup in tests that need an existing user.
 */
const registerUser = (overrides = {}) =>
  request(app)
    .post('/api/auth/register')
    .send({ ...VALID_USER, ...overrides });

/**
 * Login and return the full response body.
 */
const loginUser = (email = VALID_USER.email, password = VALID_USER.password) =>
  request(app)
    .post('/api/auth/login')
    .send({ email, password });

// ─── Reset DB between every test ─────────────────────────────────────────────
beforeEach(async () => {
  await global.truncateAll();
});

// =============================================================================
// 1. REGISTER
// =============================================================================
describe('POST /api/auth/register', () => {

  it('should register a new user and return 201 with tokens', async () => {
    const res = await registerUser();

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    // User profile returned
    expect(res.body.data.user).toMatchObject({
      email:     VALID_USER.email,
      full_name: VALID_USER.full_name,
      role:      'member',
    });

    // Never expose password hash
    expect(res.body.data.user.password_hash).toBeUndefined();

    // Access token in body
    expect(res.body.data.accessToken).toBeDefined();
    expect(typeof res.body.data.accessToken).toBe('string');

    // Refresh token in httpOnly cookie
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies.some((c) => c.startsWith('refreshToken='))).toBe(true);
    expect(cookies.some((c) => c.includes('HttpOnly'))).toBe(true);
  });

  it('should create a workout_streaks row for the new user', async () => {
    const res = await registerUser();
    const userId = res.body.data.user.id;

    const { rows } = await db.query(
      'SELECT * FROM workout_streaks WHERE user_id = $1',
      [userId]
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].current_streak).toBe(0);
    expect(rows[0].longest_streak).toBe(0);
  });

  it('should return 409 when email is already registered', async () => {
    await registerUser(); // first registration

    const res = await registerUser(); // duplicate

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/already exists/i);
  });

  it('should return 400 when passwords do not match', async () => {
    const res = await registerUser({ confirm_password: 'DifferentPass1' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'confirm_password' }),
      ])
    );
  });

  it('should return 400 when email is invalid', async () => {
    const res = await registerUser({ email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'email' }),
      ])
    );
  });

  it('should return 400 when password is too weak (no uppercase)', async () => {
    const res = await registerUser({
      password:         'password1',
      confirm_password: 'password1',
    });

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'password' }),
      ])
    );
  });

  it('should return 400 when password has no number', async () => {
    const res = await registerUser({
      password:         'PasswordOnly',
      confirm_password: 'PasswordOnly',
    });

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'password' }),
      ])
    );
  });

  it('should return 400 when full_name is missing', async () => {
    const { full_name: _, ...withoutName } = VALID_USER;
    const res = await request(app)
      .post('/api/auth/register')
      .send(withoutName);

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'full_name' }),
      ])
    );
  });

  it('should register successfully without optional phone field', async () => {
    const { phone: _, ...withoutPhone } = VALID_USER;
    const res = await request(app)
      .post('/api/auth/register')
      .send(withoutPhone);

    expect(res.status).toBe(201);
    expect(res.body.data.user.phone).toBeNull();
  });

  it('should not expose qr_code_token in register response', async () => {
    const res = await registerUser();
    // qr_code_token should not leak in auth responses — only via /users/me/qr
    expect(res.body.data.user.qr_code_token).toBeUndefined();
  });
});

