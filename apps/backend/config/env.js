require('dotenv').config();

// Export environment-derived configuration with helpful fallbacks so
// modules can rely on explicit names (JWT_ACCESS_SECRET / JWT_REFRESH_SECRET)
// while remaining compatible with a single JWT_SECRET value.
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;

module.exports = {
  PORT: process.env.PORT || 4000,
  JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET,
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN,
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN,
  DB: {
    HOST: process.env.DB_HOST,
    PORT: process.env.DB_PORT || 5432,
    USER: process.env.DB_USER,
    PASSWORD: process.env.DB_PASSWORD,
    NAME: process.env.DB_NAME,
  },
};