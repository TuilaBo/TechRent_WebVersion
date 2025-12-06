// src/lib/technicianTaskApi.js
import { api } from "./api";

/** -------------------------------------------------
 *  Helpers
 * ------------------------------------------------- */
const unwrap = (res) => res?.data?.data ?? res?.data ?? null;

/** Convert BE payload -> FE shape (optional but handy) */
export function normalizeTechnicianTask(raw = {}) {
  return {
    taskId: raw.taskId ?? raw.id,
    taskCategoryId: raw.taskCategoryId,
    taskCategoryName: raw.taskCategoryName ?? "",
    orderId: raw.orderId ?? null,
    assignedStaffId: raw.assignedStaffId ?? null,
    assignedStaffName: raw.assignedStaffName ?? "",
    assignedStaffRole: raw.assignedStaffRole ?? "",
    type: raw.type ?? "",
    description: raw.description ?? "",
    plannedStart: raw.plannedStart ?? null,
    plannedEnd: raw.plannedEnd ?? null,
    status: raw.status ?? null,            // "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"
    createdAt: raw.createdAt ?? null,
    completedAt: raw.completedAt ?? null,
  };
}

/** Optional enum for status used by technician endpoints */
export const TECH_TASK_STATUS = {
  PENDING: "PENDING",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
};

// Màu cho trạng thái (dùng cho Tag/Badge ở UI)
export const TECH_TASK_STATUS_COLOR = {
  PENDING: { bg: "#000000", text: "#ffffff" },        // nền đen, chữ trắng
  IN_PROGRESS: { bg: "#1677ff", text: "#ffffff" },   // xanh dương
  COMPLETED: { bg: "#52c41a", text: "#ffffff" },     // xanh lá
  CANCELLED: { bg: "#ff4d4f", text: "#ffffff" },     // đỏ
};

export function getTechnicianStatusColor(status) {
  const key = String(status || "").toUpperCase();
  return (
    TECH_TASK_STATUS_COLOR[key] || { bg: "#000000", text: "#ffffff" }
  );
}

// Map task status to Ant Design Badge status
export function getTaskBadgeStatus(status) {
  const key = String(status || "").toUpperCase();
  switch (key) {
    case "PENDING":
      return "warning";    // Cần xử lý
    case "IN_PROGRESS":
      return "processing"; // Đang thực hiện
    case "COMPLETED":
      return "success";    // Đã hoàn thành
    case "CANCELLED":
      return "error";      // Đã hủy
    default:
      return "default";
  }
}

/** -------------------------------------------------
 *  APIs
 * ------------------------------------------------- */

/** GET /api/technician/tasks?status=...  */
export async function listTechnicianTasks(status = TECH_TASK_STATUS.PENDING) {
  const { data } = await api.get("/api/technician/tasks", {
    params: { status },
  });
  // Response structure: { status, message, details, code, data: [...] }
  const payload = data?.data ?? unwrap(data) ?? [];
  return Array.isArray(payload) ? payload.map(normalizeTechnicianTask) : [];
}

/** GET /api/technician/tasks/{taskId} */
export async function getTechnicianTaskById(taskId) {
  const { data } = await api.get(`/api/technician/tasks/${Number(taskId)}`);
  // Response structure: { status, message, details, code, data: {...} }
  const payload = data?.data ?? unwrap(data) ?? null;
  return payload ? normalizeTechnicianTask(payload) : null;
}

/** PUT /api/technician/tasks/{taskId}/status?status=... */
export async function updateTechnicianTaskStatus(taskId, status) {
  const { data } = await api.put(
    `/api/technician/tasks/${Number(taskId)}/status`,
    null,
    { params: { status } }
  );
  // Response structure: { status, message, details, code, data: {...} }
  const payload = data?.data ?? unwrap(data) ?? null;
  return payload ? normalizeTechnicianTask(payload) : null;
}
