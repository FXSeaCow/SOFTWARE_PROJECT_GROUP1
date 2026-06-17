const authController = require("./auth.controller");

const authRoutes = [
  {
    method: "POST",
    path: "/api/auth/register",
    handler: authController.register,
  },
  {
    method: "POST",
    path: "/api/auth/login",
    handler: authController.login,
  },
  {
    method: "GET",
    path: "/api/auth/me",
    handler: authController.me,
  },
  {
    method: "POST",
    path: "/api/auth/logout",
    handler: authController.logout,
  },
];

module.exports = {
  authRoutes,
};
