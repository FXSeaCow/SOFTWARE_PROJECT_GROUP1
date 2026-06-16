/**
 * hash.js
 * Bcrypt wrappers for password hashing (FR-02) and verification.
 * NFR-02 requires passwords to be stored using secure hashing algorithms.
 *
 * Usage:
 *   const hashed  = await hash.hashPassword('plaintext');
 *   const isMatch = await hash.comparePassword('plaintext', hashed);
 */

const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 12; // 12 rounds ≈ ~300ms on modern hardware — good balance
                        // of security vs performance. Increase to 14 for higher
                        // security environments at the cost of slower hashing.

/**
 * Hash a plain-text password.
 * @param {string} password - Plain-text password from registration/reset
 * @returns {Promise<string>} bcrypt hash to store in users.password_hash
 */
const hashPassword = async (password) => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

/**
 * Compare a plain-text password against a stored bcrypt hash.
 * @param {string} password   - Plain-text password from login attempt
 * @param {string} hash       - Stored hash from users.password_hash
 * @returns {Promise<boolean>} true if they match
 */
const comparePassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

module.exports = {
  hashPassword,
  comparePassword,
};