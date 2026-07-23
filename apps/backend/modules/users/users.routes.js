const router = require('express').Router();

const ctrl = require('./users.controller');
const { authenticate } = require('../../middlewares/Auth.middleware');
const { validate } = require('../../middlewares/Validate.middleware');
const { changePasswordSchema } = require('./users.validation');

router.use(authenticate);

router.patch(
  '/me/password',
  validate(changePasswordSchema),
  ctrl.changePassword
);

module.exports = router;
