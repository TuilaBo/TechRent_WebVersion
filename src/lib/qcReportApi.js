// src/lib/qcReportApi.js
import { api } from "./api";

const unwrap = (res) => res?.data?.data ?? res?.data ?? null;

/**
 * POST /api/technician/qc-reports/pre-rental
 * Tạo PRE-RENTAL QC report
 * body: {
 *   taskId: number,
 *   orderDetailSerialNumbers: {
 *     [orderDetailId]: string[] // orderDetailId -> serialNumbers
 *   },
 *   result: string,
 *   findings: string,
 *   deviceConditions: [
 *     {
 *       deviceId: number,
 *       conditionDefinitionId: number,
 *       severity: string,
 *       images: string[]
 *     }
 *   ],
 *   accessoryFile: File (optional)
 * }
 */
export async function createPreRentalQcReport(body) {
  const fd = new FormData();
  
  // Phần JSON phải đặt tên là 'request' theo yêu cầu BE
  const requestObj = {
    taskId: Number(body.taskId),
    orderDetailSerialNumbers: body.orderDetailSerialNumbers || {},
    result: String(body.result || ""),
    findings: String(body.findings || ""),
    deviceConditions: Array.isArray(body.deviceConditions)
      ? body.deviceConditions.map((dc) => ({
          deviceId: Number(dc.deviceId || 0),
          conditionDefinitionId: Number(dc.conditionDefinitionId || 0),
          severity: String(dc.severity || ""),
          images: Array.isArray(dc.images) ? dc.images : [],
        }))
      : [],
  };
  
  fd.append("request", new Blob([JSON.stringify(requestObj)], { type: "application/json" }));
  
  // File ảnh phụ kiện (nếu có)
  if (body.accessoryFile) {
    fd.append("accessorySnapshot", body.accessoryFile, body.accessoryFile.name || "accessory.jpg");
  }

  const { data } = await api.post("/api/technician/qc-reports/pre-rental", fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return unwrap(data);
}

/**
 * POST /api/technician/qc-reports/post-rental
 * Tạo POST-RENTAL QC report
 * body: {
 *   taskId: number,
 *   orderDetailSerialNumbers: {
 *     [orderDetailId]: string[] // orderDetailId -> serialNumbers
 *   },
 *   result: string,
 *   findings: string,
 *   discrepancies: [
 *     {
 *       discrepancyType: string,
 *       conditionDefinitionId: number,
 *       orderDetailId: number,
 *       deviceId: number,
 *       staffNote: string,
 *       customerNote: string
 *     }
 *   ],
 *   accessoryFile: File (optional)
 * }
 */
export async function createPostRentalQcReport(body) {
  const fd = new FormData();
  
  // Phần JSON phải đặt tên là 'request' theo yêu cầu BE
  const requestObj = {
    taskId: Number(body.taskId),
    orderDetailSerialNumbers: body.orderDetailSerialNumbers || {},
    result: String(body.result || ""),
    findings: String(body.findings || ""),
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
  
  fd.append("request", new Blob([JSON.stringify(requestObj)], { type: "application/json" }));
  
  // File ảnh phụ kiện (nếu có)
  if (body.accessoryFile) {
    fd.append("accessorySnapshot", body.accessoryFile, body.accessoryFile.name || "accessory.jpg");
  }

  const { data } = await api.post("/api/technician/qc-reports/post-rental", fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return unwrap(data);
}

/**
 * GET /api/technician/qc-reports/pre-rental/{qcReportId}
 * Lấy chi tiết PRE-RENTAL QC report
 */
export async function getPreRentalQcReportById(qcReportId) {
  const { data } = await api.get(`/api/technician/qc-reports/pre-rental/${Number(qcReportId)}`);
  return unwrap(data);
}

/**
 * GET /api/technician/qc-reports/post-rental/{qcReportId}
 * Lấy chi tiết POST-RENTAL QC report
 */
export async function getPostRentalQcReportById(qcReportId) {
  const { data } = await api.get(`/api/technician/qc-reports/post-rental/${Number(qcReportId)}`);
  return unwrap(data);
}

/**
 * GET /api/technician/qc-reports/task/{taskId}
 * Lấy QC report theo taskId
 */
export async function getQcReportByTaskId(taskId) {
  const { data } = await api.get(`/api/technician/qc-reports/task/${Number(taskId)}`);
  return unwrap(data);
}

/**
 * GET /api/technician/qc-reports/order/{orderId}
 * Lấy danh sách QC reports theo orderId
 */
export async function getQcReportsByOrderId(orderId) {
  const { data } = await api.get(`/api/technician/qc-reports/order/${Number(orderId)}`);
  return unwrap(data);
}

/**
 * PUT /api/technician/qc-reports/pre-rental/{qcReportId}
 * Cập nhật PRE-RENTAL QC report
 * body: {
 *   orderDetailSerialNumbers: {
 *     [orderDetailId]: string[]
 *   },
 *   result: string,
 *   findings: string,
 *   deviceConditions: [
 *     {
 *       deviceId: number,
 *       conditionDefinitionId: number,
 *       severity: string,
 *       images: string[]
 *     }
 *   ],
 *   accessoryFile: File (optional)
 * }
 */
export async function updatePreRentalQcReport(qcReportId, body) {
  const fd = new FormData();
  
  // Luôn gửi deviceConditions (kể cả array rỗng) để API có thể xóa tất cả nếu cần
  const requestObj = {
    orderDetailSerialNumbers: body.orderDetailSerialNumbers || {},
    result: String(body.result || ""),
    findings: String(body.findings || ""),
    deviceConditions: Array.isArray(body.deviceConditions)
      ? body.deviceConditions.map((dc) => ({
          deviceId: Number(dc.deviceId || 0),
          conditionDefinitionId: Number(dc.conditionDefinitionId || 0),
          severity: String(dc.severity || ""),
          images: Array.isArray(dc.images) ? dc.images : [],
        }))
      : [],
  };
  
  fd.append("request", new Blob([JSON.stringify(requestObj)], { type: "application/json" }));
  
  if (body.accessoryFile) {
    fd.append("accessorySnapshot", body.accessoryFile, body.accessoryFile.name || "accessory.jpg");
  }

  const { data } = await api.put(`/api/technician/qc-reports/pre-rental/${Number(qcReportId)}`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return unwrap(data);
}

/**
 * PUT /api/technician/qc-reports/post-rental/{qcReportId}
 * Cập nhật POST-RENTAL QC report
 * body: {
 *   orderDetailSerialNumbers: {
 *     [orderDetailId]: string[]
 *   },
 *   result: string,
 *   findings: string,
 *   discrepancies: [
 *     {
 *       discrepancyType: string,
 *       conditionDefinitionId: number,
 *       orderDetailId: number,
 *       deviceId: number,
 *       staffNote: string,
 *       customerNote: string
 *     }
 *   ],
 *   accessoryFile: File (optional)
 * }
 */
export async function updatePostRentalQcReport(qcReportId, body) {
  const fd = new FormData();
  
  // Luôn gửi discrepancies (kể cả array rỗng) để API có thể xóa tất cả nếu cần
  const requestObj = {
    orderDetailSerialNumbers: body.orderDetailSerialNumbers || {},
    result: String(body.result || ""),
    findings: String(body.findings || ""),
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
  
  fd.append("request", new Blob([JSON.stringify(requestObj)], { type: "application/json" }));
  
  if (body.accessoryFile) {
    fd.append("accessorySnapshot", body.accessoryFile, body.accessoryFile.name || "accessory.jpg");
  }

  const { data } = await api.put(`/api/technician/qc-reports/post-rental/${Number(qcReportId)}`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return unwrap(data);
}

// ========== DEPRECATED - Giữ lại để tương thích ngược ==========

/**
 * @deprecated Sử dụng createPreRentalQcReport hoặc createPostRentalQcReport thay thế
 * POST /api/technician/qc-reports
 * Tạo QC report (legacy)
 */
export async function createQcReport(body) {
  const hasFile = !!body.accessoryFile;
  if (hasFile) {
    const fd = new FormData();
    const requestObj = {
      taskId: Number(body.taskId),
      orderDetailSerialNumbers: body.orderDetailSerialNumbers || {},
      phase: String(body.phase || "PRE_RENTAL"),
      result: String(body.result || ""),
      findings: String(body.findings || ""),
    };
    fd.append("request", new Blob([JSON.stringify(requestObj)], { type: "application/json" }));
    fd.append("accessorySnapshot", body.accessoryFile, body.accessoryFile.name || "accessory.jpg");

    const { data } = await api.post("/api/technician/qc-reports", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return unwrap(data);
  }

  const payload = {
    taskId: Number(body.taskId),
    orderDetailSerialNumbers: body.orderDetailSerialNumbers || {},
    phase: body.phase || "PRE_RENTAL",
    result: body.result || "",
    description: body.description || "",
    findings: body.findings || "",
  };
  const { data } = await api.post("/api/technician/qc-reports", payload);
  return unwrap(data);
}

/**
 * @deprecated Sử dụng updatePreRentalQcReport hoặc updatePostRentalQcReport thay thế
 * PUT /api/technician/qc-reports/{qcReportId}
 * Cập nhật QC report (legacy - deprecated)
 * body: {
 *   phase: "PRE_RENTAL" | "POST_RENTAL",
 *   result: string,
 *   findings: string,
 *   orderDetailSerialNumbers: {
 *     [orderDetailId]: string[]
 *   },
 *   deviceConditions: [
 *     {
 *       deviceId: number,
 *       conditionDefinitionId: number,
 *       severity: string,
 *       images: string[]
 *     }
 *   ],
 *   discrepancies: [
 *     {
 *       discrepancyType: string,
 *       conditionDefinitionId: number,
 *       orderDetailId: number,
 *       deviceId: number,
 *       staffNote: string,
 *       customerNote: string
 *     }
 *   ],
 *   accessoryFile: File (optional)
 * }
 */
export async function updateQcReport(qcReportId, body) {
  const fd = new FormData();
  
  const requestObj = {
    phase: String(body.phase || "PRE_RENTAL"),
    result: String(body.result || ""),
    findings: String(body.findings || ""),
    orderDetailSerialNumbers: body.orderDetailSerialNumbers || {},
  };
  
  // Thêm deviceConditions nếu có (chủ yếu cho PRE_RENTAL)
  if (Array.isArray(body.deviceConditions) && body.deviceConditions.length > 0) {
    requestObj.deviceConditions = body.deviceConditions.map((dc) => ({
      deviceId: Number(dc.deviceId || 0),
      conditionDefinitionId: Number(dc.conditionDefinitionId || 0),
      severity: String(dc.severity || ""),
      images: Array.isArray(dc.images) ? dc.images : [],
    }));
  }
  
  // Thêm discrepancies nếu có (chủ yếu cho POST_RENTAL, có thể bỏ qua cho PRE_RENTAL)
  if (Array.isArray(body.discrepancies) && body.discrepancies.length > 0) {
    requestObj.discrepancies = body.discrepancies.map((d) => ({
      discrepancyType: String(d.discrepancyType || ""),
      conditionDefinitionId: Number(d.conditionDefinitionId || 0),
      orderDetailId: Number(d.orderDetailId || 0),
      deviceId: Number(d.deviceId || 0),
      staffNote: String(d.staffNote || ""),
      customerNote: String(d.customerNote || ""),
    }));
  }
  
  fd.append("request", new Blob([JSON.stringify(requestObj)], { type: "application/json" }));
  
  if (body.accessoryFile) {
    fd.append("accessorySnapshot", body.accessoryFile, body.accessoryFile.name || "accessory.jpg");
  }

  const { data } = await api.put(`/api/technician/qc-reports/${Number(qcReportId)}`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return unwrap(data);
}
