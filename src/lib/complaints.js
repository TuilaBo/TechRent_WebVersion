// src/lib/complaints.js
import { api } from "./api";

/**
 * Lấy danh sách khiếu nại của khách hàng hiện tại
 * GET /api/customer/complaints
 * @returns {Promise<Array>} Danh sách khiếu nại
 */
export async function getMyComplaints() {
  const { data } = await api.get("/api/customer/complaints");
  const payload = data?.data ?? data ?? [];
  return Array.isArray(payload) ? payload : [];
}

/**
 * Tạo khiếu nại mới
 * POST /api/customer/complaints
 * @param {Object} params - Thông tin khiếu nại
 * @param {number} params.orderId - Mã đơn hàng
 * @param {number} params.deviceId - Mã thiết bị
 * @param {string} params.customerDescription - Mô tả khiếu nại của khách hàng
 * @returns {Promise<Object>} Khiếu nại đã tạo
 */
export async function createComplaint({ orderId, deviceId, customerDescription }) {
  const payload = {
    orderId: Number(orderId),
    deviceId: Number(deviceId),
    customerDescription,
  };
  const { data } = await api.post("/api/customer/complaints", payload);
  return data?.data ?? data ?? null;
}

/**
 * Lấy chi tiết khiếu nại theo ID
 * GET /api/customer/complaints/{complaintId}
 * @param {number} complaintId - Mã khiếu nại
 * @returns {Promise<Object>} Chi tiết khiếu nại
 */
export async function getComplaintById(complaintId) {
  const { data } = await api.get(`/api/customer/complaints/${complaintId}`);
  return data?.data ?? data ?? null;
}

/**
 * Lấy danh sách khiếu nại theo đơn hàng
 * GET /api/customer/complaints/order/{orderId}
 * @param {number} orderId - Mã đơn hàng
 * @returns {Promise<Array>} Danh sách khiếu nại của đơn hàng
 */
export async function getComplaintsByOrderId(orderId) {
  const { data } = await api.get(`/api/customer/complaints/order/${orderId}`);
  const payload = data?.data ?? data ?? [];
  return Array.isArray(payload) ? payload : [];
}

// ==================== STAFF APIs ====================

/**
 * Lấy danh sách khiếu nại (dành cho staff)
 * GET /api/staff/complaints
 * @param {Object} params - Các tham số lọc
 * @param {string} [params.status] - Filter theo status (PENDING, PROCESSING, RESOLVED, CANCELLED)
 * @returns {Promise<Array>} Danh sách khiếu nại
 */
export async function getStaffComplaints({ status } = {}) {
  const params = new URLSearchParams();
  if (status) params.append("status", status);
  
  const url = params.toString() 
    ? `/api/staff/complaints?${params.toString()}` 
    : "/api/staff/complaints";
  
  const { data } = await api.get(url);
  const payload = data?.data ?? data ?? [];
  return Array.isArray(payload) ? payload : [];
}

/**
 * Lấy chi tiết khiếu nại theo ID (dành cho staff)
 * GET /api/staff/complaints/{complaintId}
 * @param {number} complaintId - Mã khiếu nại
 * @returns {Promise<Object>} Chi tiết khiếu nại
 */
export async function getStaffComplaintById(complaintId) {
  const { data } = await api.get(`/api/staff/complaints/${complaintId}`);
  return data?.data ?? data ?? null;
}

/**
 * Hủy khiếu nại (chỉ ADMIN hoặc OPERATOR)
 * PATCH /api/staff/complaints/{complaintId}/cancel
 * @param {number} complaintId - Mã khiếu nại
 * @param {Object} params - Thông tin hủy
 * @param {string} params.staffNote - Ghi chú từ nhân viên
 * @returns {Promise<Object>} Khiếu nại đã hủy
 */
export async function cancelComplaint(complaintId, { staffNote }) {
  const { data } = await api.patch(`/api/staff/complaints/${complaintId}/cancel`, {
    staffNote,
  });
  return data?.data ?? data ?? null;
}

/**
 * Xử lý khiếu nại - Tự động tìm device thay thế, tạo allocation mới, tạo task cho staff đi đổi máy
 * PATCH /api/staff/complaints/{complaintId}/process
 * @param {number} complaintId - Mã khiếu nại
 * @param {Object} params - Thông tin xử lý
 * @param {string} params.staffNote - Ghi chú từ nhân viên
 * @param {string} params.faultSource - Nguồn lỗi (RENTAL_DEVICE, CUSTOMER, OTHER)
 * @param {number[]} [params.conditionDefinitionIds] - Danh sách ID định nghĩa tình trạng
 * @param {string} [params.damageNote] - Ghi chú hư hỏng
 * @returns {Promise<Object>} Khiếu nại đã xử lý
 */
export async function processComplaint(complaintId, { 
  staffNote, 
  faultSource, 
  conditionDefinitionIds, 
  damageNote 
}) {
  const payload = {
    staffNote,
    faultSource,
  };
  if (conditionDefinitionIds && conditionDefinitionIds.length > 0) {
    payload.conditionDefinitionIds = conditionDefinitionIds;
  }
  if (damageNote) {
    payload.damageNote = damageNote;
  }
  
  const { data } = await api.patch(`/api/staff/complaints/${complaintId}/process`, payload);
  return data?.data ?? data ?? null;
}

/**
 * Đánh dấu khiếu nại đã được giải quyết (sau khi hoàn thành task đổi máy)
 * PATCH /api/staff/complaints/{complaintId}/resolve
 * @param {number} complaintId - Mã khiếu nại
 * @param {Object} params - Thông tin giải quyết
 * @param {string} params.staffNote - Ghi chú từ nhân viên
 * @param {File[]} [params.evidenceFiles] - Ảnh bằng chứng
 * @returns {Promise<Object>} Khiếu nại đã giải quyết
 */
export async function resolveComplaint(complaintId, { staffNote, evidenceFiles }) {
  const formData = new FormData();
  formData.append("staffNote", staffNote);
  
  if (evidenceFiles && evidenceFiles.length > 0) {
    evidenceFiles.forEach((file) => {
      formData.append("evidenceFiles", file);
    });
  }
  
  const { data } = await api.patch(`/api/staff/complaints/${complaintId}/resolve`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return data?.data ?? data ?? null;
}

/**
 * Cập nhật nguồn lỗi và condition sau khi staff đã kiểm tra tại chỗ
 * PATCH /api/staff/complaints/{complaintId}/fault
 * @param {number} complaintId - Mã khiếu nại
 * @param {Object} params - Thông tin cập nhật
 * @param {string} params.faultSource - Nguồn lỗi (RENTAL_DEVICE, CUSTOMER, OTHER)
 * @param {number[]} [params.conditionDefinitionIds] - Danh sách ID định nghĩa tình trạng hư hỏng
 * @param {string} [params.damageNote] - Ghi chú hư hỏng
 * @param {string} [params.staffNote] - Ghi chú từ nhân viên
 * @returns {Promise<Object>} Khiếu nại đã cập nhật
 */
export async function updateComplaintFault(complaintId, { 
  faultSource, 
  conditionDefinitionIds, 
  damageNote,
  staffNote 
}) {
  const payload = {
    faultSource,
  };
  if (conditionDefinitionIds && conditionDefinitionIds.length > 0) {
    payload.conditionDefinitionIds = conditionDefinitionIds;
  }
  if (damageNote) {
    payload.damageNote = damageNote;
  }
  if (staffNote) {
    payload.staffNote = staffNote;
  }
  
  const { data } = await api.patch(`/api/staff/complaints/${complaintId}/fault`, payload);
  return data?.data ?? data ?? null;
}
