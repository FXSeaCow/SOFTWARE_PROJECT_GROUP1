const db = require('../../config/db');

const findByIdWithHash = async (id) => {
  const { rows } = await db.query(
    `SELECT id, password_hash
     FROM users
     WHERE id = $1`,
    [id]
  );

  return rows[0] || null;
};

const updatePassword = async (id, newPasswordHash) => {
  await db.query(
    `UPDATE users
     SET password_hash = $1, updated_at = now()
     WHERE id = $2`,
    [newPasswordHash, id]
  );
};

module.exports = {
  findByIdWithHash,
  updatePassword,
};
