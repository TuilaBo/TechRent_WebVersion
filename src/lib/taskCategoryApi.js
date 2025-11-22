// src/lib/taskCategoryApi.js
import { api } from "./api";

/* ----------------------------- Helpers ----------------------------- */

// Một số BE trả 200/204 không có body khi delete -> tránh lỗi JSON/undefined
async function safeDelete(url) {
  try {
    const res = await api.delete(url);
    return res?.data?.data ?? res?.data ?? true;
  } catch (e) {
    throw e;
  }
}

/** Chuẩn hoá dữ liệu category để UI dùng ổn định */
export function normalizeTaskCategory(raw = {}) {
  return {
    taskCategoryId:
      raw.taskCategoryId ?? raw.taskcategoryId ?? raw.id ?? raw.categoryId,
    name: raw.name ?? "",
    description: raw.description ?? "",
    createdAt: raw.createdAt ?? null,
    updatedAt: raw.updatedAt ?? null,
  };
}

/* ----------------------------- Read APIs ----------------------------- */

/** GET /api/staff/task-categories – Lấy tất cả category (staff xem được) */
export async function listTaskCategories() {
  const { data } = await api.get("/api/staff/task-categories");
  const payload = data?.data ?? data ?? [];
  return Array.isArray(payload) ? payload.map(normalizeTaskCategory) : [];
}

/** GET /api/staff/task-categories/{categoryId} – Lấy chi tiết 1 category */
export async function getTaskCategoryById(categoryId) {
  const { data } = await api.get(
    `/api/staff/task-categories/${Number(categoryId)}`
  );
  const payload = data?.data ?? data ?? null;
  return payload ? normalizeTaskCategory(payload) : null;
}

/* ----------------------------- Admin APIs ----------------------------- */

/** POST /api/staff/task-categories/admin – Tạo category (admin) 
 * body: { name: string, description: string }
 */
export async function createTaskCategory({ name, description }) {
  const body = {
    name: String(name || "").trim(),
    description: String(description || "").trim(),
  };
  const { data } = await api.post("/api/staff/task-categories/admin", body);
  const payload = data?.data ?? data ?? null;
  return payload ? normalizeTaskCategory(payload) : null;
}

/** PUT /api/staff/task-categories/admin/{categoryId} – Cập nhật category (admin)
 * body: { name: string, description: string }
 */
export async function updateTaskCategory(categoryId, { name, description }) {
  const body = {
    name: String(name || "").trim(),
    description: String(description || "").trim(),
  };
  const { data } = await api.put(
    `/api/staff/task-categories/admin/${Number(categoryId)}`,
    body
  );
  const payload = data?.data ?? data ?? null;
  return payload ? normalizeTaskCategory(payload) : null;
}

/** DELETE /api/staff/task-categories/admin/{categoryId} – Xoá category (admin) */
export async function deleteTaskCategory(categoryId) {
  return safeDelete(
    `/api/staff/task-categories/admin/${Number(categoryId)}`
  );
}
