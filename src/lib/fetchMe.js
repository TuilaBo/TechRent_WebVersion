// src/lib/accountApi.js
import { api } from "./api";

/** Lấy thông tin tài khoản hiện tại */
export async function fetchMe() {
  const { data } = await api.get("/api/auth/me"); // hoặc /api/accounts/me tuỳ BE
  // Dữ liệu bạn đưa ra: data.data = { accountId, username, email, role, phoneNumber, isActive }
  return data?.data ?? data;
}

/** POST /api/auth/reset-password - Đặt lại mật khẩu bằng mã xác thực từ email
 * @param {object} body
 * @param {string} body.email
 * @param {string} body.code
 * @param {string} body.newPassword
 */
export async function resetPassword(body) {
  const payload = {
    email: String(body.email),
    code: String(body.code),
    newPassword: String(body.newPassword),
  };
  const { data } = await api.post("/api/auth/reset-password", payload);
  return data?.data ?? data;
}

/** POST /api/auth/forgot-password - Gửi mã đặt lại mật khẩu về email
 * @param {string} email
 */
export async function forgotPassword(email) {
  const payload = { email: String(email) };
  const { data } = await api.post("/api/auth/forgot-password", payload);
  return data?.data ?? data;
}

