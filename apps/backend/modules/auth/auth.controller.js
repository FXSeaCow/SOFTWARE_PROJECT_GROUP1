const { requireAuth } = require("../../middlewares/auth.middleware");
const { parseJsonBody, sendJson } = require("../../utils/http");
const { loginUser, registerUser } = require("./auth.service");

async function register(req, res) {
  // Nhận dữ liệu đăng ký và trả về session sau khi tạo tài khoản.
  const payload = await parseJsonBody(req);
  const session = await registerUser(payload);

  sendJson(res, 201, {
    message: "Registered successfully",
    ...session,
  });
}

async function login(req, res) {
  // Kiểm tra email/mật khẩu và trả về accessToken nếu hợp lệ.
  const payload = await parseJsonBody(req);
  const session = await loginUser(payload);

  sendJson(res, 200, {
    message: "Logged in successfully",
    ...session,
  });
}

async function me(req, res) {
  // Trả về thông tin user dựa trên token gửi lên.
  const user = await requireAuth(req);

  sendJson(res, 200, {
    user,
  });
}

async function logout(_req, res) {
  sendJson(res, 200, {
    message: "Logged out successfully",
  });
}

module.exports = {
  login,
  logout,
  me,
  register,
};
