const express = require('express');
const pool = require('./config/db');

const app = express();

app.get('/', async (req, res) => {
  const result = await pool.query('SELECT NOW()');
  res.json(result.rows[0]);
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});