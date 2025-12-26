// src/lib/taskApi.js
import { api } from "./api";

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

// Delete nhiều BE trả 200/204 không có body -> tránh lỗi parse
async function safeDelete(url) {
  const res = await api.delete(url);
  return res?.data?.data ?? res?.data ?? true;
}

/** Chuẩn hoá 1 task để UI dùng ổn định */
export function normalizeTask(raw = {}) {
  const assignedStaffArr = Array.isArray(raw.assignedStaff) ? raw.assignedStaff : [];
  return {
    taskId: raw.taskId ?? raw.id ?? raw.taskID,
    taskCategoryId: raw.taskCategoryId ?? raw.categoryId,
    taskCategoryName: raw.taskCategoryName ?? "",
    orderId: raw.orderId,
    // Back-compat các field đơn và cấu trúc mới nhiều người
    assignedStaffId: raw.assignedStaffId,
    assignedStaffName: raw.assignedStaffName ?? "",
    assignedStaffRole: raw.assignedStaffRole ?? "",
    assignedStaff: assignedStaffArr.map((s) => ({
      staffId: s.staffId ?? s.id ?? s.staffID,
      staffName: s.staffName ?? s.name ?? s.username ?? "",
      staffRole: s.staffRole ?? s.role ?? "",
    })),
    type: raw.type ?? "",
    description: raw.description ?? "",
    plannedStart: raw.plannedStart ?? null,
    plannedEnd: raw.plannedEnd ?? null,
    // các field hay gặp thêm
    status: raw.status ?? raw.taskStatus ?? null,
    createdAt: raw.createdAt ?? null,
    updatedAt: raw.updatedAt ?? null,
    completedAt: raw.completedAt ?? null,
  };
}

/* ------------------------------------------------------------------ */
/* Read APIs                                                          */
/* ------------------------------------------------------------------ */

/** GET /api/staff/tasks – Lấy danh sách task với filters và pagination
 *  params: { categoryId, orderId, assignedStaffId, status, page, size }
 *  @returns { content: Task[], page, size, totalElements, totalPages } hoặc Task[] nếu không có pagination
 */
export async function listTasks(params = {}) {
  const query = {};

  // Filter params
  if (params.categoryId !== undefined && params.categoryId !== null) {
    query.categoryId = Number(params.categoryId);
  }
  if (params.orderId !== undefined && params.orderId !== null) {
    query.orderId = Number(params.orderId);
  }
  if (params.assignedStaffId !== undefined && params.assignedStaffId !== null) {
    query.assignedStaffId = Number(params.assignedStaffId);
  }
  if (params.status) {
    query.status = params.status;
  }

  // Pagination params
  if (params.page !== undefined) {
    query.page = Number(params.page);
  }
  if (params.size !== undefined) {
    query.size = Number(params.size);
  }

  // Sorting params
  if (params.sortBy) {
    query.sortBy = params.sortBy;
  }

  const { data } = await api.get("/api/staff/tasks", { params: query });
  const payload = data?.data ?? data ?? [];

  // Handle paginated response
  if (payload && typeof payload === 'object' && Array.isArray(payload.content)) {
    return {
      content: payload.content.map(normalizeTask),
      page: payload.page ?? 0,
      size: payload.size ?? params.size ?? 10,
      totalElements: payload.totalElements ?? 0,
      totalPages: payload.totalPages ?? 0,
      numberOfElements: payload.numberOfElements ?? payload.content.length,
      last: payload.last ?? true,
    };
  }

  // Fallback for non-paginated response (backward compatibility)
  return Array.isArray(payload) ? payload.map(normalizeTask) : [];
}

/** GET /api/staff/tasks/{taskId} – Lấy chi tiết 1 task */
export async function getTaskById(taskId) {
  const { data } = await api.get(`/api/staff/tasks/${Number(taskId)}`);
  const payload = data?.data ?? data ?? null;
  return payload ? normalizeTask(payload) : null;
}

/** GET /api/staff/tasks/staff-assignments – Lịch làm việc trong ngày của staff
 * params: { staffId?: number, date?: string(YYYY-MM-DD) }
 */
