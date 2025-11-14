// src/lib/handoverReportApi.js
import { api } from "./api";

const unwrap = (res) => res?.data?.data ?? res?.data ?? null;

/**
 * POST /api/staff/handover-reports/order/{orderId}/send-pin
 * Gửi mã PIN cho đơn hàng
 * @param {number} orderId - ID của đơn hàng
 * @returns {Promise<Object>} Response từ API (thường là empty object {})
 */
export async function sendHandoverPin(orderId) {
  const { data } = await api.post(`/api/staff/handover-reports/order/${Number(orderId)}/send-pin`);
  return unwrap(data) ?? {};
}

/**
 * POST /api/staff/handover-reports
 * Tạo handover report (biên bản bàn giao)
 * @param {Object} body - Dữ liệu handover report
 * @param {number} body.taskId - ID của task
 * @param {string} body.customerInfo - Thông tin khách hàng
 * @param {string} body.technicianInfo - Thông tin kỹ thuật viên
 * @param {string} body.handoverDateTime - Thời gian bàn giao (ISO string)
 * @param {string} body.handoverLocation - Địa điểm bàn giao
 * @param {string} body.customerSignature - Chữ ký khách hàng (base64 hoặc URL)
 * @param {string} body.pinCode - Mã PIN
 * @param {Array<Object>} body.items - Danh sách thiết bị
 * @param {string} body.items[].itemName - Tên thiết bị
 * @param {string} body.items[].itemCode - Mã thiết bị
 * @param {string} body.items[].unit - Đơn vị
 * @param {number} body.items[].orderedQuantity - Số lượng đặt
 * @param {number} body.items[].deliveredQuantity - Số lượng giao
 * @param {Array<File>} body.evidences - Mảng các file bằng chứng (ảnh, PDF, etc.)
 * @returns {Promise<Object>} Response từ API
 */
export async function createHandoverReport(body) {
  const fd = new FormData();
  
  // Phần JSON data
  const dataObj = {
    taskId: Number(body.taskId),
    customerInfo: String(body.customerInfo || ""),
    technicianInfo: String(body.technicianInfo || ""),
    handoverDateTime: String(body.handoverDateTime || ""),
    handoverLocation: String(body.handoverLocation || ""),
    customerSignature: String(body.customerSignature || ""),
    pinCode: String(body.pinCode || ""),
    items: Array.isArray(body.items) ? body.items.map((item) => ({
      itemName: String(item.itemName || ""),
      itemCode: String(item.itemCode || ""),
      unit: String(item.unit || ""),
      orderedQuantity: Number(item.orderedQuantity || 0),
      deliveredQuantity: Number(item.deliveredQuantity || 0),
    })) : [],
  };
  
  fd.append("data", new Blob([JSON.stringify(dataObj)], { type: "application/json" }));
  
  // Phần files bằng chứng (evidences)
  if (Array.isArray(body.evidences) && body.evidences.length > 0) {
    body.evidences.forEach((file, index) => {
      if (file instanceof File) {
        fd.append("evidences", file, file.name || `evidence_${index}.jpg`);
      }
    });
  }
  
  const { data } = await api.post("/api/staff/handover-reports", fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  
  return unwrap(data);
}

/**
 * GET /api/staff/handover-reports
 * Lấy danh sách handover reports
 */
export async function listHandoverReports() {
  const { data } = await api.get("/api/staff/handover-reports");
  return unwrap(data) ?? [];
}

/**
 * GET /api/staff/handover-reports/{handoverReportId}
 * Lấy chi tiết 1 handover report
 */
export async function getHandoverReportById(handoverReportId) {
  const { data } = await api.get(`/api/staff/handover-reports/${Number(handoverReportId)}`);
  return unwrap(data);
}

/**
 * GET /api/staff/handover-reports/order/{orderId}
 * Lấy danh sách handover reports theo orderId
 */
export async function getHandoverReportsByOrderId(orderId) {
  const { data } = await api.get(`/api/staff/handover-reports/order/${Number(orderId)}`);
  return unwrap(data) ?? [];
}

