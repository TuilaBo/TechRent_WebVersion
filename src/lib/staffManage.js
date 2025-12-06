// src/lib/staffManage.js
import { api } from "./api";

/* ---------------------------------------------------
 * Helpers
 * --------------------------------------------------- */

// Một số BE trả 200/204 không có body -&gt; tránh lỗi JSON/undefined
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

/* ---------------------------------------------------
 * Search & Performance
 * --------------------------------------------------- */

/** GET /api/staff/search – Tìm kiếm staff theo role và availability trong khoảng thời gian
 * @param {Object} params - Search parameters
 * @param {string} params.startTime - Start time (ISO date-time string, e.g., "2025-11-14T02:53:00")
 * @param {string} params.endTime - End time (ISO date-time string, e.g., "2025-11-14T09:00:00")
 * @param {boolean} [params.available] - Filter by availability status
 * @param {string} [params.staffRole] - Filter by staff role (e.g., "TECHNICIAN")
 * @returns {Promise<Array>} Array of staff members matching the criteria
 */
export async function searchStaff({ startTime, endTime, available, staffRole }) {
  const params = {};
  if (startTime) params.startTime = startTime;
  if (endTime) params.endTime = endTime;
  if (available !== undefined && available !== null) params.available = Boolean(available);
  if (staffRole) params.staffRole = staffRole;

  const { data } = await api.get("/api/staff/search", { params });
  const payload = data?.data ?? data ?? [];
  return Array.isArray(payload) ? payload.map(normalizeStaff) : [];
}

/** GET /api/staff/tasks/completion-stats – Thống kê số lượng task hoàn thành theo tháng cho từng nhân viên
 * @param {Object} params - Query parameters
 * @param {number} params.year - Year (required, e.g., 2025)
 * @param {number} params.month - Month (required, e.g., 12 for December)
 * @param {number} [params.taskCategoryId] - Filter by task category ID (optional)
 * @returns {Promise<Array>} Array of staff performance/completion data
 */
export async function getStaffCompletionLeaderboard({ year, month, taskCategoryId }) {
  if (!year || !month) {
    throw new Error("year and month are required parameters");
  }

  const params = {
    year: Number(year),
    month: Number(month),
  };
  if (taskCategoryId) params.taskCategoryId = Number(taskCategoryId);

  const { data } = await api.get("/api/staff/tasks/completion-stats", { params });
  return data?.data ?? data ?? [];
}

/** GET /api/staff/performance/completions – Thống kê số lượng task hoàn thành theo tháng cho từng nhân viên (có phân trang và sắp xếp)
 * @param {Object} params - Query parameters
 * @param {number} params.year - Year (required, e.g., 2025)
 * @param {number} params.month - Month (required, e.g., 11 for November)
 * @param {string} [params.staffRole] - Filter by staff role (e.g., "TECHNICIAN")
 * @param {number} [params.page] - Page number (optional, default: 0)
 * @param {number} [params.size] - Page size (optional, default: 20)
 * @param {string} [params.sort] - Sort field and direction (optional, e.g., "completedTaskCount,desc")
 * @returns {Promise<Object>} Paginated staff performance/completion data with { content, totalElements, totalPages, etc. }
 */
export async function getStaffPerformanceCompletions({ year, month, staffRole, page, size, sort }) {
  if (!year || !month) {
    throw new Error("year and month are required parameters");
  }

  const params = {
    year: Number(year),
    month: Number(month),
  };
  if (staffRole) params.staffRole = staffRole;
  if (page !== undefined && page !== null) params.page = Number(page);
  if (size !== undefined && size !== null) params.size = Number(size);
  if (sort) params.sort = sort;

  const { data } = await api.get("/api/staff/performance/completions", { params });
  return data?.data ?? data ?? {};
}

/** GET /api/staff/tasks/category-stats – Lấy thống kê công việc theo category của nhân viên
 * @param {Object} params - Query parameters
 * @param {number} params.staffId - Staff ID (required)
 * @param {string} params.date - Date (required, format: YYYY-MM-DD)
 * @param {number} [params.categoryId] - Task Category ID (optional, filter by specific category)
 * @returns {Promise<Array>} Array of category stats with { staffId, staffName, taskCategoryId, taskCategoryName, taskCount, maxTasksPerDay }
 */
export async function getStaffCategoryStats({ staffId, date, categoryId }) {
  if (!staffId || !date) {
    throw new Error("staffId and date are required parameters");
  }

  const params = {
    staffId: Number(staffId),
    date: date,
  };

  if (categoryId) {
    params.categoryId = Number(categoryId);
  }

  const { data } = await api.get("/api/staff/tasks/category-stats", { params });
  return data?.data ?? data ?? [];
}
