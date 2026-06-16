/**
 * logger.js
 * Application-wide logger built on winston.
 *
 * - Development : pretty-printed colorized output to console
 * - Production  : JSON structured logs (easy to ship to any log aggregator)
 *
 * Log levels (low → high): error | warn | info | http | debug
 *
 * Usage:
 *   const logger = require('../utils/logger');
 *   logger.info('Server started on port 4000');
 *   logger.error('DB connection failed', { error: err.message });
 *   logger.debug('Payload received', { body: req.body });
 *
 * HTTP request logging: use the morgan middleware token in app.js:
 *   app.use(morgan('combined', { stream: logger.stream }));
 */

const winston = require('winston');

const { combine, timestamp, printf, colorize, json, errors } = winston.format;

const isDev = process.env.NODE_ENV !== 'production';

// ─── Dev format: readable, colorized ─────────────────────────────────────────
const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
    return `${timestamp} [${level}] ${stack || message}${metaStr}`;
  })
);

// ─── Production format: structured JSON ──────────────────────────────────────
const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json()
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  format: isDev ? devFormat : prodFormat,
  transports: [
    new winston.transports.Console(),
    // Uncomment to also write to files in production:
    // new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    // new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
  // Do not exit on handled exceptions
  exitOnError: false,
});

// Stream interface for morgan HTTP request logging
logger.stream = {
  write: (message) => logger.http(message.trim()),
};

module.exports = logger;