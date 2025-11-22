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

  const payload = {
    startDate,
    endDate,
    shippingAddress, // <-- bổ sung
    customerId,
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

/** Helper định dạng VND */
export const fmtVND = (n) =>
  Number(n || 0).toLocaleString("vi-VN", { style: "currency", currency: "VND" });