export async function getStaffAssignments(params = {}) {
  const query = {};
  if (params.staffId !== undefined && params.staffId !== null) {
    query.staffId = Number(params.staffId);
  }
  if (params.date) {
    query.date = params.date;
  }

  const { data } = await api.get("/api/staff/tasks/staff-assignments", {
    params: query,
  });
  const payload = data?.data ?? data ?? [];
  return Array.isArray(payload) ? payload.map(normalizeTask) : [];
}

/** GET /api/staff/tasks/active-rule – Lấy rule tác vụ hiện hành trong hệ thống */
export async function getActiveTaskRule() {
  const { data } = await api.get("/api/staff/tasks/active-rule");
  // BE có thể bọc trong { status, message, data } nên ưu tiên lấy data.data
  return data?.data ?? data ?? null;
}

/* ------------------------------------------------------------------ */
/* Write APIs                                                         */
/* ------------------------------------------------------------------ */

/** POST /api/staff/tasks – Tạo task
 * body: {
 *  taskCategoryId, orderId, assignedStaffId, type, description,
 *  plannedStart (ISO), plannedEnd (ISO)
 * }
 */
export async function createTask(body) {
  const payload = {
    taskCategoryId: Number(body.taskCategoryId),
    ...(body.orderId !== undefined && body.orderId !== null && { orderId: Number(body.orderId) }),
    ...(Array.isArray(body.assignedStaffIds) && body.assignedStaffIds.length > 0 && {
      assignedStaffIds: body.assignedStaffIds.map((x) => Number(x)),
    }),
    type: String(body.type || "").trim(),
    description: String(body.description || "").trim(),
    plannedStart: body.plannedStart ?? null, // ISO string
    plannedEnd: body.plannedEnd ?? null,     // ISO string
  };
  const { data } = await api.post("/api/staff/tasks", payload);
  const res = data?.data ?? data ?? null;
  return res ? normalizeTask(res) : null;
}

/** PUT /api/staff/tasks/{taskId} – Cập nhật task
 * body: các field tương tự create (chỉ gửi những field muốn đổi)
 */
export async function updateTask(taskId, body) {
  const payload = {
    // chỉ map nếu có, tránh ghi đè null không chủ đích
    ...(body.taskCategoryId !== undefined && {
      taskCategoryId: Number(body.taskCategoryId),
    }),
    ...(body.orderId !== undefined && { orderId: Number(body.orderId) }),
    ...(Array.isArray(body.assignedStaffIds) && {
      assignedStaffIds: body.assignedStaffIds.map((x) => Number(x)),
    }),
    // Back-compat nếu BE vẫn chấp nhận 1 người (không gửi song song nếu đã có mảng)
    ...(!Array.isArray(body.assignedStaffIds) && body.assignedStaffId !== undefined && {
      assignedStaffId: Number(body.assignedStaffId),
    }),
    ...(body.type !== undefined && { type: String(body.type || "").trim() }),
    ...(body.description !== undefined && {
      description: String(body.description || "").trim(),
    }),
    ...(body.plannedStart !== undefined && { plannedStart: body.plannedStart }),
    ...(body.plannedEnd !== undefined && { plannedEnd: body.plannedEnd }),
  };

  const { data } = await api.put(
    `/api/staff/tasks/${Number(taskId)}`,
    payload
  );
  const res = data?.data ?? data ?? null;
  return res ? normalizeTask(res) : null;
}

/** DELETE /api/staff/tasks/{taskId} – Xoá task */
export async function deleteTask(taskId) {
  return safeDelete(`/api/staff/tasks/${Number(taskId)}`);
}

/** PATCH /api/staff/tasks/{taskId}/confirm-delivery – Xác nhận giao hàng
 * Technician/support confirms they will deliver for the task
 */
export async function confirmDelivery(taskId) {
  const { data } = await api.patch(`/api/staff/tasks/${Number(taskId)}/confirm-delivery`);
  return data?.data ?? data ?? null;
}

