// src/lib/categoryApi.js
import { api } from "./api";

// Lấy toàn bộ danh mục
export async function fetchCategories() {
  const { data } = await api.get("/api/device-categories");
  return data?.data ?? data ?? [];
}

// Lấy 1 danh mục theo id
export async function fetchCategoryById(id) {
  const { data } = await api.get(`/api/device-categories/${id}`);
  return data?.data ?? data ?? null;
}
