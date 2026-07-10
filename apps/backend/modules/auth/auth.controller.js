/**
 * auth.controller.js
 * Lớp HTTP cho các flow xác thực (register, login, refresh, logout, forgot/reset, me).
 *
 * Ghi chú tiếng Việt:
 * - Controller chỉ chịu trách nhiệm parse `req`, gọi `auth.service` và trả
 *   response theo chuẩn `ApiResponse`.
 * - Tất cả handlers được wrap bằng `asyncHandler` để lỗi tự động được
 *   forward tới `errorHandler` middleware.
 */

const authService = require('./auth.service');
const asyncHandler = require('../../utils/Asynchandler');
const ApiResponse = require('../../utils/Apiresponse');

// ─── POST /api/auth/register ──────────────────────────────────────────────────

/**
 * Đăng ký tài khoản mới (FR-01).
 * Trả về 201 cùng profile người dùng (không bao gồm password) và tokens.
 */
const register = asyncHandler(async (req, res) => {
  const { full_name, email, password, phone } = req.body;

  const { user, accessToken, refreshToken } = await authService.register({
    full_name,
    email,
    password,
    phone,
  });

  // Lưu refresh token vào httpOnly cookie (bảo mật hơn so với trả body)
  res.cookie('refreshToken', refreshToken, cookieOptions());

  // Extra safety: ensure sensitive fields are not leaked in the response
  if (user) {
    delete user.password_hash;
    delete user.qr_code_token;
  }

  res.status(201).json(
    ApiResponse.created(
      { user, accessToken },
      'Account created successfully'
    )
  );
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

/**
 * Đăng nhập bằng email + password (FR-02).
 * Trả về profile user và access token; refresh token được set cookie.
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const { user, accessToken, refreshToken } = await authService.login({
    email,
    password,
  });

  res.cookie('refreshToken', refreshToken, cookieOptions());

  // Ensure no sensitive fields leak (defence in depth)
  if (user) {
    delete user.password_hash;
    delete user.qr_code_token;
  }

  res.status(200).json(
    ApiResponse.success(
      { user, accessToken },
      'Login successful'
    )
  );
});

// ─── POST /api/auth/refresh-token ─────────────────────────────────────────────

/**
 * Đổi access token bằng refresh token.
 * Ưu tiên đọc cookie httpOnly; nếu không có thì fallback sang body.
 */
const refreshToken = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken || req.body?.refresh_token;

  if (!token) {
    return res.status(401).json(
      ApiResponse.error('Refresh token missing')
    );
  }

  const { accessToken, refreshToken: newRefreshToken } =
    await authService.refreshTokens(token);

  // Xoay refresh token
  res.cookie('refreshToken', newRefreshToken, cookieOptions());

  res.status(200).json(
    ApiResponse.success({ accessToken }, 'Tokens refreshed successfully')
  );
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────

/**
 * Đăng xuất — xóa cookie refresh token.
 * Lưu ý: access token vẫn còn hiệu lực tới khi hết hạn (stateless JWT).
 */
const logout = asyncHandler(async (req, res) => {
  res.clearCookie('refreshToken', cookieOptions());

  res.status(200).json(
    ApiResponse.success(null, 'logged out successfully')
  );
});

// ─── POST /api/auth/forgot-password ──────────────────────────────────────────

/**
 * Gửi email đặt lại mật khẩu (FR-03).
 * Luôn trả 200 để tránh lộ thông tin (user enumeration).
 */
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const result = await authService.forgotPassword(email);

  res.status(200).json(ApiResponse.success(result, result.message));
});

// ─── POST /api/auth/reset-password ───────────────────────────────────────────

/**
 * Reset mật khẩu sử dụng token gửi trong email (FR-03).
 */
const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  const result = await authService.resetPassword({ token, password });

  res.status(200).json(ApiResponse.success(null, result.message));
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────

/**
 * Trả về profile người dùng đang xác thực.
 * Dựa vào `req.user` được middleware `authenticate` thiết lập.
 */
const getMe = asyncHandler(async (req, res) => {
  const user = await authService.getMe(req.user.id);

  // Sanitize just in case the service ever returns sensitive fields
  if (user) {
    delete user.password_hash;
    delete user.qr_code_token;
  }

  res.status(200).json(ApiResponse.success(user));
});

// ─── Cookie helper ────────────────────────────────────────────────────────────

/**
 * Tùy chọn cookie dùng cho refresh token.
 * httpOnly: JS không thể đọc (giúp chống XSS)
 * secure  : chỉ HTTPS ở production
 * sameSite: giảm rủi ro CSRF
 */
const cookieOptions = () => ({
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge:   7 * 24 * 60 * 60 * 1000, // 7 ngày (phù hợp với JWT_REFRESH_EXPIRES_IN)
});

module.exports = {
  register,
  login,
  refreshToken,
  logout,
  getMe,
  forgotPassword,
  resetPassword,
};