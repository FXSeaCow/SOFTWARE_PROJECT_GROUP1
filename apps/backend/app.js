const express = require('express');

const requestLogger = require('./middlewares/RequestLogger.middleware');
const notFound = require('./middlewares/NotFound.middleware');
const errorHandler = require('./middlewares/ErrorHandler.middleware');
const { ensureAppReady } = require('./bootstrap/appInit');
const authRoutes = require('./modules/auth/auth.routes');
const usersRoutes = require('./modules/users/users.routes');
const membershipsRoutes = require('./modules/memberships/memberships.routes');

const { generalLimiter } = require('./middlewares/RateLimiter.middleware');

const cors = require('cors');
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
  origin: 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(ensureAppReady);

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/memberships', membershipsRoutes);

app.use(notFound);
app.use(errorHandler);


module.exports = app;
