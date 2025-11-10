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

/** GET /api/staff/tasks – Lấy danh sách task
 *  Có thể truyền params filter nếu BE hỗ trợ (vd: { orderId, assignedStaffId })
 */
export async function listTasks(params = undefined) {
  const { data } = await api.get("/api/staff/tasks", { params });
  const payload = data?.data ?? data ?? [];
  return Array.isArray(payload) ? payload.map(normalizeTask) : [];
}

/** GET /api/staff/tasks/{taskId} – Lấy chi tiết 1 task */
export async function getTaskById(taskId) {
  const { data } = await api.get(`/api/staff/tasks/${Number(taskId)}`);
  const payload = data?.data ?? data ?? null;
  return payload ? normalizeTask(payload) : null;
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
