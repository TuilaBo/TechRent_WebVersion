import { api } from "./api";

/** Lấy danh sách mẫu thiết bị */
export async function getDeviceModels() {
  const { data } = await api.get("/api/device-models");
  const payload = data?.data ?? data ?? [];
  return Array.isArray(payload) ? payload : [];
}

/** Lấy mẫu thiết bị theo id */
export async function getDeviceModelById(id) {
  const { data } = await api.get(`/api/device-models/${id}`);
  return data?.data ?? data;
}

/** Helper định dạng giá VND */
export const fmtVND = (n) =>
  Number(n || 0).toLocaleString("vi-VN", { style: "currency", currency: "VND" });

/** Chuẩn hoá dữ liệu từ BE -> UI */
export function normalizeModel(m = {}) {
  return {
    id: m.deviceModelId ?? m.id,
    name: m.deviceName ?? m.name ?? "",
    brand: m.brand ?? m.manufacturer ?? "",
    image: m.imageURL ?? m.imageUrl ?? m.image ?? "",
    pricePerDay: Number(m.pricePerDay ?? m.dailyPrice ?? m.price ?? 0),

    // ⚠️ THÊM 2 DÒNG NÀY
    depositPercent: Number(m.depositPercent ?? m.deposit_percentage ?? m.depositRate ?? 0),
    deviceValue:    Number(m.deviceValue ?? m.assetValue ?? 0),

    description: m.specifications ?? m.description ?? "",
    categoryId: m.deviceCategoryId ?? m.categoryId ?? null,
    active: Boolean(m.active ?? true),
  };
}
