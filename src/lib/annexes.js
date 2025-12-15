// src/lib/annexes.js
import { api } from "./api";

/* ----------------------------- Helpers ----------------------------- */

/** Chuẩn hoá dữ liệu annex để UI dùng ổn định */
export function normalizeAnnex(raw = {}) {
  return {
    // IDs
    id: raw.id ?? raw.annexId ?? null,
    annexId: raw.annexId ?? raw.id ?? null,
    contractId: raw.contractId ?? null,
    extensionId: raw.extensionId ?? null,
    originalOrderId: raw.originalOrderId ?? raw.orderId ?? null,
    
    // Numbers and references
    annexNumber: raw.annexNumber ?? null,
    contractNumber: raw.contractNumber ?? null,
    
    // Content
    title: raw.title ?? null,
    description: raw.description ?? null,
    annexContent: raw.annexContent ?? raw.content ?? "",
    legalReference: raw.legalReference ?? null,
    extensionReason: raw.extensionReason ?? null,
    
    // Dates
    previousEndDate: raw.previousEndDate ?? null,
    extensionStartDate: raw.extensionStartDate ?? null,
    extensionEndDate: raw.extensionEndDate ?? raw.newEndDate ?? null,
    effectiveDate: raw.effectiveDate ?? null,
    issuedAt: raw.issuedAt ?? null,
    createdAt: raw.createdAt ?? null,
    updatedAt: raw.updatedAt ?? null,
    
    // Numbers
    extensionDays: raw.extensionDays ?? 0,
    extensionFee: raw.extensionFee ?? raw.additionalRentalFee ?? 0,
    totalPayable: raw.totalPayable ?? 0,
    depositAdjustment: raw.depositAdjustment ?? raw.additionalDeposit ?? 0,
    
    // Status
    status: raw.status ?? null,
    annexType: raw.annexType ?? null,
    
    // Admin signature
    adminSignedAt: raw.adminSignedAt ?? null,
    adminSignedBy: raw.adminSignedBy ?? raw.adminSignature ?? null,
    
    // Customer signature
    customerSignedAt: raw.customerSignedAt ?? null,
    customerSignedBy: raw.customerSignedBy ?? raw.customerSignature ?? null,
    
    // Invoice
    invoiceId: raw.invoiceId ?? null,
    invoiceStatus: raw.invoiceStatus ?? null,
  };
}

/* ----------------------------- Read APIs ----------------------------- */

/**
 * GET /api/contracts/{contractId}/annexes
 * Lấy danh sách phụ lục của hợp đồng
 * @param {number} contractId - ID của hợp đồng
 * @returns {Promise<Array>} Danh sách annexes
 */
export async function getAnnexesByContractId(contractId) {
  const { data } = await api.get(`/api/contracts/${Number(contractId)}/annexes`);
  const payload = data?.data ?? data ?? [];
  return Array.isArray(payload) ? payload.map(normalizeAnnex) : [];
}

/* ----------------------------- Write APIs ----------------------------- */

/**
 * POST /api/contracts/{contractId}/annexes/from-extension/{extensionId}
 * Tạo phụ lục từ gia hạn (RentalOrderExtension)
 * @param {number} contractId - ID của hợp đồng
 * @param {number} extensionId - ID của extension (gia hạn)
 * @returns {Promise<Object>} Annex đã tạo
 */
export async function createAnnexFromExtension(contractId, extensionId) {
  const { data } = await api.post(
    `/api/contracts/${Number(contractId)}/annexes/from-extension/${Number(extensionId)}`
  );
  const result = data?.data ?? data ?? null;
  return result ? normalizeAnnex(result) : null;
}

/**
 * POST /api/contracts/{contractId}/annexes/{annexId}/send-pin/email
 * Gửi mã PIN qua email để khách hàng ký phụ lục gia hạn
 * @param {number} contractId - ID của hợp đồng
 * @param {number} annexId - ID của phụ lục
 * @param {string} email - Email của khách hàng
 * @returns {Promise<Object>} Kết quả gửi PIN
 */
export async function sendAnnexPinEmail(contractId, annexId, email) {
  const { data } = await api.post(
    `/api/contracts/${Number(contractId)}/annexes/${Number(annexId)}/send-pin/email`,
    { email }
  );
  return data?.data ?? data ?? null;
}

/**
 * POST /api/contracts/{contractId}/annexes/{annexId}/sign/admin
 * Quản trị viên/Điều phối viên ký phụ lục gia hạn trước khi gửi khách hàng
 * @param {number} contractId - ID của hợp đồng
 * @param {number} annexId - ID của phụ lục
 * @param {Object} signatureData - Dữ liệu chữ ký
 * @param {string} signatureData.digitalSignature - Chữ ký số
 * @param {string} signatureData.signatureMethod - Phương thức ký (e.g., "EMAIL_OTP")
 * @param {string} signatureData.deviceInfo - Thông tin thiết bị
 * @param {string} signatureData.ipAddress - Địa chỉ IP
 * @param {string} signatureData.pinCode - Mã PIN
 * @returns {Promise<Object>} Annex đã ký
 */
export async function signAnnexAsAdmin(contractId, annexId, signatureData) {
  const payload = {
    digitalSignature: signatureData.digitalSignature ?? "",
    signatureMethod: signatureData.signatureMethod ?? "",
    deviceInfo: signatureData.deviceInfo ?? "",
    ipAddress: signatureData.ipAddress ?? "",
    pinCode: signatureData.pinCode ?? "",
  };
  
  const { data } = await api.post(
    `/api/contracts/${Number(contractId)}/annexes/${Number(annexId)}/sign/admin`,
    payload
  );
  const result = data?.data ?? data ?? null;
  return result ? normalizeAnnex(result) : null;
}

/**
 * POST /api/contracts/{contractId}/annexes/{annexId}/sign/customer
 * Khách hàng ký phụ lục gia hạn sau khi nhận mã PIN và chữ ký của quản trị viên
 * @param {number} contractId - ID của hợp đồng
 * @param {number} annexId - ID của phụ lục
 * @param {Object} signatureData - Dữ liệu chữ ký
 * @param {string} signatureData.digitalSignature - Chữ ký số
 * @param {string} signatureData.signatureMethod - Phương thức ký (e.g., "EMAIL_OTP")
 * @param {string} signatureData.deviceInfo - Thông tin thiết bị
 * @param {string} signatureData.ipAddress - Địa chỉ IP
 * @param {string} signatureData.pinCode - Mã PIN
 * @returns {Promise<Object>} Annex đã ký
 */
export async function signAnnexAsCustomer(contractId, annexId, signatureData) {
  const pin = signatureData.pinCode ?? "";
  const method = signatureData.signatureMethod ?? "EMAIL_OTP";
  // If digitalSignature is empty, use pinCode as signature for EMAIL_OTP method
  const digital =
    String(signatureData.digitalSignature ?? "").trim() ||
    (method === "EMAIL_OTP" ? String(pin) : "SIGNED_BY_CUSTOMER");

  const payload = {
    digitalSignature: digital,
    signatureMethod: method,
    deviceInfo: signatureData.deviceInfo ?? "",
    ipAddress: signatureData.ipAddress ?? "",
    pinCode: pin,
  };
  
  const { data } = await api.post(
    `/api/contracts/${Number(contractId)}/annexes/${Number(annexId)}/sign/customer`,
    payload
  );
  const result = data?.data ?? data ?? null;
  return result ? normalizeAnnex(result) : null;
}

