const asyncHandler = require('../../utils/Asynchandler');
const ApiResponse = require('../../utils/Apiresponse');
const usersService = require('./users.service');

const changePassword = asyncHandler(async (req, res) => {
  const { current_password, new_password } = req.body;

  await usersService.changePassword(req.user.id, {
    current_password,
    new_password,
  });

  res.json(ApiResponse.success(null, 'Password changed successfully'));
});

module.exports = {
  changePassword,
};
