// src/lib/condition.js
import { api } from "./api";

/* ----------------------------- Helpers ----------------------------- */

/** Chuẩn hoá dữ liệu condition definition để UI dùng ổn định */
export function normalizeConditionDefinition(raw = {}) {
  return {
    id: raw.id ?? raw.conditionDefinitionId ?? null,
    name: raw.name ?? "",
    deviceModelId: raw.deviceModelId ?? null,
    description: raw.description ?? "",
    damage: raw.damage ?? false,
    conditionType: raw.conditionType ?? raw.type ?? "GOOD",
    conditionSeverity: raw.conditionSeverity ?? raw.severity ?? "INFO",
    defaultCompensation: raw.defaultCompensation ?? 0,
    createdAt: raw.createdAt ?? null,
    updatedAt: raw.updatedAt ?? null,
  };
}

/* ----------------------------- Read APIs ----------------------------- */

/** GET /api/conditions/definitions – Lấy danh sách condition definitions
 * @param {Object} params - Query parameters
 * @param {number} params.deviceModelId - Lọc theo deviceModelId (optional)
 * @returns {Promise<Array>} Danh sách condition definitions
 */
export async function getConditionDefinitions(params = {}) {
  const { deviceModelId } = params;
  const queryParams = {};
  if (deviceModelId != null) {
    queryParams.deviceModelId = deviceModelId;
  }
  
  const { data } = await api.get("/api/conditions/definitions", {
    params: queryParams,
  });
  const payload = data?.data ?? data ?? [];
  return Array.isArray(payload) ? payload.map(normalizeConditionDefinition) : [];
}

/** GET /api/conditions/definitions/{id} – Lấy chi tiết condition definition
 * @param {number} id - ID của condition definition
 * @returns {Promise<Object|null>} Chi tiết condition definition
 */
export async function getConditionDefinitionById(id) {
  const { data } = await api.get(`/api/conditions/definitions/${Number(id)}`);
  const payload = data?.data ?? data ?? null;
  return payload ? normalizeConditionDefinition(payload) : null;
}

/* ----------------------------- Write APIs ----------------------------- */

/** POST /api/conditions/definitions – Tạo condition definition mới
 * @param {Object} conditionData - Dữ liệu condition definition
 * @param {string} conditionData.name - Tên condition definition
 * @param {number} conditionData.deviceModelId - ID của device model
 * @param {string} conditionData.description - Mô tả
 * @param {string} conditionData.conditionType - Loại tình trạng (GOOD, DAMAGED, LOST)
 * @param {string} conditionData.conditionSeverity - Mức độ nghiêm trọng (INFO, LOW, MEDIUM, HIGH, CRITICAL)
 * @param {number} conditionData.defaultCompensation - Bồi thường mặc định (default: 0)
 * @returns {Promise<Object>} Condition definition đã tạo
 */
export async function createConditionDefinition(conditionData) {
  const payload = {
    name: conditionData.name ?? "",
    deviceModelId: conditionData.deviceModelId ?? 0,
    description: conditionData.description ?? "",
    conditionType: conditionData.conditionType ?? "GOOD",
    conditionSeverity: conditionData.conditionSeverity ?? "INFO",
    defaultCompensation: conditionData.defaultCompensation ?? 0,
  };
  
  const { data } = await api.post("/api/conditions/definitions", payload);
  const result = data?.data ?? data ?? null;
  return result ? normalizeConditionDefinition(result) : null;
}

/** PUT /api/conditions/definitions/{id} – Cập nhật condition definition
 * @param {number} id - ID của condition definition cần cập nhật
 * @param {Object} conditionData - Dữ liệu condition definition cần cập nhật
 * @param {string} [conditionData.name] - Tên condition definition
 * @param {number} [conditionData.deviceModelId] - ID của device model
 * @param {string} [conditionData.description] - Mô tả
 * @param {string} [conditionData.conditionType] - Loại tình trạng
 * @param {string} [conditionData.conditionSeverity] - Mức độ nghiêm trọng
 * @param {number} [conditionData.defaultCompensation] - Bồi thường mặc định
 * @returns {Promise<Object>} Condition definition đã cập nhật
 */
export async function updateConditionDefinition(id, conditionData) {
  const payload = {};
  if (conditionData.name !== undefined) payload.name = conditionData.name;
  if (conditionData.deviceModelId !== undefined) payload.deviceModelId = conditionData.deviceModelId;
  if (conditionData.description !== undefined) payload.description = conditionData.description;
  if (conditionData.conditionType !== undefined) payload.conditionType = conditionData.conditionType;
  if (conditionData.conditionSeverity !== undefined) payload.conditionSeverity = conditionData.conditionSeverity;
  if (conditionData.defaultCompensation !== undefined) payload.defaultCompensation = conditionData.defaultCompensation;
  
  const { data } = await api.put(`/api/conditions/definitions/${Number(id)}`, payload);
  const result = data?.data ?? data ?? null;
  return result ? normalizeConditionDefinition(result) : null;
}

/** DELETE /api/conditions/definitions/{id} – Xóa condition definition
 * @param {number} id - ID của condition definition cần xóa
 * @returns {Promise<boolean>} true nếu xóa thành công
 */
export async function deleteConditionDefinition(id) {
  const res = await api.delete(`/api/conditions/definitions/${Number(id)}`);
  return res?.data?.data ?? res?.data ?? true;
}

/* ----------------------------- Device Conditions APIs ----------------------------- */

/** GET /api/devices/{id}/conditions – Lấy danh sách tình trạng hiện tại của thiết bị
 * @param {number} deviceId - ID của thiết bị
 * @returns {Promise<Object|null>} Dữ liệu tình trạng thiết bị
 */
export async function getDeviceConditions(deviceId) {
  const { data } = await api.get(`/api/devices/${Number(deviceId)}/conditions`);
  return data?.data ?? data ?? null;
}

/** PUT /api/devices/{id}/conditions – Cập nhật tình trạng hiện tại của thiết bị
 * @param {number} deviceId - ID của thiết bị
 * @param {Object} payload - Dữ liệu cập nhật
 * @param {Array<Object>} payload.conditions - Danh sách tình trạng
 * @param {number} payload.conditions[].conditionDefinitionId - ID của condition definition
 * @param {string} payload.conditions[].severity - Mức độ nghiêm trọng
 * @param {string} [payload.conditions[].note] - Ghi chú
 * @param {Array<string>} [payload.conditions[].images] - Danh sách URL ảnh
 * @returns {Promise<Object>} Dữ liệu tình trạng đã cập nhật
 */
export async function updateDeviceConditions(deviceId, payload) {
  const requestBody = {
    conditions: Array.isArray(payload.conditions) ? payload.conditions.map((c) => ({
      conditionDefinitionId: Number(c.conditionDefinitionId ?? 0),
      severity: String(c.severity ?? ""),
      note: String(c.note ?? ""),
      images: Array.isArray(c.images) ? c.images.map((img) => String(img)) : [],
    })) : [],
  };
  
  const { data } = await api.put(`/api/devices/${Number(deviceId)}/conditions`, requestBody);
  return data?.data ?? data ?? null;
}