/** PATCH /api/staff/tasks/{taskId}/confirm-retrieval – Xác nhận thu hồi
 * Technician/support confirms they will retrieve goods for the task
 */
export async function confirmRetrieval(taskId) {
  const { data } = await api.patch(`/api/staff/tasks/${Number(taskId)}/confirm-retrieval`);
  return data?.data ?? data ?? null;
}

/** GET /api/staff/device-replacement-reports/task/{taskId} – Lấy biên bản thay thế thiết bị theo task
 * @param {number} taskId - ID của task Device Replacement
 * @returns {Promise<Array>} Danh sách biên bản thay thế thiết bị
 */
export async function getDeviceReplacementReportsByTaskId(taskId) {
  const { data } = await api.get(`/api/staff/device-replacement-reports/task/${Number(taskId)}`);
  return data?.data ?? data ?? [];
}

/** POST /api/staff/device-replacement-reports/{replacementReportId}/pin – Gửi PIN ký biên bản thay thế thiết bị
 * Technician/support sends PIN to customer for signing device replacement report
 * @param {number} replacementReportId - ID của biên bản thay thế thiết bị
 * @returns {Promise<Object>} Response with PIN sending result
 */
export async function sendDeviceReplacementReportPin(replacementReportId) {
  const { data } = await api.post(`/api/staff/device-replacement-reports/${Number(replacementReportId)}/pin`);
  return data?.data ?? data ?? null;
}

/** PATCH /api/staff/device-replacement-reports/{replacementReportId}/signature – Ký biên bản thay thế thiết bị
 * @param {number} replacementReportId - ID của biên bản thay thế thiết bị
 * @param {Object} params - Thông tin ký
 * @param {string} params.pin - Mã PIN xác nhận (được gửi qua email)
 * @param {string} params.signature - Chữ ký của technician
 * @returns {Promise<Object>} Response with signed report
 */
export async function signDeviceReplacementReport(replacementReportId, { pin, signature }) {
  const { data } = await api.patch(`/api/staff/device-replacement-reports/${Number(replacementReportId)}/signature`, {
    pin,
    signature,
  });
  return data?.data ?? data ?? null;
}

/** GET /api/staff/device-replacement-reports/{replacementReportId} – Lấy chi tiết biên bản thay thế thiết bị
 * @param {number} replacementReportId - ID của biên bản thay thế thiết bị
 * @returns {Promise<Object>} Response with replacement report details
 */
export async function getDeviceReplacementReportById(replacementReportId) {
  const { data } = await api.get(`/api/staff/device-replacement-reports/${Number(replacementReportId)}`);
  return data?.data ?? data ?? null;
}

/** 
 * Parse complaint ID from task description
 * Example: "Thay thế thiết bị cho đơn hàng #1404. Khiếu nại #3: ..."
 * @param {string} description - Task description
 * @returns {number|null} Complaint ID or null if not found
 */
export function parseComplaintIdFromDescription(description) {
  if (!description) return null;
  // Match "Khiếu nại #<number>" pattern
  const match = description.match(/Khiếu nại\s*#(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}

/** POST /api/staff/device-replacement-reports/{replacementReportId}/devices/{deviceId}/evidences
 * Upload bằng chứng cho thiết bị trong biên bản thay thế thiết bị
 * @param {number} replacementReportId - ID của biên bản thay thế
 * @param {number} deviceId - ID của thiết bị
 * @param {File[]} files - Danh sách file ảnh bằng chứng
 * @returns {Promise<Object>} Response with uploaded evidence info
 */
export async function uploadDeviceReplacementEvidence(replacementReportId, deviceId, files) {
  const formData = new FormData();
  if (Array.isArray(files)) {
    files.forEach((file) => {
      formData.append("files", file, file.name || "evidence.jpg");
    });
  } else if (files) {
    formData.append("files", files, files.name || "evidence.jpg");
  }

  const { data } = await api.post(
    `/api/staff/device-replacement-reports/${Number(replacementReportId)}/devices/${Number(deviceId)}/evidences`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return data?.data ?? data ?? null;
}
