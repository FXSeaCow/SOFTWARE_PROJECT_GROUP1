const crypto = require("crypto");

const { env } = require("../config/env");
const { createHttpError } = require("./httpError");

function base64UrlEncode(value) {
  const input = typeof value === "string" ? value : JSON.stringify(value);

  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(value) {
  const paddedValue = value.padEnd(
    value.length + ((4 - (value.length % 4)) % 4),
    "=",
  );

  return Buffer.from(
    paddedValue.replace(/-/g, "+").replace(/_/g, "/"),
    "base64",
  ).toString("utf8");
}

function sign(input) {
  // Ký dữ liệu bằng secret để token không thể bị sửa nội dung tùy ý.
  return crypto
    .createHmac("sha256", env.JWT_SECRET)
    .update(input)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function safeCompare(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function signToken(payload) {
  // Tạo token dạng JWT đơn giản gồm header, payload và chữ ký.
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = {
    alg: "HS256",
    typ: "JWT",
  };
  const body = {
    ...payload,
    iat: issuedAt,
    exp: issuedAt + env.JWT_EXPIRES_IN_SECONDS,
  };
  const signingInput = `${base64UrlEncode(header)}.${base64UrlEncode(body)}`;

  return `${signingInput}.${sign(signingInput)}`;
}

function verifyToken(token) {
  // Kiểm tra cấu trúc, chữ ký và hạn dùng của access token.
  const [encodedHeader, encodedPayload, signature] = token.split(".");

  if (!encodedHeader || !encodedPayload || !signature) {
    throw createHttpError(401, "Invalid access token");
  }

  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = sign(signingInput);

  if (!safeCompare(signature, expectedSignature)) {
    throw createHttpError(401, "Invalid access token");
  }

  let header;
  let payload;

  try {
    header = JSON.parse(base64UrlDecode(encodedHeader));
    payload = JSON.parse(base64UrlDecode(encodedPayload));
  } catch {
    throw createHttpError(401, "Invalid access token");
  }

  if (header.alg !== "HS256" || header.typ !== "JWT") {
    throw createHttpError(401, "Invalid access token");
  }

  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw createHttpError(401, "Access token has expired");
  }

  return payload;
}

module.exports = {
  signToken,
  verifyToken,
};
