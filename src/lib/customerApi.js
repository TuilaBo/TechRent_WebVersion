// src/lib/customerApi.js
import { api } from "./api";

/** Lấy hồ sơ customer của tài khoản hiện tại (yêu cầu Bearer token) */
export async function fetchMyCustomerProfile() {
  const { data } = await api.get("/api/customer/profile");
  return data?.data || data; // swagger của bạn bọc trong { data: {...} }
}

/** (Tuỳ chọn) Lấy customer theo id cụ thể — chỉ dùng khi thật sự cần */
export async function fetchCustomerById(customerId) {
  const { data } = await api.get(`/api/customer/${customerId}`);
  return data?.data || data;
}

/** (Tuỳ chọn) Cập nhật hồ sơ — khi BE mở API PUT */
export async function updateMyCustomerProfile(payload) {
  // ví dụ: { fullName, phoneNumber, shippingAddress }
  const { data } = await api.put("/api/customer/profile", payload);
  return data?.data || data;
}
