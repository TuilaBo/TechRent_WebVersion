// src/lib/deviceManage.js
import { api } from "./api";

/* ------------------------- helpers ------------------------- */

// Một số BE trả 204 (No Content) cho DELETE → không có data.
// Hàm này hợp nhất mọi trường hợp và ném lỗi có thông điệp dễ hiểu.
async function safeDelete(url) {
  try {
    const res = await api.delete(url);
    // coi 200/204 là thành công
    if (!res || res.status === 204 || res.status === 200) return true;
    return true;
  } catch (err) {
    const msg =
      err?.response?.data?.message ||
      err?.response?.data?.details ||
      err?.message ||
      "Xoá thất bại";
    throw new Error(msg);
  }
}

/* ------------------ Device Categories ------------------ */

export async function listDeviceCategories() {
  const { data } = await api.get("/api/device-categories");
  return data?.data ?? data ?? [];
}
export async function createDeviceCategory(payload) {
  const { data } = await api.post("/api/device-categories", payload);
  return data?.data ?? data;
}
export async function updateDeviceCategory(id, payload) {
  const { data } = await api.put(`/api/device-categories/${Number(id)}`, payload);
  return data?.data ?? data;
}
export async function deleteDeviceCategory(id) {
  return safeDelete(`/api/device-categories/${Number(id)}`);
}

/* ---------------------- Device Models ---------------------- */

export async function listDeviceModels() {
  const { data } = await api.get("/api/device-models");
  return data?.data ?? data ?? [];
}
export async function createDeviceModel(payload) {
  const { data } = await api.post("/api/device-models", payload);
  return data?.data ?? data;
}
export async function updateDeviceModel(id, payload) {
  const { data } = await api.put(`/api/device-models/${Number(id)}`, payload);
  return data?.data ?? data;
}
export async function deleteDeviceModel(id) {
  return safeDelete(`/api/device-models/${Number(id)}`);
}

/* ------------------------- Devices ------------------------- */

export async function listDevices() {
  const { data } = await api.get("/api/devices");
  return data?.data ?? data ?? [];
}
export async function createDevice(payload) {
  const { data } = await api.post("/api/devices", payload);
  return data?.data ?? data;
}
export async function updateDevice(id, payload) {
  const { data } = await api.put(`/api/devices/${Number(id)}`, payload);
  return data?.data ?? data;
}
export async function deleteDevice(id) {
  return safeDelete(`/api/devices/${Number(id)}`);
}

/* ------------------ Accessory Categories ------------------ */

export async function listAccessoryCategories() {
  const { data } = await api.get("/api/accessory-categories");
  return data?.data ?? data ?? [];
}
export async function createAccessoryCategory(payload) {
  const { data } = await api.post("/api/accessory-categories", payload);
  return data?.data ?? data;
}
export async function updateAccessoryCategory(id, payload) {
  const { data } = await api.put(`/api/accessory-categories/${Number(id)}`, payload);
  return data?.data ?? data;
}
export async function deleteAccessoryCategory(id) {
  return safeDelete(`/api/accessory-categories/${Number(id)}`);
}

/* ------------------------- Accessories ------------------------- */

export async function listAccessories() {
  const { data } = await api.get("/api/accessories");
  return data?.data ?? data ?? [];
}
export async function createAccessory(payload) {
  const { data } = await api.post("/api/accessories", payload);
  return data?.data ?? data;
}
export async function updateAccessory(id, payload) {
  const { data } = await api.put(`/api/accessories/${Number(id)}`, payload);
  return data?.data ?? data;
}
export async function deleteAccessory(id) {
  return safeDelete(`/api/accessories/${Number(id)}`);
}

/* ---------------------------- Brands ---------------------------- */

// GET /api/brands – List brands
export async function listBrands() {
  const { data } = await api.get("/api/brands");
  return data?.data ?? data ?? [];
}

// GET /api/brands/{id} – Get brand by ID
export async function getBrandById(id) {
  const { data } = await api.get(`/api/brands/${Number(id)}`);
  return data?.data ?? data ?? null;
}

// POST /api/brands – Create brand
// body: { brandName: string, description?: string, active?: boolean }
export async function createBrand(payload) {
  const { data } = await api.post("/api/brands", payload);
  return data?.data ?? data;
}

// PUT /api/brands/{id} – Update brand
export async function updateBrand(id, payload) {
  const { data } = await api.put(`/api/brands/${Number(id)}`, payload);
  return data?.data ?? data;
}

// DELETE /api/brands/{id} – Delete brand
export async function deleteBrand(id) {
  return safeDelete(`/api/brands/${Number(id)}`);
}