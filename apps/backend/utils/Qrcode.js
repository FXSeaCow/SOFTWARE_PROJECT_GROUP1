/**
 * qrcode.js
 * Generates a QR code image from a user's qr_code_token (FR-17, FR-18).
 *
 * The QR image encodes ONLY the token string — not the user's UUID or any
 * other sensitive data. The backend looks up the user by this token on scan.
 *
 * Two output formats:
 *   generateQRDataURL  → base64 data URL  (embed directly in an <img> tag)
 *   generateQRBuffer   → PNG Buffer       (save to disk or stream as response)
 *
 * Usage:
 *   // In your users controller (GET /api/users/me/qr):
 *   const dataUrl = await qrcode.generateQRDataURL(user.qr_code_token);
 *   res.json(ApiResponse.success({ qrCode: dataUrl }));
 */

const QRCode = require('qrcode');
const crypto = require('crypto');

const QR_OPTIONS = {
  errorCorrectionLevel: 'H', // High — can recover from up to 30% damage
  type: 'image/png',
  margin: 2,
  width: 300,
  color: {
    dark: '#000000',
    light: '#ffffff',
  },
};

/**
 * Generate a QR code as a base64 data URL string.
 * Safe to embed directly as <img src="..."> in the frontend.
 *
 * @param {string} token - user.qr_code_token (UUID)
 * @returns {Promise<string>} data:image/png;base64,... string
 */
const generateQRDataURL = async (token) => {
  return QRCode.toDataURL(token, QR_OPTIONS);
};

/**
 * Generate a QR code as a raw PNG Buffer.
 * Use when you want to send the image directly as a binary HTTP response.
 *
 * @param {string} token - user.qr_code_token (UUID)
 * @returns {Promise<Buffer>} PNG image buffer
 *
 * Controller example:
 *   const buffer = await qrcode.generateQRBuffer(user.qr_code_token);
 *   res.set('Content-Type', 'image/png');
 *   res.send(buffer);
 */
const generateQRBuffer = async (token) => {
  return QRCode.toBuffer(token, QR_OPTIONS);
};

/**
 * Convert a PNG data URL sent by the frontend into a raw Buffer.
 *
 * @param {string} dataUrl - data:image/png;base64,... string
 * @returns {Buffer|null}
 */
const bufferFromQRDataURL = (dataUrl) => {
  if (typeof dataUrl !== 'string') return null;

  const match = dataUrl.match(/^data:image\/png;base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) return null;

  return Buffer.from(match[1].replace(/\s/g, ''), 'base64');
};

/**
 * Compare a frontend QR data URL with the QR image generated from a token.
 *
 * @param {string} token - user.qr_code_token (UUID)
 * @param {string} dataUrl - data:image/png;base64,... string
 * @returns {Promise<boolean>}
 */
const qrDataURLMatchesToken = async (token, dataUrl) => {
  if (!token) return false;

  const receivedBuffer = bufferFromQRDataURL(dataUrl);
  if (!receivedBuffer) return false;

  const expectedBuffer = await generateQRBuffer(token);
  if (expectedBuffer.length !== receivedBuffer.length) return false;

  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
};

module.exports = {
  generateQRDataURL,
  generateQRBuffer,
  bufferFromQRDataURL,
  qrDataURLMatchesToken,
};
