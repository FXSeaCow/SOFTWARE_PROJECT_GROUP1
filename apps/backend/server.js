const express = require('express');
const pool = require('./config/db');
const env = require('./config/env');

const app = express();

app.get('/', async (req, res) => {
  const result = await pool.query('SELECT NOW()');
  res.json(result.rows[0]);
});

const PORT = env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app; // exported for tests/harnesses