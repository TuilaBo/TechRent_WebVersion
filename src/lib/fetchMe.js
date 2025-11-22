// src/lib/accountApi.js
import { api } from "./api";

/** Lấy thông tin tài khoản hiện tại */
export async function fetchMe() {
  const { data } = await api.get("/api/auth/me"); // hoặc /api/accounts/me tuỳ BE
  // Dữ liệu bạn đưa ra: data.data = { accountId, username, email, role, phoneNumber, isActive }
  return data?.data ?? data;
}
