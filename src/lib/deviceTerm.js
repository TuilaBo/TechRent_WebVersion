// src/lib/deviceTerm.js
import { api } from "./api";

const BASE_PATH = "/api/admin/device-terms";

/**
 * Chuẩn hoá 1 điều khoản từ BE về format FE dùng
 */
function normalizeDeviceTerm(raw = {}) {
  return {
    // ID chuẩn cho FE
    termId: raw.deviceContractTermId ?? raw.termId ?? raw.id,

    title: raw.title,
    content: raw.content,
    active: raw.active,

    // Thông tin thiết bị / danh mục
    deviceId: raw.deviceId ?? null,
    deviceSerialNumber: raw.deviceSerialNumber ?? null,
    deviceCategoryId: raw.deviceCategoryId ?? null,
    deviceCategoryName: raw.deviceCategoryName ?? null,

    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

/**
 * Lấy danh sách điều khoản (filter optional theo deviceId, deviceCategoryId, active)
 */
export async function listDeviceTerms(filters = {}) {
  const { deviceId, deviceCategoryId, active } = filters || {};
  const params = {};
  if (deviceId != null) params.deviceId = deviceId;
  if (deviceCategoryId != null) params.deviceCategoryId = deviceCategoryId;
  if (typeof active === "boolean") params.active = active;

  const { data } = await api.get(BASE_PATH, { params });
  const list = data?.data ?? data ?? [];
  return Array.isArray(list) ? list.map(normalizeDeviceTerm) : [];
}

/**
 * Xem chi tiết điều khoản theo ID
 */
export async function getDeviceTermById(termId) {
  if (termId == null) throw new Error("termId is required");
  const { data } = await api.get(`${BASE_PATH}/${termId}`);
  const raw = data?.data ?? data ?? null;
  return raw ? normalizeDeviceTerm(raw) : null;
}

/**
 * Tạo mới điều khoản cho thiết bị hoặc loại thiết bị
 * @param {{ title: string, content: string, deviceId?: number|null, deviceCategoryId?: number|null, active?: boolean }} payload
 */
export async function createDeviceTerm(payload) {
  if (!payload) throw new Error("payload is required");
  const { data } = await api.post(BASE_PATH, payload);
  const raw = data?.data ?? data ?? null;
  return raw ? normalizeDeviceTerm(raw) : null;
}

/**
 * Cập nhật điều khoản theo ID
 */
export async function updateDeviceTerm(termId, payload) {
  if (termId == null) throw new Error("termId is required");
  if (!payload) throw new Error("payload is required");
  const { data } = await api.put(`${BASE_PATH}/${termId}`, payload);
  const raw = data?.data ?? data ?? null;
  return raw ? normalizeDeviceTerm(raw) : null;
}

/**
 * Xoá điều khoản theo ID
 */
export async function deleteDeviceTerm(termId) {
  if (termId == null) throw new Error("termId is required");
  await api.delete(`${BASE_PATH}/${termId}`);
  return true;
}
