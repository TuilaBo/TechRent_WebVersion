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
export function normalizeModel(m) {
  return {
    id: m?.deviceModelId ?? m?.id,
    name: m?.deviceName ?? m?.name ?? "Thiết bị",
    brand: m?.brand ?? "",
    image: m?.imageURL ?? m?.imageUrl ?? m?.image ?? "",
    // BE có thể trả pricePerDay hoặc priceValue -> ưu tiên pricePerDay
    pricePerDay: m?.pricePerDay ?? m?.priceValue ?? 0,
    specifications: m?.specifications ?? "",
    description: m?.description ?? "",
    images: m?.images ?? (m?.imageURL ? [m.imageURL] : []),
    // có thể mở rộng thêm các field khác sau
  };
}
