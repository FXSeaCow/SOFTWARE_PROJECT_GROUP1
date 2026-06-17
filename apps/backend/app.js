const { authRoutes } = require("./modules/auth/auth.routes");
const { createHttpError } = require("./utils/httpError");
const { applyCors, getPathname, sendError, sendJson } = require("./utils/http");

const routes = [...authRoutes];

async function handleRequest(req, res) {
  // Gắn CORS cho mọi request để frontend có thể gọi API từ Vite.
  applyCors(req, res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    const pathname = getPathname(req);

    // Endpoint đơn giản để kiểm tra server còn sống.
    if (req.method === "GET" && pathname === "/health") {
      sendJson(res, 200, {
        status: "ok",
      });
      return;
    }

    // Tìm route theo method và pathname, ví dụ POST /api/auth/login.
    const route = routes.find(
      (candidate) =>
        candidate.method === req.method && candidate.path === pathname,
    );

    if (!route) {
      throw createHttpError(404, "Route not found");
    }

    await route.handler(req, res);
  } catch (error) {
    sendError(res, error);
  }
}

module.exports = {
  handleRequest,
};
