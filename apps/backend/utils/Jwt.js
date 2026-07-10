/**
 * jwt.js
 * Thin wrappers around jsonwebtoken for signing and verifying tokens.
 *
 * Two token types:
 *   - Access token  : short-lived (15m), sent in Authorization header
 *   - Refresh token : long-lived (7d), stored server-side or in httpOnly cookie
 *
 * Payload shape: { id: uuid, role: 'member' | 'admin' }
 *
 * Usage:
 *   const { accessToken, refreshToken } = jwt.generateTokens({ id, role });
 *   const payload = jwt.verifyAccessToken(token);
 */

const jsonwebtoken = require('jsonwebtoken');
const ApiError = require('./Apierror');
const env = require('../config/env');

const {
  JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET,
  JWT_ACCESS_EXPIRES_IN = '15m',
  JWT_REFRESH_EXPIRES_IN = '7d',
} = {
  JWT_ACCESS_SECRET: env.JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET: env.JWT_REFRESH_SECRET,
  JWT_ACCESS_EXPIRES_IN: env.JWT_ACCESS_EXPIRES_IN,
  JWT_REFRESH_EXPIRES_IN: env.JWT_REFRESH_EXPIRES_IN,
};

// ─── Sign ─────────────────────────────────────────────────────────────────────

/**
 * Generate a pair of access + refresh tokens.
 * @param {{ id: string, role: string }} payload
 * @returns {{ accessToken: string, refreshToken: string }}
 */
const generateTokens = (payload) => {
  const accessToken = jsonwebtoken.sign(payload, JWT_ACCESS_SECRET, {
    expiresIn: JWT_ACCESS_EXPIRES_IN,
  });

  const refreshToken = jsonwebtoken.sign(payload, JWT_REFRESH_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRES_IN,
  });

  return { accessToken, refreshToken };
};

// ─── Verify ───────────────────────────────────────────────────────────────────

/**
 * Verify an access token.
 * @param {string} token
 * @returns {{ id: string, role: string, iat: number, exp: number }}
 * @throws {ApiError} 401 if invalid or expired
 */
const verifyAccessToken = (token) => {
  try {
    return jsonwebtoken.verify(token, JWT_ACCESS_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw ApiError.unauthorized('Access token expired');
    }
    throw ApiError.unauthorized('Invalid access token');
  }
};

/**
 * Verify a refresh token.
 * @param {string} token
 * @returns {{ id: string, role: string, iat: number, exp: number }}
 * @throws {ApiError} 401 if invalid or expired
 */
const verifyRefreshToken = (token) => {
  try {
    return jsonwebtoken.verify(token, JWT_REFRESH_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw ApiError.unauthorized('Refresh token expired — please log in again');
    }
    throw ApiError.unauthorized('Invalid refresh token');
  }
};

module.exports = {
  generateTokens,
  verifyAccessToken,
  verifyRefreshToken,
};