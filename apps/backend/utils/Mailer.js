/**
 * Mailer.js
 * Small abstraction for sending transactional emails (password reset, invites, etc.).
 *
 * Behavior:
 *  - In `test` env: no email is sent, function returns a short object for assertions.
 *  - If SMTP config is present (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`) it will use
 *    `nodemailer` to send real emails.
 *  - If SMTP is not configured but NODE_ENV === 'development', it will log the
 *    reset link so developers can copy it.
 */

const logger = require('./Logger');
const dns = require('dns').promises;

const resolveSmtpHost = async (host) => {
  try {
    const addresses = await dns.resolve4(host);
    return addresses[0] || host;
  } catch (err) {
    logger.warn('Unable to resolve SMTP host to IPv4; using configured host', {
      host,
      error: err.message,
    });
    return host;
  }
};

const sendPasswordResetEmail = async ({ to, token, fullName }) => {
  const frontend = process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:3000';
  const resetLink = `${frontend.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`;
  const smtpHost = process.env.SMTP_HOST?.trim();
  const smtpUser = process.env.SMTP_USER?.trim();
  const smtpPass = process.env.SMTP_PASS?.trim();
  const smtpPort = Number(process.env.SMTP_PORT) || 587;

  // Never actually send when running tests — keep tests hermetic
  if (process.env.NODE_ENV === 'test') {
    logger.info('Test env - skipping sending password reset email', { to, resetLink });
    return { skipped: true, resetLink };
  }

  // If SMTP is not configured just log the reset link in dev and return
  if (!smtpHost || !smtpUser || !smtpPass) {
    logger.warn('SMTP not configured — password reset email not sent', { to, resetLink });
    if (process.env.NODE_ENV === 'development') {
      // Helpful for local development — show link in logs
      logger.info('Password reset link (dev)', { to, resetLink });
    }
    return { skipped: true, resetLink };
  }

  // Lazy-require nodemailer to avoid hard dependency during tests where it's unnecessary
  let nodemailer;
  try {
    nodemailer = require('nodemailer');
  } catch (err) {
    logger.error('nodemailer not installed; cannot send email', { err: err.message });
    return { error: 'nodemailer not installed', resetLink };
  }

  const smtpHostForConnection = await resolveSmtpHost(smtpHost);

  const transporter = nodemailer.createTransport({
    host: smtpHostForConnection,
    port: smtpPort,
    secure: process.env.SMTP_SECURE === 'true',
    family: 4,
    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 30000,
    tls: {
      servername: smtpHost,
    },
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  const from = process.env.EMAIL_FROM?.trim() || smtpUser;

  const mailOptions = {
    from,
    to,
    subject: 'Reset your password',
    text: `Hello ${fullName || ''},\n\nWe received a request to reset your password. Click the link below to continue:\n\n${resetLink}\n\nIf you didn't request this, you can safely ignore this email.\n`,
    html: `<p>Hello ${fullName || ''},</p>
           <p>We received a request to reset your password. Click the link below to continue:</p>
           <p><a href="${resetLink}">Reset password</a></p>
           <p>If you didn't request this, you can safely ignore this email.</p>`,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    logger.info('Password reset email queued', { to, messageId: info.messageId });
    return { sent: true, info };
  } catch (err) {
    logger.error('Failed to send password reset email', { to, error: err.message });
    return { error: err.message, resetLink };
  }
};

module.exports = {
  sendPasswordResetEmail,
};
