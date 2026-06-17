const crypto = require("crypto");

const DIGEST = "sha512";
const ITERATIONS = 100000;
const KEY_LENGTH = 64;

function hashPassword(password) {
  // Hash mật khẩu với salt riêng cho từng user.
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST)
    .toString("hex");

  return `${ITERATIONS}:${KEY_LENGTH}:${DIGEST}:${salt}:${hash}`;
}

function verifyPassword(password, storedPasswordHash) {
  // So sánh hash bằng timingSafeEqual để giảm rủi ro timing attack.
  if (typeof storedPasswordHash !== "string") {
    return false;
  }

  const [iterations, keyLength, digest, salt, hash] = storedPasswordHash.split(":");

  if (!iterations || !keyLength || !digest || !salt || !hash) {
    return false;
  }

  const parsedIterations = Number(iterations);
  const parsedKeyLength = Number(keyLength);

  if (!Number.isFinite(parsedIterations) || !Number.isFinite(parsedKeyLength)) {
    return false;
  }

  const hashedInput = crypto
    .pbkdf2Sync(
      password,
      salt,
      parsedIterations,
      parsedKeyLength,
      digest,
    )
    .toString("hex");

  const storedBuffer = Buffer.from(hash, "hex");
  const inputBuffer = Buffer.from(hashedInput, "hex");

  return (
    storedBuffer.length === inputBuffer.length &&
    crypto.timingSafeEqual(storedBuffer, inputBuffer)
  );
}

module.exports = {
  hashPassword,
  verifyPassword,
};
