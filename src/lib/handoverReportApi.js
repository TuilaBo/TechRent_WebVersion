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
 * POST /api/staff/handover-reports/{handoverReportId}/pin
 * Gửi mã PIN cho handover report cụ thể
 * @param {number} handoverReportId - ID của handover report
 * @returns {Promise<Object>} Response từ API (thường là empty object {})
 */
export async function sendHandoverReportPin(handoverReportId, email) {
  const url = `/api/staff/handover-reports/${Number(handoverReportId)}/pin`;

  if (email) {
    const { data } = await api.post(url, { email });
    return unwrap(data) ?? {};
  }

  const { data } = await api.post(url);
  return unwrap(data) ?? {};
}

/**
 * PATCH /api/staff/handover-reports/{handoverReportId}/signature
 * Cập nhật chữ ký nhân viên cho handover report
 * @param {number} handoverReportId - ID của handover report
 * @param {Object} body - Dữ liệu chữ ký
 * @param {string} body.pinCode - Mã PIN để xác thực
 * @param {string} body.staffSignature - Chữ ký nhân viên (base64 hoặc URL)
 * @returns {Promise<Object>} Response từ API
 */
export async function updateHandoverReportSignature(handoverReportId, body) {
  const { data } = await api.patch(
    `/api/staff/handover-reports/${Number(handoverReportId)}/signature`,
    {
      pinCode: String(body.pinCode || ""),
      staffSignature: String(body.staffSignature || ""),
    }
  );
  return unwrap(data);
}

/**
 * POST /api/staff/handover-reports/checkout
 * Tạo handover report CHECKOUT (khi đi giao hàng)
 * Không nhận discrepancy; nhận danh sách tình trạng thiết bị để lưu snapshot
 * @param {Object} body - Dữ liệu handover report
 * @param {number} body.taskId - ID của task
 * @param {string} body.customerInfo - Thông tin khách hàng
 * @param {string} body.technicianInfo - Thông tin kỹ thuật viên
 * @param {string} body.handoverDateTime - Thời gian bàn giao (ISO string)
 * @param {string} body.handoverLocation - Địa điểm bàn giao
 * @param {string} body.customerSignature - Chữ ký khách hàng (base64 hoặc URL)
 * @param {Array<Object>} body.items - Danh sách thiết bị
 * @param {number} body.items[].deviceId - ID của device
 * @param {Array<string>} body.items[].evidenceUrls - Danh sách URL ảnh bằng chứng
 * @param {Array<Object>} body.deviceConditions - Danh sách điều kiện thiết bị
 * @param {number} body.deviceConditions[].deviceId - ID của device
 * @param {number} body.deviceConditions[].conditionDefinitionId - ID của condition definition
 * @param {string} body.deviceConditions[].severity - Mức độ nghiêm trọng
 * @param {Array<string>} body.deviceConditions[].images - Danh sách URL ảnh
 * @returns {Promise<Object>} Response từ API
 */
export async function createHandoverReportCheckout(body) {
  const dataObj = {
    taskId: Number(body.taskId || 0),
    customerInfo: String(body.customerInfo || ""),
    technicianInfo: String(body.technicianInfo || ""),
    handoverDateTime: String(body.handoverDateTime || ""),
    handoverLocation: String(body.handoverLocation || ""),
    customerSignature: String(body.customerSignature || ""),
    items: Array.isArray(body.items) ? body.items.map((item) => ({
      deviceId: Number(item.deviceId || 0),
      evidenceUrls: Array.isArray(item.evidenceUrls) ? item.evidenceUrls.map(String) : [],
    })) : [],
    deviceConditions: Array.isArray(body.deviceConditions)
      ? body.deviceConditions.map((dc) => ({
          deviceId: Number(dc.deviceId || 0),
          conditionDefinitionId: Number(dc.conditionDefinitionId || 0),
          severity: String(dc.severity || ""),
          images: Array.isArray(dc.images) ? dc.images.map(String) : [],
        }))
      : [],
  };
  
  const { data } = await api.post("/api/staff/handover-reports/checkout", dataObj);
  return unwrap(data);
}

