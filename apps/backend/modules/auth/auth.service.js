/**
 * auth.service.js
 * Business logic for authentication flows.
 * Orchestrates repository calls, hashing, token generation.
 * Không làm việc trực tiếp với req/res — đó là nhiệm vụ controller.
 *
 * Covers: FR-01 (register), FR-02 (login), FR-03 (password recovery).
 */

const crypto = require('crypto');
const repo = require('./auth.repository');
const { hashPassword, comparePassword } = require('../../utils/Hash');
const { generateTokens, verifyRefreshToken } = require('../../utils/Jwt');
const { withTransaction } = require('../../utils/Transaction');
const ApiError = require('../../utils/Apierror');
const logger = require('../../utils/Logger');
const Mailer = require('../../utils/Mailer');
const env = require('../../config/env');

// Mốc thời gian token reset mật khẩu (phút)
const RESET_TOKEN_EXPIRY_MINUTES = 30;
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';
const GOOGLE_SCOPE = 'openid email profile';

const requireGoogleConfig = () => {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw ApiError.internal('Google login is not configured');
  }
};

const getGoogleAuthUrl = ({ redirectUri, state }) => {
  requireGoogleConfig();

  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
  url.searchParams.set('redirect_uri', redirectUri || env.GOOGLE_REDIRECT_URI);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', GOOGLE_SCOPE);
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'select_account');
  if (state) url.searchParams.set('state', state);

  return url.toString();
};

const fetchGoogleProfile = async ({ code, redirectUri }) => {
  requireGoogleConfig();

  const tokenBody = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri || env.GOOGLE_REDIRECT_URI,
  });

  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: tokenBody,
  });

  if (!tokenResponse.ok) {
    throw ApiError.unauthorized('Google authorization failed');
  }

  const tokenData = await tokenResponse.json();
  if (!tokenData.access_token) {
    throw ApiError.unauthorized('Google authorization failed');
  }

  const profileResponse = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!profileResponse.ok) {
    throw ApiError.unauthorized('Unable to read Google profile');
  }

  const profile = await profileResponse.json();
  if (!profile.email || profile.email_verified !== true) {
    throw ApiError.unauthorized('Google account email must be verified');
  }

  return {
    email: String(profile.email).toLowerCase(),
    full_name: profile.name || profile.email,
  };
};

// ─── Registration (FR-01) ───────────────────────────────────────────────────

/**
 * Đăng ký account mới.
 * Steps: 1) kiểm tra email; 2) hash mật khẩu; 3) insert user + init streak (transaction)
 * 4) phát tokens để user được đăng nhập ngay.
 */
const register = async ({ full_name, email, password, phone }) => {
  // 1. Kiểm tra trùng email
  const existing = await repo.findByEmail(email);
  if (existing) {
    throw ApiError.conflict('An account with this email already exists');
  }

  // 2. Hash mật khẩu
  const password_hash = await hashPassword(password);

  // 3. Insert user + streak row atomically
  const user = await withTransaction(async (client) => {
    const newUser = await repo.createUser({ email, password_hash, full_name, phone }, client);
    await repo.initStreakRecord(newUser.id, client);
    return newUser;
  });

  logger.info('New user registered', { userId: user.id, email: user.email });

  // 4. Issue tokens
  const { accessToken, refreshToken } = generateTokens({ id: user.id, role: user.role });
  const { qr_code_token: _, password_hash: __, ...safeUser } = user;

  return { user: safeUser, accessToken, refreshToken };
};

// ─── Login (FR-02) ──────────────────────────────────────────────────────────

/**
 * Xác thực user bằng email + password.
 * Trả về thông tin user (không có password_hash) và token pair.
 */
const login = async ({ email, password }) => {
  const user = await repo.findByEmail(email);
  if (!user) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  if (user.account_status === 'locked') {
    throw ApiError.forbidden('This account is locked');
  }

  const isMatch = await comparePassword(password, user.password_hash);
  if (!isMatch) {
    logger.warn('Failed login attempt', { email });
    throw ApiError.unauthorized('Invalid email or password');
  }

  const { accessToken, refreshToken } = generateTokens({ id: user.id, role: user.role });

  const { password_hash: _, qr_code_token: __, ...safeUser } = user; // Exclude sensitive fields

  logger.info('User logged in', { userId: user.id });

  return { user: safeUser, accessToken, refreshToken };
};

