const { AUTH_TOKEN_TYPE } = require("../config/constants");
const { findUserById } = require("../config/db");
const { createHttpError } = require("../utils/httpError");
const { verifyToken } = require("../utils/token");

function toPublicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function getBearerToken(req) {
  // Lấy token từ header Authorization: Bearer <token>.
  const authorization = req.headers.authorization || "";
  const [type, token] = authorization.split(" ");

  if (type !== AUTH_TOKEN_TYPE || !token) {
    throw createHttpError(401, "Authorization token is required");
  }

  return token;
}

async function requireAuth(req) {
  // Xác thực token rồi nạp lại user hiện tại từ nơi lưu trữ.
  const token = getBearerToken(req);
  const payload = verifyToken(token);
  const user = await findUserById(payload.sub);

  if (!user) {
    throw createHttpError(401, "Authenticated user no longer exists");
  }

  return toPublicUser(user);
}

module.exports = {
  requireAuth,
  toPublicUser,
};
