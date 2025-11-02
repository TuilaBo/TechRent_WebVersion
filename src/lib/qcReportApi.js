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
  const payload = {
    taskId: Number(body.taskId),
    orderDetailSerialNumbers: body.orderDetailSerialNumbers || {},
    phase: body.phase || "PRE_RENTAL",
    result: body.result || "",
    findings: body.findings || "",
    accessorySnapShotUrl: body.accessorySnapShotUrl || "",
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