const loginWithGoogle = async ({ code, redirectUri }) => {
  const googleProfile = await fetchGoogleProfile({ code, redirectUri });

  let user = await repo.findByEmail(googleProfile.email);
  if (user?.account_status === 'locked') {
    throw ApiError.forbidden('This account is locked');
  }

  if (!user) {
    const randomPassword = crypto.randomBytes(48).toString('hex');
    const password_hash = await hashPassword(randomPassword);

    user = await withTransaction(async (client) => {
      const newUser = await repo.createUser({
        email: googleProfile.email,
        password_hash,
        full_name: googleProfile.full_name,
        phone: null,
      }, client);
      await repo.initStreakRecord(newUser.id, client);
      return newUser;
    });

    logger.info('New user registered with Google', {
      userId: user.id,
      email: user.email,
    });
  } else {
    logger.info('User logged in with Google', { userId: user.id });
  }

  const { accessToken, refreshToken } = generateTokens({ id: user.id, role: user.role });
  const { password_hash: _, qr_code_token: __, ...safeUser } = user;

  return { user: safeUser, accessToken, refreshToken };
};

// ─── Token Refresh ──────────────────────────────────────────────────────────

/**
 * Issue new access token using refresh token.
 * Kiểm tra user còn tồn tại.
 */
const refreshTokens = async (refreshToken) => {
  const payload = verifyRefreshToken(refreshToken);

  const user = await repo.findById(payload.id);
  if (!user) {
    throw ApiError.unauthorized('Account no longer exists');
  }

  const tokens = generateTokens({ id: user.id, role: user.role });

  logger.info('Tokens refreshed', { userId: user.id });

  return tokens;
};

// ─── Forgot Password (FR-03) ───────────────────────────────────────────────

/**
 * Tạo reset token và gửi email (ở production). Trả chung một thông báo
 * để tránh tiết lộ email tồn tại hay không.
 */
const forgotPassword = async (email) => {
  const GENERIC_MSG = 'If an account with that email exists, a reset link has been sent.';

  const user = await repo.findByEmail(email);
  if (!user) {
    return { message: GENERIC_MSG };
  }

  const plainToken = crypto.randomBytes(32).toString('hex');

  const tokenHash = crypto.createHash('sha256').update(plainToken).digest('hex');

  const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000);

  await repo.savePasswordResetToken(user.id, tokenHash, expiresAt);

  logger.info('Password reset token generated', { userId: user.id });

  // Gửi email chứa link reset (không làm flow fail nếu gửi lỗi)
  try {
    const mailResult = await Mailer.sendPasswordResetEmail({
      to: user.email,
      token: plainToken,
      fullName: user.full_name,
    });

    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
      return { message: GENERIC_MSG, resetToken: plainToken, mailResult };
    }

    return { message: GENERIC_MSG };
  } catch (err) {
    logger.error('Error sending password reset email', { err: err.message, userId: user.id });
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
      return { message: GENERIC_MSG, resetToken: plainToken };
    }
    return { message: GENERIC_MSG };
  }
};

// ─── Reset Password (FR-03) ────────────────────────────────────────────────

/**
 * Reset mật khẩu bằng token.
 * 1) Hash token nhận vào để so khớp db
 * 2) Xác thực token
 * 3) Hash mật khẩu mới
 * 4) Cập nhật mật khẩu + đánh dấu token đã dùng (transaction)
 */
const resetPassword = async ({ token, password }) => {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const record = await repo.findValidResetToken(tokenHash);
  if (!record) {
    throw ApiError.badRequest('Reset token is invalid or has expired. Please request a new one.');
  }

  const newPasswordHash = await hashPassword(password);

  await withTransaction(async (client) => {
    await repo.updatePassword(record.user_id, newPasswordHash, client);
    await repo.markResetTokenUsed(tokenHash, client);
  });

  logger.info('Password reset successful', { userId: record.user_id });

  return { message: 'Password has been reset successfully. You can now log in.' };
};

// ─── Get current user (for /me endpoint) ──────────────────────────────────

const getMe = async (userId) => {
  const user = await repo.findById(userId);
  if (!user) throw ApiError.notFound('User');
  return user;
};

module.exports = {
  register,
  login,
  getGoogleAuthUrl,
  loginWithGoogle,
  refreshTokens,
  forgotPassword,
  resetPassword,
  getMe,
};
