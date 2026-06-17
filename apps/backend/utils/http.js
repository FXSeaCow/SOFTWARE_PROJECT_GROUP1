const { env } = require("../config/env");
const { MAX_JSON_BODY_BYTES } = require("../config/constants");
const { createHttpError } = require("./httpError");

function applyCors(req, res) {
  // Cho phép frontend gọi API từ origin được cấu hình trong .env.
  const requestOrigin = req.headers.origin;
  const allowedOrigins = env.CORS_ORIGIN.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (allowedOrigins.includes("*")) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  } else if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    res.setHeader("Access-Control-Allow-Origin", requestOrigin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  } else if (allowedOrigins.length > 0) {
    res.setHeader("Access-Control-Allow-Origin", allowedOrigins[0]);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }

  res.setHeader("Vary", "Origin");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization",
  );
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  );
}

function getPathname(req) {
  const baseUrl = `http://${req.headers.host || "localhost"}`;
  return new URL(req.url, baseUrl).pathname;
}

function parseJsonBody(req) {
  // Đọc JSON body thủ công vì backend đang dùng http module thuần của Node.
  return new Promise((resolve, reject) => {
    let rawBody = "";
    let isRejected = false;

    req.on("data", (chunk) => {
      rawBody += chunk;

      if (Buffer.byteLength(rawBody) > MAX_JSON_BODY_BYTES) {
        isRejected = true;
        reject(createHttpError(413, "Request body is too large"));
        req.destroy();
      }
    });

    req.on("end", () => {
      if (isRejected) {
        return;
      }

      if (!rawBody.trim()) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(rawBody));
      } catch {
        reject(createHttpError(400, "Request body must be valid JSON"));
      }
    });

    req.on("error", () => {
      if (!isRejected) {
        reject(createHttpError(400, "Unable to read request body"));
      }
    });
  });
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(payload));
}

function sendError(res, error) {
  // Lỗi 5xx chỉ trả message chung, còn chi tiết được log ở server.
  const statusCode = error.statusCode || 500;
  const payload = {
    message: statusCode >= 500 ? "Internal server error" : error.message,
  };

  if (error.details && statusCode < 500) {
    payload.details = error.details;
  }

  if (statusCode >= 500) {
    console.error(error);
  }

  sendJson(res, statusCode, payload);
}

module.exports = {
  applyCors,
  getPathname,
  parseJsonBody,
  sendError,
  sendJson,
};
