/**
 * Mailer.js
 * Small abstraction for sending transactional emails (password reset, invites, etc.).
 *
 * Behavior:
 *  - In `test` env: no email is sent, function returns a short object for assertions.
 *  - If `BREVO_API_KEY` is present, sends via the Brevo HTTPS API (port 443,
 *    avoids hosts like Render blocking/throttling raw SMTP ports). `EMAIL_FROM`
 *    must be an address verified in Brevo (Senders, Domains & Dedicated IPs).
 *  - If not configured but NODE_ENV === 'development', it will log the
 *    reset link so developers can copy it.
 */

const logger = require('./Logger');

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

const sendPasswordResetEmail = async ({ to, token, fullName }) => {
  const frontend = process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:3000';
  const resetLink = `${frontend.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`;
  const brevoApiKey = process.env.BREVO_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();

  // Never actually send when running tests — keep tests hermetic
  if (process.env.NODE_ENV === 'test') {
    logger.info('Test env - skipping sending password reset email', { to, resetLink });
    return { skipped: true, resetLink };
  }

  // If Brevo is not configured just log the reset link in dev and return
  if (!brevoApiKey || !from) {
    logger.warn('Brevo not configured — password reset email not sent', { to, resetLink });
    if (process.env.NODE_ENV === 'development') {
      // Helpful for local development — show link in logs
      logger.info('Password reset link (dev)', { to, resetLink });
    }
    return { skipped: true, resetLink };
  }

  const payload = {
    sender: { email: from, name: 'GymHub' },
    to: [{ email: to }],
    subject: 'Reset your password',
    textContent: `Hello ${fullName || ''},\n\nWe received a request to reset your password. Click the link below to continue:\n\n${resetLink}\n\nIf you didn't request this, you can safely ignore this email.\n`,
    htmlContent: `<p>Hello ${fullName || ''},</p>
           <p>We received a request to reset your password. Click the link below to continue:</p>
           <p><a href="${resetLink}">Reset password</a></p>
           <p>If you didn't request this, you can safely ignore this email.</p>`,
  };

  try {
    const response = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'api-key': brevoApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(body?.message || `Brevo API responded with status ${response.status}`);
    }

    logger.info('Password reset email queued', { to, messageId: body.messageId });
    return { sent: true, info: body };
  } catch (err) {
    logger.error('Failed to send password reset email', { to, error: err.message });
    return { error: err.message, resetLink };
  }
};

module.exports = {
  sendPasswordResetEmail,
};
