const crypto = require("crypto");

const { USER_ROLES } = require("../../config/constants");
const { findUserByEmail, insertUser } = require("../../config/db");
const { createHttpError } = require("../../utils/httpError");
const { hashPassword, verifyPassword } = require("../../utils/password");
const { signToken } = require("../../utils/token");
const {
  validateLoginPayload,
  validateRegisterPayload,
} = require("./auth.validation");

function createId() {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;
}

function toPublicUser(user) {
  // Không trả passwordHash ra ngoài API.
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function createAuthSession(user) {
  // Session trả cho frontend gồm accessToken và thông tin user an toàn.
  const publicUser = toPublicUser(user);
  const accessToken = signToken({
    sub: user.id,
    email: user.email,
    role: user.role,
  });

  return {
    accessToken,
    user: publicUser,
  };
}

async function registerUser(payload) {
  // Validate dữ liệu, kiểm tra email trùng, rồi lưu user mới.
  const data = validateRegisterPayload(payload);
  const existingUser = await findUserByEmail(data.email);

  if (existingUser) {
    throw createHttpError(409, "Email is already registered");
  }

  const now = new Date().toISOString();
  const user = {
    id: createId(),
    email: data.email,
    name: data.name,
    role: USER_ROLES.MEMBER,
    passwordHash: hashPassword(data.password),
    createdAt: now,
    updatedAt: now,
  };

  await insertUser(user);

  return createAuthSession(user);
}

async function loginUser(payload) {
  // Không nói rõ email hay mật khẩu sai để tránh lộ thông tin tài khoản.
  const data = validateLoginPayload(payload);
  const user = await findUserByEmail(data.email);

  if (!user || !verifyPassword(data.password, user.passwordHash)) {
    throw createHttpError(401, "Email or password is incorrect");
  }

  return createAuthSession(user);
}

module.exports = {
  loginUser,
  registerUser,
  toPublicUser,
};
