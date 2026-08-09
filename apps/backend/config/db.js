const { Pool } = require('pg');
const { DB } = require('./env');

const pool = new Pool(
  DB.CONNECTION_STRING
    ? {
        connectionString: DB.CONNECTION_STRING,
        max: 10,
        idleTimeoutMillis: 30000,
        ssl: { rejectUnauthorized: false },
      }
    : {
        host: DB.HOST,
        port: DB.PORT,
        user: DB.USER,
        password: DB.PASSWORD,
        database: DB.NAME,
        max: 10,
        idleTimeoutMillis: 30000,
        ssl: DB.SSL ? { rejectUnauthorized: false } : false,
      }
);

pool.on('error', (err) => console.error('Unexpected PG pool error', err));

module.exports = pool;