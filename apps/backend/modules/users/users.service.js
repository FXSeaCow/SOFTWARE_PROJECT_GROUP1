const repo = require('./users.repository');
const ApiError = require('../../utils/Apierror');
const logger = require('../../utils/Logger');
const { comparePassword, hashPassword } = require('../../utils/Hash');

const changePassword = async (userId, { current_password, new_password }) => {
  const user = await repo.findByIdWithHash(userId);
  if (!user) {
    throw ApiError.notFound('User');
  }

  const isMatch = await comparePassword(current_password, user.password_hash);
  if (!isMatch) {
    throw ApiError.badRequest('Current password is incorrect');
  }

  const isSame = await comparePassword(new_password, user.password_hash);
  if (isSame) {
    throw ApiError.badRequest('New password must be different from the current password');
  }

  const newHash = await hashPassword(new_password);
  await repo.updatePassword(userId, newHash);

  logger.info('Password changed', { userId });
};

module.exports = {
  changePassword,
};
