const { Pool } = require('pg');
const { DB } = require('./env');

const pool = new Pool({
  host: DB.HOST,
  port: DB.PORT,
  user: DB.USER,
  password: DB.PASSWORD,
  database: DB.NAME,
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => console.error('Unexpected PG pool error', err));

module.exports = pool;