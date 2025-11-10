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

/** Chuẩn hoá object Customer về key "thân thiện" cho FE (tuỳ chọn) */
export function normalizeCustomer(c = {}) {
  // Lấy mảng addresses và banks từ API
  const shippingAddresses = c.shippingAddressDtos ?? c.shippingAddresses ?? [];
  const bankInformations = c.bankInformationDtos ?? c.bankInformations ?? [];
  
  // Nếu không có shippingAddress đơn lẻ, lấy từ mảng đầu tiên
  const shippingAddress = c.shippingAddress ?? shippingAddresses[0]?.address ?? "";
  
  // Nếu không có bank info đơn lẻ, lấy từ mảng đầu tiên
  const bankInfo = bankInformations[0] || {};
  const bankAccountNumber = c.bankAccountNumber ?? bankInfo.cardNumber ?? "";
  const bankName = c.bankName ?? bankInfo.bankName ?? "";
  const bankAccountHolder = c.bankAccountHolder ?? bankInfo.bankHolder ?? "";
  
  return {
    id: c.customerId ?? c.id,
    email: c.email ?? "",
    phoneNumber: c.phoneNumber ?? "",
    fullName: c.fullName ?? c.name ?? "",
    shippingAddress: shippingAddress,
    bankAccountNumber: bankAccountNumber,
    bankName: bankName,
    bankAccountHolder: bankAccountHolder,
    // Arrays for multiple addresses and banks
    shippingAddresses: shippingAddresses,
    bankInformations: bankInformations,
    isActive: c.isActive ?? c.active ?? true,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

/** ----------------- APIs cho end-user (me) ----------------- */

/** Lấy hồ sơ customer của tài khoản hiện tại (Bearer token) */
export async function fetchMyCustomerProfile() {
  // BE endpoint dùng dạng số nhiều: /api/customers/profile
  const res = await api.get("/api/customers/profile");
  return unwrap(res);
}

/** Cập nhật hồ sơ của chính mình */
export async function updateMyCustomerProfile(payload) {
  // payload cho phép: { email, phoneNumber, fullName, shippingAddress, bankAccountNumber, bankName, bankAccountHolder }
  const res = await api.put("/api/customers/profile", payload);
  return unwrap(res);
}

/** ----------------- APIs quản trị / danh sách ----------------- */

/** 1) Lấy danh sách customers */
export async function listCustomers() {
  // BE hiện không yêu cầu query params; nếu sau này có, truyền thêm ở đây
  const res = await api.get("/api/customers");
  const raw = unwrap(res) ?? [];
  return Array.isArray(raw) ? raw : [];
}

/** 2) Xem chi tiết customer theo ID (bạn đã có sẵn – giữ lại để dùng chung) */
export async function fetchCustomerById(customerId) {
  const res = await api.get(`/api/customers/${Number(customerId)}`);
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
  const res = await api.put(`/api/customers/${Number(customerId)}`, body);
  return unwrap(res);
}

/** 4) Xoá customer theo ID (dành cho admin) */
export async function deleteCustomerById(customerId) {
  return safeDelete(`/api/customers/${Number(customerId)}`);
}

/** ----------------- Bank Information (CRUD) ----------------- */

// GET /api/bank-informations
export async function listBankInformations() {
  const res = await api.get("/api/bank-informations");
  const raw = unwrap(res) ?? [];
  return Array.isArray(raw) ? raw : [];
}

// GET /api/bank-informations/{id}
export async function getBankInformationById(id) {
  const res = await api.get(`/api/bank-informations/${Number(id)}`);
  return unwrap(res);
}

// POST /api/bank-informations
// body: { bankName, bankHolder, cardNumber }
export async function createBankInformation(payload) {
  const body = {
    bankName: payload.bankName,
    bankHolder: payload.bankHolder,
    cardNumber: payload.cardNumber,
  };
  const res = await api.post("/api/bank-informations", body);
  return unwrap(res);
}

// PUT /api/bank-informations/{id}
export async function updateBankInformation(id, payload) {
  const body = {
    bankName: payload.bankName,
    bankHolder: payload.bankHolder,
    cardNumber: payload.cardNumber,
  };
  const res = await api.put(`/api/bank-informations/${Number(id)}`, body);
  return unwrap(res);
}

// DELETE /api/bank-informations/{id}
export async function deleteBankInformation(id) {
  return safeDelete(`/api/bank-informations/${Number(id)}`);
}

/** ----------------- Shipping Address (CRUD) ----------------- */

// GET /api/shipping-addresses
export async function listShippingAddresses() {
  const res = await api.get("/api/shipping-addresses");
  const raw = unwrap(res) ?? [];
  return Array.isArray(raw) ? raw : [];
}

// GET /api/shipping-addresses/{id}
export async function getShippingAddressById(id) {
  const res = await api.get(`/api/shipping-addresses/${Number(id)}`);
  return unwrap(res);
}

// POST /api/shipping-addresses
// body: { address }
export async function createShippingAddress(payload) {
  const body = { address: payload.address };
  const res = await api.post("/api/shipping-addresses", body);
  return unwrap(res);
}

// PUT /api/shipping-addresses/{id}
export async function updateShippingAddress(id, payload) {
  const body = { address: payload.address };
  const res = await api.put(`/api/shipping-addresses/${Number(id)}`, body);
  return unwrap(res);
}

// DELETE /api/shipping-addresses/{id}
export async function deleteShippingAddress(id) {
  return safeDelete(`/api/shipping-addresses/${Number(id)}`);
}