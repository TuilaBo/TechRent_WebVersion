// src/lib/qcReportApi.js
import { api } from "./api";

const unwrap = (res) => res?.data?.data ?? res?.data ?? null;

/**
 * POST /api/technician/qc-reports
 * Tạo QC report
 * body: {
 *   taskId: number,
 *   orderDetailSerialNumbers: {
 *     additionalProp1: string[], // orderDetailId -> serialNumbers
 *     additionalProp2: string[],
 *     ...
 *   },
 *   phase: "PRE_RENTAL" | "POST_RENTAL",
 *   result: string,
 *   findings: string,
 *   accessorySnapShotUrl: string
 * }
 */
export async function createQcReport(body) {
  const hasFile = !!body.accessoryFile;
  if (hasFile) {
    const fd = new FormData();
    // Phần JSON phải đặt tên là 'request' theo yêu cầu BE
    const requestObj = {
      taskId: Number(body.taskId),
      orderDetailSerialNumbers: body.orderDetailSerialNumbers || {},
      phase: String(body.phase || "PRE_RENTAL"),
      result: String(body.result || ""),
      description: String(body.description || ""),
      findings: String(body.findings || ""),
    };
    fd.append("request", new Blob([JSON.stringify(requestObj)], { type: "application/json" }));
    // File ảnh phụ kiện
    fd.append("accessorySnapshot", body.accessoryFile, body.accessoryFile.name || "accessory.jpg");

    const { data } = await api.post("/api/technician/qc-reports", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return unwrap(data);
  }

  // Fallback nếu không có file -> gửi JSON (giữ tương thích)
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
 * GET /api/technician/qc-reports/{qcReportId}
 * Lấy chi tiết QC report
 */
export async function getQcReportById(qcReportId) {
  const { data } = await api.get(`/api/technician/qc-reports/${Number(qcReportId)}`);
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