/**
 * POST /api/staff/handover-reports/checkin
 * Tạo handover report CHECKIN (khi đi nhận hàng)
 * Nhận discrepancy và xử lý giống hiện tại
 * @param {Object} body - Dữ liệu handover report
 * @param {number} body.taskId - ID của task
 * @param {string} body.customerInfo - Thông tin khách hàng
 * @param {string} body.technicianInfo - Thông tin kỹ thuật viên
 * @param {string} body.handoverDateTime - Thời gian bàn giao (ISO string)
 * @param {string} body.handoverLocation - Địa điểm bàn giao
 * @param {string} body.customerSignature - Chữ ký khách hàng (base64 hoặc URL)
 * @param {Array<Object>} body.items - Danh sách thiết bị
 * @param {number} body.items[].deviceId - ID của device
 * @param {Array<string>} body.items[].evidenceUrls - Danh sách URL ảnh bằng chứng
 * @param {Array<Object>} body.discrepancies - Danh sách discrepancy
 * @param {string} body.discrepancies[].discrepancyType - Loại discrepancy (DAMAGE, etc.)
 * @param {number} body.discrepancies[].conditionDefinitionId - ID của condition definition
 * @param {number} body.discrepancies[].orderDetailId - ID của order detail
 * @param {number} body.discrepancies[].deviceId - ID của device
 * @param {string} body.discrepancies[].staffNote - Ghi chú của nhân viên
 * @param {string} body.discrepancies[].customerNote - Ghi chú của khách hàng
 * @returns {Promise<Object>} Response từ API
 */
export async function createHandoverReportCheckin(body) {
  const dataObj = {
    taskId: Number(body.taskId || 0),
    customerInfo: String(body.customerInfo || ""),
    technicianInfo: String(body.technicianInfo || ""),
    handoverDateTime: String(body.handoverDateTime || ""),
    handoverLocation: String(body.handoverLocation || ""),
    customerSignature: String(body.customerSignature || ""),
    items: Array.isArray(body.items) ? body.items.map((item) => ({
      deviceId: Number(item.deviceId || 0),
      evidenceUrls: Array.isArray(item.evidenceUrls) ? item.evidenceUrls.map(String) : [],
    })) : [],
    discrepancies: Array.isArray(body.discrepancies)
      ? body.discrepancies.map((d) => ({
          discrepancyType: String(d.discrepancyType || ""),
          conditionDefinitionId: Number(d.conditionDefinitionId || 0),
          orderDetailId: Number(d.orderDetailId || 0),
          deviceId: Number(d.deviceId || 0),
          staffNote: String(d.staffNote || ""),
          customerNote: String(d.customerNote || ""),
        }))
      : [],
  };
  
  const { data } = await api.post("/api/staff/handover-reports/checkin", dataObj);
  return unwrap(data);
}

/**
 * @deprecated Sử dụng createHandoverReportCheckout hoặc createHandoverReportCheckin thay thế
 * POST /api/staff/handover-reports
 * Tạo handover report (biên bản bàn giao) - Legacy
 * @param {Object} body - Dữ liệu handover report
 * @param {number} body.taskId - ID của task
 * @param {string} body.customerInfo - Thông tin khách hàng
 * @param {string} body.technicianInfo - Thông tin kỹ thuật viên
 * @param {string} body.handoverDateTime - Thời gian bàn giao (ISO string)
 * @param {string} body.handoverLocation - Địa điểm bàn giao
 * @param {string} body.customerSignature - Chữ ký khách hàng (base64 hoặc URL)
 * @param {Array<Object>} body.items - Danh sách thiết bị
 * @param {string} body.items[].itemName - Tên thiết bị
 * @param {string} body.items[].itemCode - Mã thiết bị
 * @param {string} body.items[].unit - Đơn vị
 * @param {number} body.items[].orderedQuantity - Số lượng đặt
 * @param {number} body.items[].deliveredQuantity - Số lượng giao
 * @param {Array<Object>} body.deviceQualityInfos - Thông tin chất lượng thiết bị
 * @param {string} body.deviceQualityInfos[].deviceSerialNumber - Serial number của thiết bị
 * @param {string} body.deviceQualityInfos[].qualityStatus - Trạng thái chất lượng
 * @param {string} body.deviceQualityInfos[].qualityDescription - Mô tả chất lượng
 * @param {string} body.deviceQualityInfos[].deviceModelName - Tên model thiết bị
 * @param {Array<string>} body.evidenceUrls - Danh sách URL ảnh bằng chứng (base64 hoặc URL)
 * @returns {Promise<Object>} Response từ API
 */
