// src/lib/taskRulesApi.js
import { api } from "./api";

/**
 * Tạo rule mới
 * @param {Object} payload - Task rule data
 * @param {string} payload.name - Tên rule
 * @param {string} payload.description - Mô tả rule
 * @param {number} payload.maxTasksPerDay - Số task tối đa mỗi ngày
 * @param {boolean} payload.active - Trạng thái active
 * @param {string} payload.effectiveFrom - Ngày bắt đầu hiệu lực (ISO 8601)
 * @param {string} payload.effectiveTo - Ngày kết thúc hiệu lực (ISO 8601)
 * @param {string} payload.staffRole - Vai trò staff (ADMIN, OPERATOR, TECHNICIAN, CUSTOMER_SUPPORT_STAFF)
 * @param {number} payload.taskCategoryId - ID của task category
 * @returns {Promise<any>} Response data
 */
export async function createTaskRule(payload) {
  const { data } = await api.post("/api/admin/task-rules", payload);
  return data?.data ?? data ?? null;
}

/**
 * Lấy danh sách task rules
 * @param {Object} params - Query parameters
 * @param {boolean} params.active - Lọc theo trạng thái active (optional)
 * @returns {Promise<Array>} List of task rules
 */
export async function listTaskRules(params = {}) {
  const { data } = await api.get("/api/admin/task-rules", { params });
  const payload = data?.data ?? data ?? [];
  return Array.isArray(payload) ? payload : [];
}

/**
 * Lấy rule đang áp dụng (active rule) - deprecated, use getActiveTaskRules instead
 * @returns {Promise<any>} Active task rule
 */
export async function getActiveTaskRule() {
  const { data } = await api.get("/api/admin/task-rules/active");
  return data?.data ?? data ?? null;
}

/**
 * Lấy tất cả các rules đang active từ /api/admin/task-rules/active
 * @returns {Promise<Array>} Array of active task rules
 */
export async function getActiveTaskRules() {
  const { data } = await api.get("/api/admin/task-rules/active");
  const payload = data?.data ?? data ?? [];
  return Array.isArray(payload) ? payload : (payload ? [payload] : []);
}

/**
 * Lấy chi tiết task rule theo ID
 * @param {number} taskRuleId - Task rule ID
 * @returns {Promise<any>} Task rule data
 */
export async function getTaskRuleById(taskRuleId) {
  const { data } = await api.get(`/api/admin/task-rules/${Number(taskRuleId)}`);
  return data?.data ?? data ?? null;
}

/**
 * Cập nhật task rule
 * @param {number} taskRuleId - Task rule ID
 * @param {Object} payload - Task rule data to update
 * @param {string} payload.name - Tên rule
 * @param {string} payload.description - Mô tả rule
 * @param {number} payload.maxTasksPerDay - Số task tối đa mỗi ngày
 * @param {boolean} payload.active - Trạng thái active
 * @param {string} payload.effectiveFrom - Ngày bắt đầu hiệu lực (ISO 8601)
 * @param {string} payload.effectiveTo - Ngày kết thúc hiệu lực (ISO 8601)
 * @param {string} payload.staffRole - Vai trò staff (ADMIN, OPERATOR, TECHNICIAN, CUSTOMER_SUPPORT_STAFF)
 * @param {number} payload.taskCategoryId - ID của task category
 * @returns {Promise<any>} Response data
 */
export async function updateTaskRule(taskRuleId, payload) {
  const { data } = await api.put(`/api/admin/task-rules/${Number(taskRuleId)}`, payload);
  return data?.data ?? data ?? null;
}

/**
 * Xóa task rule
 * @param {number} taskRuleId - Task rule ID
 * @returns {Promise<boolean>} Success status
 */
export async function deleteTaskRule(taskRuleId) {
  const { data } = await api.delete(`/api/admin/task-rules/${Number(taskRuleId)}`);
  return data?.data ?? data ?? true;
}

/**
 * Chuẩn hóa task rule data
 * @param {Object} raw - Raw task rule data from API
 * @returns {Object} Normalized task rule
 */
export function normalizeTaskRule(raw = {}) {
  return {
    taskRuleId: raw.taskRuleId ?? raw.id,
    name: raw.name ?? "",
    description: raw.description ?? "",
    maxTasksPerDay: Number(raw.maxTasksPerDay ?? 0),
    active: Boolean(raw.active ?? false),
    effectiveFrom: raw.effectiveFrom ?? null,
    effectiveTo: raw.effectiveTo ?? null,
    staffRole: raw.staffRole ?? null,
    taskCategoryId: raw.taskCategoryId ?? null,
    createdAt: raw.createdAt ?? null,
    updatedAt: raw.updatedAt ?? null,
  };
}

