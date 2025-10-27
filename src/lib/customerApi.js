// src/lib/customerApi.js
import { api } from "./api";

/** ----------------- Helpers ----------------- */
function unwrap(res) {
  // Backend của bạn hay bọc data trong { data: ... }
  return res?.data?.data ?? res?.data ?? null;
}

async function safeDelete(path) {
  try {
    const res = await api.delete(path);
    // nhiều API trả 204 No Content
    return unwrap(res) ?? true;
  } catch (e) {
    if (e?.response?.status === 204) return true;
    throw e;
  }
}

/** Chuẩn hoá object Customer về key “thân thiện” cho FE (tuỳ chọn) */
export function normalizeCustomer(c = {}) {
  return {
    id: c.customerId ?? c.id,
    email: c.email ?? "",
    phoneNumber: c.phoneNumber ?? "",
    fullName: c.fullName ?? c.name ?? "",
    shippingAddress: c.shippingAddress ?? "",
    bankAccountNumber: c.bankAccountNumber ?? "",
    bankName: c.bankName ?? "",
    bankAccountHolder: c.bankAccountHolder ?? "",
    isActive: c.isActive ?? c.active ?? true,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

/** ----------------- APIs cho end-user (me) ----------------- */

/** Lấy hồ sơ customer của tài khoản hiện tại (Bearer token) */
export async function fetchMyCustomerProfile() {
  const res = await api.get("/api/customer/profile");
  return unwrap(res);
}

/** Cập nhật hồ sơ của chính mình */
export async function updateMyCustomerProfile(payload) {
  // payload cho phép: { email, phoneNumber, fullName, shippingAddress, bankAccountNumber, bankName, bankAccountHolder }
  const res = await api.put("/api/customer/profile", payload);
  return unwrap(res);
}

/** ----------------- APIs quản trị / danh sách ----------------- */

/** 1) Lấy danh sách customers */
export async function listCustomers() {
  // BE hiện không yêu cầu query params; nếu sau này có, truyền thêm ở đây
  const res = await api.get("/api/customer");
  const raw = unwrap(res) ?? [];
  return Array.isArray(raw) ? raw : [];
}

/** 2) Xem chi tiết customer theo ID (bạn đã có sẵn – giữ lại để dùng chung) */
export async function fetchCustomerById(customerId) {
  const res = await api.get(`/api/customer/${Number(customerId)}`);
  return unwrap(res);
}

/** 3) Cập nhật customer theo ID (dành cho admin) */
export async function updateCustomerById(customerId, payload) {
  // Cho phép các field dưới đây – đúng như schema bạn cung cấp
  const body = {
    email: payload.email,
    phoneNumber: payload.phoneNumber,
    fullName: payload.fullName,
    shippingAddress: payload.shippingAddress,
    bankAccountNumber: payload.bankAccountNumber,
    bankName: payload.bankName,
    bankAccountHolder: payload.bankAccountHolder,
  };
  const res = await api.put(`/api/customer/${Number(customerId)}`, body);
  return unwrap(res);
}

/** 4) Xoá customer theo ID (dành cho admin) */
export async function deleteCustomerById(customerId) {
  return safeDelete(`/api/customer/${Number(customerId)}`);
}
