// src/lib/staffManage.js
import { api } from "./api";

/* ---------------------------------------------------
 * Helpers
 * --------------------------------------------------- */

// Một số BE trả 200/204 không có body -> tránh lỗi JSON/undefined
async function safeDelete(url) {
  try {
    const res = await api.delete(url);
    return res?.data?.data ?? res?.data ?? true;
  } catch (e) {
    // quăng để UI hiển thị toast/message
    throw e;
  }
}

/** Chuẩn hoá object staff (tuỳ chọn) */
export function normalizeStaff(raw = {}) {
  return {
    staffId: raw.staffId ?? raw.id,
    accountId: raw.accountId,
    staffRole: raw.staffRole,        // "ADMIN" | "OPERATOR" | "TECHNICIAN" | ...
    isActive: !!raw.isActive,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    username: raw.username ?? raw.account?.username ?? null,
    email: raw.email ?? raw.account?.email ?? null,
    phoneNumber: raw.phoneNumber ?? raw.account?.phoneNumber ?? null,
    // mở rộng thêm nếu BE trả các trường khác
  };
}

/** Enum role để dùng lại phía UI */
export const STAFF_ROLES = {
  ADMIN: "ADMIN",
  OPERATOR: "OPERATOR",
  TECHNICIAN: "TECHNICIAN",
  SUPPORT: "CUSTOMER_SUPPORT_STAFF",
};

/* ---------------------------------------------------
 * CRUD
 * --------------------------------------------------- */

/** GET /api/admin/staff – Lấy tất cả staff */
export async function listStaff() {
  const { data } = await api.get("/api/admin/staff");
  const payload = data?.data ?? data ?? [];
  return Array.isArray(payload) ? payload.map(normalizeStaff) : [];
}

/** GET /api/admin/staff/{staffId} – Lấy staff theo ID */
export async function getStaffById(staffId) {
  const { data } = await api.get(`/api/admin/staff/${Number(staffId)}`);
  const payload = data?.data ?? data ?? null;
  return payload ? normalizeStaff(payload) : null;
}

/** POST /api/admin/staff – Tạo staff
 * body ví dụ: { accountId: 3, staffRole: "OPERATOR" }
 */
export async function createStaff({ username, email, password, phoneNumber, staffRole }) {
  const body = {
    username,
    email,
    password,
    phoneNumber,
    staffRole,
  };
  const { data } = await api.post("/api/admin/staff", body);
  const payload = data?.data ?? data ?? null;
  return payload ? normalizeStaff(payload) : null;
}

/** DELETE /api/admin/staff/{staffId} – Xoá (soft-delete) staff */
export async function deleteStaff(staffId) {
  return safeDelete(`/api/admin/staff/${Number(staffId)}`);
}
export async function listActiveStaff() {
  const { data } = await api.get("/api/staff/active");
  const payload = data?.data ?? data ?? [];
  return Array.isArray(payload) ? payload.map(normalizeStaff) : [];
}

/* ---------------------------------------------------
 * Updates
 * --------------------------------------------------- */

/** PUT /api/admin/staff/{staffId}/status?isActive=true|false – Cập nhật trạng thái hoạt động */
export async function updateStaffStatus(staffId, isActive) {
  const { data } = await api.put(
    `/api/admin/staff/${Number(staffId)}/status`,
    null,
    { params: { isActive: Boolean(isActive) } }
  );
  const payload = data?.data ?? data ?? null;
  return payload ? normalizeStaff(payload) : null;
}

/** PUT /api/admin/staff/{staffId}/role – Cập nhật role (nếu BE có endpoint này).
 *  Nếu backend KHÔNG có route này, hãy comment hàm dưới và dùng route thực tế.
 */
// Đúng theo swagger: staffRole là query param
export async function updateStaffRole(staffId, staffRole) {
    const { data } = await api.put(
      `/api/admin/staff/${Number(staffId)}/role`,
      null,
      { params: { staffRole } }      // ✅ truyền qua query
    );
    return data?.data ?? data ?? null; // 1 số BE trả object, 1 số trả true
  }
  

/* ---------------------------------------------------
 * Queries phụ
 * --------------------------------------------------- */

/** GET /api/admin/staff/role/{staffRole} – Lấy staff theo role */
export async function listStaffByRole(staffRole) {
  const { data } = await api.get(`/api/admin/staff/role/${staffRole}`);
  const payload = data?.data ?? data ?? [];
  return Array.isArray(payload) ? payload.map(normalizeStaff) : [];
}
