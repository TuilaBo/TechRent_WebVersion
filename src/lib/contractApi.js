// src/lib/contractApi.js
import { api } from "./api";

/* ----------------- Helpers ----------------- */
function unwrap(res) {
  // BE thường bọc data trong { data: ... }
  return res?.data?.data ?? res?.data ?? null;
}

/** Chuẩn hoá object Contract -> key thân thiện cho FE (tuỳ chọn) */
export function normalizeContract(c = {}) {
  return {
    id: c.contractId ?? c.id,
    number: c.contractNumber,
    title: c.title,
    description: c.description,
    type: c.contractType,
    status: c.status, // DRAFT | PENDING_SIGNATURE | SIGNED | EXPIRED | ...
    customerId: c.customerId,
    staffId: c.staffId,
    orderId: c.orderId,
    contentHtml: c.contractContent,
    terms: c.termsAndConditions,
    rentalPeriodDays: c.rentalPeriodDays,
    totalAmount: c.totalAmount,
    depositAmount: c.depositAmount,
    startDate: c.startDate,
    endDate: c.endDate,
    signedAt: c.signedAt,
    customerSignedAt: c.customerSignedAt,
    customerSignedBy: c.customerSignedBy,
    adminSignedAt: c.adminSignedAt,
    adminSignedBy: c.adminSignedBy,
    expiresAt: c.expiresAt,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    createdBy: c.createdBy,
    updatedBy: c.updatedBy,
    contractUrl:
      c.contractUrl ??
      c.contractFileUrl ??
      c.fileUrl ??
      c.pdfUrl ??
      c.signedContractUrl ??
      null,
    contractFileName: c.contractFileName ?? c.fileName ?? null,
  };
}

/* ----------------- Contracts APIs ----------------- */

/**
 * 1) Tạo hợp đồng từ đơn thuê
 * POST /api/contracts/from-order/{orderId}
 * @returns: object contract (theo mẫu bạn gửi)
 */
export async function createContractFromOrder(orderId) {
  const res = await api.post(`/api/contracts/from-order/${Number(orderId)}`);
  return unwrap(res); // trả về object hợp đồng (hoặc wrapper SUCCESS)
}

/**
 * 2) Lấy danh sách hợp đồng của chính mình (customer đang login)
 * GET /api/contracts/my-contracts
 */
export async function getMyContracts() {
  const res = await api.get("/api/contracts/my-contracts");
  const raw = unwrap(res) ?? [];
  return Array.isArray(raw) ? raw : [];
}

/** (Tiện ích) Lấy hợp đồng theo ID */
export async function getContractById(contractId) {
  const res = await api.get(`/api/contracts/${Number(contractId)}`);
  return unwrap(res);
}

/** (Tiện ích) Lấy hợp đồng theo customerId (nếu cần tra cứu từ admin) */
export async function listContractsByCustomer(customerId) {
  const res = await api.get(`/api/contracts/customer/${Number(customerId)}`);
  const raw = unwrap(res) ?? [];
  return Array.isArray(raw) ? raw : [];
}

/** (Tiện ích) Lấy hợp đồng theo orderId */
export async function listContractsByOrder(orderId) {
  const res = await api.get(`/api/contracts/order/${Number(orderId)}`);
  const raw = unwrap(res) ?? [];
  return Array.isArray(raw) ? raw : [];
}

/**
 * 3) Gửi hợp đồng để ký (đổi trạng thái -> PENDING_SIGNATURE)
 * POST /api/contracts/{contractId}/send-for-signature
 */
export async function sendContractForSignature(contractId) {
  const res = await api.post(
    `/api/contracts/${Number(contractId)}/send-for-signature`
  );
  return unwrap(res);
}

/**
 * 4) Gửi PIN ký hợp đồng qua Email (từ phía customer)
 * POST /api/contracts/{contractId}/send-pin/email
 * body: { email }
 */
export async function sendPinEmail(contractId, email) {
  const body = { email };
  const res = await api.post(
    `/api/contracts/${Number(contractId)}/send-pin/email`,
    body
  );
  return unwrap(res);
}

/**
 * 5) Ký hợp đồng (từ phía customer) sau khi nhận PIN
 * POST /api/contracts/{contractId}/sign
 * body mẫu theo swagger:
 * {
 *   "contractId": 6,               // BE có thể bỏ qua vì đã nằm ở path
 *   "digitalSignature": "string",  // chữ ký số/chuỗi hash bạn gửi lên (tuỳ thiết kế)
 *   "pinCode": "123456",
 *   "signatureMethod": "EMAIL_OTP" // ví dụ: EMAIL_OTP | SMS_PIN | DRAWN
 *   "deviceInfo": "Chrome/141 Windows",
 *   "ipAddress": "1.2.3.4"
 * }
 */
export async function signContract(contractId, payload) {
  const pin = payload?.pinCode ?? "";
  const method = payload?.signatureMethod ?? "EMAIL_OTP";
  const digital =
    String(payload?.digitalSignature ?? "").trim() ||
    (method === "EMAIL_OTP" ? String(pin) : "SIGNED_BY_USER");

  const body = {
    // nếu BE bỏ qua contractId trong body thì không cần field này;
    // vẫn giữ cho tương thích:
    contractId: Number(contractId),
    digitalSignature: digital, // đảm bảo NotBlank với BE
    pinCode: pin,
    signatureMethod: method, // Fixed: API requires EMAIL_OTP
    deviceInfo: payload?.deviceInfo ?? "",
    ipAddress: payload?.ipAddress ?? "",
  };
  const res = await api.post(
    `/api/contracts/${Number(contractId)}/sign`,
    body
  );
  return unwrap(res);
}

/**
 * 6) Ký hợp đồng bởi admin (server-side approve)
 * POST /api/contracts/{contractId}/admin/sign
 * body: giống hệt signContract (customer)
 */
export async function adminSignContract(contractId, payload) {
  const pin = payload?.pinCode ?? "";
  const method = payload?.signatureMethod ?? "EMAIL_OTP";
  const digital =
    String(payload?.digitalSignature ?? "").trim() ||
    (method === "EMAIL_OTP" ? String(pin) : "SIGNED_BY_ADMIN");

  const body = {
    contractId: Number(contractId),
    digitalSignature: digital, // đảm bảo NotBlank
    pinCode: pin,
    signatureMethod: method,
    deviceInfo: payload?.deviceInfo ?? "",
    ipAddress: payload?.ipAddress ?? "",
  };
  const res = await api.post(
    `/api/contracts/${Number(contractId)}/admin/sign`,
    body
  );
  return unwrap(res);
}

/**
 * 7) Lấy tất cả hợp đồng (dành cho admin)
 * GET /api/contracts
 */
export async function listAllContracts() {
  const res = await api.get("/api/contracts");
  const raw = unwrap(res) ?? [];
  return Array.isArray(raw) ? raw : [];
}