export async function createHandoverReport(body) {
  // Tách data và evidences như Swagger (multipart/form-data)
  const dataObj = {
    taskId: Number(body.taskId || 0),
    customerInfo: String(body.customerInfo || ""),
    technicianInfo: String(body.technicianInfo || ""),
    handoverDateTime: String(body.handoverDateTime || ""),
    handoverLocation: String(body.handoverLocation || ""),
    customerSignature: String(body.customerSignature || ""),
    items: Array.isArray(body.items) ? body.items.map((item) => ({
      itemName: String(item.itemName || ""),
      itemCode: String(item.itemCode || ""),
      unit: String(item.unit || ""),
      orderedQuantity: Number(item.orderedQuantity || 0),
      deliveredQuantity: Number(item.deliveredQuantity || 0),
    })) : [],
    deviceQualityInfos: Array.isArray(body.deviceQualityInfos) ? body.deviceQualityInfos.map((info) => ({
      deviceSerialNumber: String(info.deviceSerialNumber || ""),
      qualityStatus: String(info.qualityStatus || ""),
      qualityDescription: String(info.qualityDescription || ""),
      deviceModelName: String(info.deviceModelName || ""),
    })) : [],
  };
  
  // Ưu tiên dùng File objects nếu có, nếu không thì dùng base64 URLs
  const evidenceFiles = Array.isArray(body.evidenceFiles) ? body.evidenceFiles : [];
  const evidenceUrls = Array.isArray(body.evidenceUrls) ? body.evidenceUrls : [];
  
  // Debug: Log payload để kiểm tra
  console.log("🔍 createHandoverReport - dataObj:", JSON.stringify(dataObj, null, 2));
  console.log("🔍 createHandoverReport - evidenceFiles:", evidenceFiles.map(f => ({ name: f.name, size: f.size, type: f.type })));
  console.log("🔍 createHandoverReport - evidenceUrls:", evidenceUrls.length > 0 ? `${evidenceUrls.length} base64 URLs` : "empty");
  
  // Gửi dạng multipart/form-data như Swagger
  const formData = new FormData();
  formData.append("data", JSON.stringify(dataObj));
  
  // Append evidences - ưu tiên File objects, nếu không có thì dùng base64 URLs
  if (evidenceFiles.length > 0) {
    // Gửi File objects (backend sẽ tự upload lên Cloudinary)
    evidenceFiles.forEach((file) => {
      formData.append("evidences", file);
    });
    console.log("🔍 Using File objects for evidences");
  } else if (evidenceUrls.length > 0) {
    // Fallback: gửi base64 URLs nếu không có File objects
    evidenceUrls.forEach((url) => {
      formData.append("evidences", url);
    });
    console.log("🔍 Using base64 URLs for evidences");
  }
  
  console.log("🔍 FormData entries:");
  for (let pair of formData.entries()) {
    const value = pair[1];
    if (value instanceof File) {
      console.log("  ", pair[0], ":", `File(${value.name}, ${value.size} bytes, ${value.type})`);
    } else {
      // Truncate long base64 strings for logging
      const displayValue = typeof value === 'string' && value.length > 100 
        ? value.substring(0, 100) + '...' 
        : value;
      console.log("  ", pair[0], ":", displayValue);
    }
  }
  
  const { data } = await api.post("/api/staff/handover-reports", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
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

/**
 * GET /api/staff/handover-reports/order/{orderId}/task/{taskId}
 * Lấy handover report theo orderId và taskId
 * @param {number} orderId - ID của đơn hàng
 * @param {number} taskId - ID của task
 * @returns {Promise<Object>} Response từ API
 */
export async function getHandoverReportByOrderIdAndTaskId(orderId, taskId) {
  const { data } = await api.get(`/api/staff/handover-reports/order/${Number(orderId)}/task/${Number(taskId)}`);
  return unwrap(data);
}

// =========================
// CUSTOMER APIs
// =========================

/**
 * POST /api/customers/handover-reports/{handoverReportId}/pin
 * Gửi mã PIN cho customer qua email
 * @param {number} handoverReportId - ID của handover report
 * @param {Object} body - Dữ liệu gửi PIN
 * @param {string} body.email - Email của customer để nhận mã PIN
 * @returns {Promise<Object>} Response từ API (thường là empty object {})
 */
export async function sendCustomerHandoverReportPin(handoverReportId, body) {
  const { data } = await api.post(
    `/api/customers/handover-reports/${Number(handoverReportId)}/pin`,
    {
      email: String(body.email || ""),
    }
  );
  return unwrap(data) ?? {};
}

/**
 * PATCH /api/customers/handover-reports/{handoverReportId}/signature
 * Cập nhật chữ ký customer cho handover report
 * @param {number} handoverReportId - ID của handover report
 * @param {Object} body - Dữ liệu chữ ký
 * @param {string} body.pinCode - Mã PIN để xác thực
 * @param {string} body.customerSignature - Chữ ký customer (base64 hoặc URL)
 * @returns {Promise<Object>} Response từ API
 */
export async function updateCustomerHandoverReportSignature(handoverReportId, body) {
  const { data } = await api.patch(
    `/api/customers/handover-reports/${Number(handoverReportId)}/signature`,
    {
      pinCode: String(body.pinCode || ""),
      customerSignature: String(body.customerSignature || ""),
    }
  );
  return unwrap(data);
}

/**
 * GET /api/customers/handover-reports/orders/{orderId}
 * Lấy danh sách handover reports theo orderId (cho customer)
 * @param {number} orderId - ID của đơn hàng
 * @returns {Promise<Array>} Danh sách handover reports
 */
export async function getCustomerHandoverReportsByOrderId(orderId) {
  const { data } = await api.get(`/api/customers/handover-reports/orders/${Number(orderId)}`);
  return unwrap(data) ?? [];
}
