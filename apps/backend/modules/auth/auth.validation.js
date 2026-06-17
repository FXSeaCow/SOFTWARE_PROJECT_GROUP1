const { createHttpError } = require("../../utils/httpError");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toTrimmedString(value) {
  // Chỉ nhận chuỗi, các kiểu dữ liệu khác xem như rỗng.
  return typeof value === "string" ? value.trim() : "";
}

function validateRegisterPayload(payload) {
  // Gom lỗi theo từng field để frontend có thể hiển thị chi tiết.
  const name = toTrimmedString(payload.name);
  const email = toTrimmedString(payload.email).toLowerCase();
  const password = typeof payload.password === "string" ? payload.password : "";
  const errors = {};

  if (!name) {
    errors.name = "Name is required";
  } else if (name.length < 2) {
    errors.name = "Name must be at least 2 characters";
  }

  if (!email) {
    errors.email = "Email is required";
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.email = "Email format is invalid";
  }

  if (!password) {
    errors.password = "Password is required";
  } else if (password.length < 6) {
    errors.password = "Password must be at least 6 characters";
  }

  if (Object.keys(errors).length > 0) {
    throw createHttpError(422, "Validation failed", errors);
  }

  return {
    email,
    name,
    password,
  };
}

function validateLoginPayload(payload) {
  // Login chỉ cần email và password.
  const email = toTrimmedString(payload.email).toLowerCase();
  const password = typeof payload.password === "string" ? payload.password : "";
  const errors = {};

  if (!email) {
    errors.email = "Email is required";
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.email = "Email format is invalid";
  }

  if (!password) {
    errors.password = "Password is required";
  }

  if (Object.keys(errors).length > 0) {
    throw createHttpError(422, "Validation failed", errors);
  }

  return {
    email,
    password,
  };
}

module.exports = {
  validateLoginPayload,
  validateRegisterPayload,
};
