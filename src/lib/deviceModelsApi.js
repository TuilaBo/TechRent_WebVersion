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

/** Kiểm tra tính khả dụng của thiết bị theo model trong khoảng thời gian */
export async function getDeviceAvailability(deviceModelId, start, end) {
  // Format: start và end phải là string date-time dạng "2025-11-12T09:00:00"
  const { data } = await api.get(`/api/devices/models/${deviceModelId}/availability`, {
    params: {
      start,
      end,
    },
  });
  return data?.data ?? data;
}

/** Tìm kiếm mẫu thiết bị với phân trang/sort/filter */
export async function searchDeviceModels(params = {}) {
  const {
    deviceName,
    brandId,
    deviceCategoryId,
    isActive,
    page = 0,
    size = 10,
    sort, // ví dụ: ["createdAt,desc"] hoặc "createdAt,desc"
  } = params || {};

  const query = {};
  if (deviceName) query.deviceName = deviceName;
  if (brandId != null) query.brandId = brandId;
  if (deviceCategoryId != null) query.deviceCategoryId = deviceCategoryId;
  if (typeof isActive === "boolean") query.isActive = isActive;
  // Spring thường dùng page,size,sort (thay vì pageable.*)
  query.page = page;
  query.size = size;
  if (sort) query.sort = sort;

  const { data } = await api.get("/api/device-models/search", { params: query });
  // BE có thể trả dạng { data: { content: [] } } hoặc { data: [] }
  const payload = data?.data ?? data ?? {};
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.content)
    ? payload.content
    : [];
  return list;
}

/** Helper định dạng giá VND */
export const fmtVND = (n) =>
  Number(n || 0).toLocaleString("vi-VN", { style: "currency", currency: "VND" });

/** Chuẩn hoá dữ liệu từ BE -> UI */
export function normalizeModel(m = {}) {
  return {
    id: m.deviceModelId ?? m.id,
    name: m.deviceName ?? m.name ?? "",
    // Lưu cả brandId để có thể gọi API lấy tên brand khi thiếu
    brandId: m.brandId ?? m.brand?.brandId ?? m.brand?.id ?? null,
    brand: m.brand?.brandName ?? m.brand ?? m.manufacturer ?? "",
    image: m.imageURL ?? m.imageUrl ?? m.image ?? "",
    pricePerDay: Number(m.pricePerDay ?? m.dailyPrice ?? m.price ?? 0),

    // ⚠️ THÊM 2 DÒNG NÀY
    depositPercent: Number(m.depositPercent ?? m.deposit_percentage ?? m.depositRate ?? 0),
    deviceValue:    Number(m.deviceValue ?? m.assetValue ?? 0),
    amountAvailable: Number(m.amountAvailable ?? 0),

    description: m.deviceDescription ?? m.description ?? "",
    deviceDescription: m.deviceDescription ?? "",
    specifications: m.specifications ?? "",
    categoryId: m.deviceCategoryId ?? m.categoryId ?? null,
    active: Boolean(m.active ?? true),
  };
}
