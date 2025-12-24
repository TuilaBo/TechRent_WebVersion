// src/lib/rentalOrdersApi.js
import { api } from "./api";

/**
 * Tạo đơn thuê
 * Hỗ trợ 2 cách truyền:
 * 1) items: [{ id, qty }]  -> tự map thành orderDetails
 * 2) orderDetails: [{ deviceModelId, quantity }]
 */
export async function createRentalOrder({
  startDate,
  endDate,
  customerId,
  shippingAddress = "",
  items,
  orderDetails,
}) {
  const details =
    Array.isArray(orderDetails) && orderDetails.length
      ? orderDetails.map((d) => ({
          deviceModelId: Number(d.deviceModelId),
          quantity: Number(d.quantity || 1),
        }))
      : (items || []).map((it) => ({
          deviceModelId: Number(it.id),
          quantity: Number(it.qty || 1),
        }));

  // Backend DTO only accepts planStartDate/planEndDate (not startDate/endDate)
  // Backend will map plan dates to actual dates internally in DB
  // Backend gets customerId from auth token, so we don't send it
  const payload = {
    planStartDate: startDate,
    planEndDate: endDate,
    shippingAddress,
    orderDetails: details,
  };

  const { data } = await api.post("/api/rental-orders", payload);
  return data?.data ?? data ?? null;
}

/** Lấy tất cả đơn thuê (có chi tiết) */
export async function listRentalOrders() {
  const { data } = await api.get("/api/rental-orders");
  const payload = data?.data ?? data ?? [];
  return Array.isArray(payload) ? payload : [];
}

/**
 * Tìm kiếm đơn thuê với phân trang và lọc
 * @param {Object} params - Các tham số tìm kiếm
 * @param {number} [params.page=0] - Số trang (bắt đầu từ 0)
 * @param {number} [params.size=20] - Số lượng mỗi trang
 * @param {string} [params.orderStatus] - Lọc theo trạng thái đơn
 * @param {number} [params.orderId] - Lọc theo mã đơn hàng
 * @param {number} [params.customerId] - Lọc theo customerId
 * @param {string} [params.shippingAddress] - Lọc theo địa chỉ
 * @param {number} [params.minTotalPrice] - Giá tối thiểu
 * @param {number} [params.maxTotalPrice] - Giá tối đa
 * @param {string} [params.createdAtFrom] - Ngày tạo từ (ISO format)
 * @param {string} [params.createdAtTo] - Ngày tạo đến (ISO format)
 * @param {string} [params.endDateFrom] - Ngày kết thúc từ
 * @param {string} [params.endDateTo] - Ngày kết thúc đến
 * @param {string[]} [params.sort] - Sắp xếp, ví dụ: ["createdAt,desc"]
 * @returns {Promise<{content: Array, totalElements: number, totalPages: number, page: number, size: number}>}
 */
export async function searchRentalOrders({
  page = 0,
  size = 20,
  orderStatus,
  orderId,
  customerId,
  shippingAddress,
  minTotalPrice,
  maxTotalPrice,
  createdAtFrom,
  createdAtTo,
  endDateFrom,
  endDateTo,
  sort,
} = {}) {
  const params = new URLSearchParams();
  params.append("page", String(page));
  params.append("size", String(size));
  
  if (orderStatus) params.append("orderStatus", orderStatus);
  if (orderId != null) params.append("orderId", String(orderId));
  if (customerId) params.append("customerId", String(customerId));
  if (shippingAddress) params.append("shippingAddress", shippingAddress);
  if (minTotalPrice != null) params.append("minTotalPrice", String(minTotalPrice));
  if (maxTotalPrice != null) params.append("maxTotalPrice", String(maxTotalPrice));
  if (createdAtFrom) params.append("createdAtFrom", createdAtFrom);
  if (createdAtTo) params.append("createdAtTo", createdAtTo);
  if (endDateFrom) params.append("endDateFrom", endDateFrom);
  if (endDateTo) params.append("endDateTo", endDateTo);
  if (Array.isArray(sort)) {
    sort.forEach((s) => params.append("sort", s));
  } else if (sort) {
    params.append("sort", sort);
  }

  const { data } = await api.get(`/api/rental-orders/search?${params.toString()}`);
  const payload = data?.data ?? data ?? {};
  
  // Handle paginated response
  return {
    content: Array.isArray(payload.content) ? payload.content : (Array.isArray(payload) ? payload : []),
    totalElements: payload.totalElements ?? 0,
    totalPages: payload.totalPages ?? 1,
    page: payload.number ?? page,
    size: payload.size ?? size,
  };
}

/** Lấy 1 đơn thuê theo id */
export async function getRentalOrderById(id) {
  const { data } = await api.get(`/api/rental-orders/${id}`);
  return data?.data ?? data ?? null;
}

/** Cập nhật đơn thuê */
export async function updateRentalOrder(id, body) {
  const { data } = await api.put(`/api/rental-orders/${id}`, body);
  return data?.data ?? data ?? null;
}

/** Xoá đơn thuê */
export async function deleteRentalOrder(id) {
  const { data } = await api.delete(`/api/rental-orders/${id}`);
  return data?.data ?? data ?? true;
}

/** Khách xác nhận trả đơn
 * Khách xác nhận sẽ trả hàng khi hết hạn thuê, hệ thống tạo task thu hồi đơn
 * @param {number} id - Rental order ID
 * @returns {Promise<any>} Response data
 */
export async function confirmReturnRentalOrder(id) {
  const { data } = await api.patch(`/api/rental-orders/${Number(id)}/confirm-return`);
  return data?.data ?? data ?? null;
}

/** Gia hạn đơn thuê
 * Tạo đơn gia hạn từ đơn thuê hiện có
 * @param {number} rentalOrderId - Rental order ID
 * @param {string} extendedEndTime - Thời gian kết thúc mới (ISO 8601 format)
 * @returns {Promise<any>} Response data
 */
export async function extendRentalOrder(rentalOrderId, extendedEndTime) {
  // Backend expects LocalDateTime format: YYYY-MM-DDTHH:mm:ss (no timezone)
  // Ensure we send exactly what user selected without timezone conversion
  let formattedEndTime = extendedEndTime;
  // Remove any existing timezone suffix if present
  if (extendedEndTime) {
    formattedEndTime = extendedEndTime.replace(/[Z+].*$/, '');
  }
  const payload = {
    rentalOrderId: Number(rentalOrderId),
    extendedEndTime: formattedEndTime,
  };
  const { data } = await api.post("/api/rental-orders/extend", payload);
  return data?.data ?? data ?? null;
}

/** Helper định dạng VND */
export const fmtVND = (n) =>
  Number(n || 0).toLocaleString("vi-VN", { style: "currency", currency: "VND" });
