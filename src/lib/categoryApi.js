// src/lib/categoryApi.js
import { api } from "./api";

/** Chuẩn hoá 1 danh mục từ BE -> UI */
function normalizeCategory(c = {}) {
  return {
    id: c.deviceCategoryId ?? c.id,
    name: c.deviceCategoryName ?? c.name ?? c.categoryName ?? "Danh mục",
    description: c.description ?? "",
    active: Boolean(c.active ?? true),
  };
}

/** Lấy tất cả danh mục (đã chuẩn hoá) */
export async function fetchCategories() {
  const { data } = await api.get("/api/device-categories");
  const raw = data?.data ?? data ?? [];
  const arr = Array.isArray(raw) ? raw : [];
  return arr.map(normalizeCategory);
}

/** Lấy danh mục theo ID (đã chuẩn hoá) */
export async function fetchCategoryById(id) {
  const { data } = await api.get(`/api/device-categories/${id}`);
  const raw = data?.data ?? data ?? {};
  return normalizeCategory(raw);
}
