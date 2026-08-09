const express = require('express');

const requestLogger = require('./middlewares/RequestLogger.middleware');
const notFound = require('./middlewares/NotFound.middleware');
const errorHandler = require('./middlewares/ErrorHandler.middleware');
const { ensureAppReady } = require('./bootstrap/appInit');
const authRoutes = require('./modules/auth/auth.routes');
const usersRoutes = require('./modules/users/users.routes');
const membershipsRoutes = require('./modules/memberships/memberships.routes');
const workoutsRoutes = require('./modules/workouts/workouts.routes');
const paymentsRoutes = require('./modules/payments/payments.routes');
const occupancyRoutes = require('./modules/occupancy/occupancy.routes');
const notificationsRoutes = require('./modules/notifications/notifications.routes');
const announcementsRoutes = require('./modules/announcements/announcements.routes');
const fitnessRecordsRoutes = require('./modules/fitness-records/fitness-records.routes');
const streaksRoutes = require('./modules/streaks/streaks.routes');
const adminRoutes = require('./modules/admin/admin.routes');
const { generalLimiter } = require('./middlewares/rateLimiter.middleware');

const cors = require('cors');
const env = require('./config/env');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  const cookieHeader = req.headers.cookie;
  req.cookies = {};

  if (cookieHeader) {
    cookieHeader.split(';').forEach((pair) => {
      const index = pair.indexOf('=');
      if (index === -1) return;

      const name = pair.slice(0, index).trim();
      const value = pair.slice(index + 1).trim();
      req.cookies[name] = decodeURIComponent(value);
    });
  }

  next();
});

if (process.env.NODE_ENV !== 'test') {
  app.use(requestLogger);
  app.use('/api', generalLimiter);
}

app.use(cors({
  origin: env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.get('/health', ensureAppReady, (req, res) => {
  res.status(200).json({ status: 'ok' });
});

if (process.env.NODE_ENV !== 'test') {
  app.use(ensureAppReady);
}

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/memberships', membershipsRoutes);
app.use('/api/workouts', workoutsRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/occupancy', occupancyRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/announcements', announcementsRoutes);
app.use('/api/fitness-records', fitnessRecordsRoutes);
app.use('/api/streaks', streaksRoutes);
app.use('/api/admin', adminRoutes);
app.use(notFound);
app.use(errorHandler);


module.exports = app;
