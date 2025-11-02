// src/lib/kycApi.js
import { api } from "./api";

// ------- helpers -------
const unwrap = (res) => res?.data?.data ?? res?.data ?? null;

/**
 * POST /api/operator/kyc/api/customers/me/kyc/documents/batch
 * Upload cùng lúc 3 ảnh KYC (front, back, selfie) của chính người dùng (me)
 * params: { front?: File|Blob, back?: File|Blob, selfie?: File|Blob }
 */
export async function uploadKycDocumentsBatch({ front, back, selfie } = {}) {
  const form = new FormData();
  if (front) form.append("front", front);
  if (back) form.append("back", back);
  if (selfie) form.append("selfie", selfie);

  const res = await api.post(
    "/api/operator/kyc/api/customers/me/kyc/documents/batch",
    form,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return unwrap(res);
}

/**
 * GET /api/operator/kyc/api/customers/me/kyc
 * Lấy thông tin KYC hiện tại của chính người dùng (me)
 */
export async function getMyKyc() {
  const res = await api.get("/api/operator/kyc/api/customers/me/kyc");
  return unwrap(res);
}

/**
 * GET /api/operator/kyc/customers/{customerId}
 * Lấy thông tin KYC theo customerId (dùng cho operator/admin)
 */
export async function getKycByCustomerId(customerId) {
  const res = await api.get(`/api/operator/kyc/customers/${Number(customerId)}`);
  return unwrap(res);
}

/**
 * PATCH /api/operator/kyc/customers/{customerId}
 * Cập nhật trạng thái KYC cho khách hàng
 * body ví dụ: { status: "APPROVED" | "REJECTED" | ..., rejectionReason?: string, verifiedAt?: string, verifiedBy?: number }
 */
export async function updateKycStatus(customerId, payload) {
  const body = {
    status: String(payload.status || "").toUpperCase(),
    rejectionReason: payload.rejectionReason ?? undefined,
    verifiedAt: payload.verifiedAt ?? undefined,
    verifiedBy: payload.verifiedBy != null ? Number(payload.verifiedBy) : undefined,
  };
  const res = await api.patch(
    `/api/operator/kyc/customers/${Number(customerId)}`,
    body,
    { headers: { "Content-Type": "application/json" } }
  );
  return unwrap(res);
}

/**
 * GET /api/operator/kyc/statuses
 * Trả về danh sách các trạng thái KYC khả dụng: [{ label, value }]
 */
export async function listKycStatuses() {
  const res = await api.get("/api/operator/kyc/statuses");
  const payload = unwrap(res) ?? [];
  return Array.isArray(payload) ? payload : [];
}

/**
 * GET /api/operator/kyc/pending – danh sách KYC đang chờ duyệt
 * Mỗi item ví dụ:
 * { kycStatus, customerId, verifiedAt, fullName, frontCCCDUrl, backCCCDUrl, selfieUrl, rejectionReason, verifiedBy }
 */
export async function listPendingKycs() {
  const res = await api.get("/api/operator/kyc/pending");
  const payload = unwrap(res) ?? [];
  return Array.isArray(payload) ? payload : [];
}

/**
 * Lấy tất cả KYC của tất cả customers
 * Sử dụng listCustomers và fetch KYC cho từng customer
 */
export async function listAllKycs() {
  try {
    // Import động để tránh circular dependency
    const { listCustomers } = await import("./customerApi");
    const customers = await listCustomers();
    
    // Fetch KYC cho từng customer song song
    const kycPromises = customers.map(async (customer) => {
      try {
        const kycData = await getKycByCustomerId(customer.customerId ?? customer.id);
        if (kycData) {
          return {
            ...kycData,
            customerId: customer.customerId ?? customer.id,
            fullName: customer.fullName ?? customer.name ?? "Chưa cập nhật",
            email: customer.email ?? "",
          };
        }
        return null;
      } catch {
        // Nếu không có KYC hoặc lỗi, trả về null (sẽ filter sau)
        return null;
      }
    });
    
    const kycs = await Promise.all(kycPromises);
    // Lọc bỏ những customer không có KYC
    return kycs.filter((kyc) => kyc !== null);
  } catch (e) {
    console.error("Error listing all KYCs:", e);
    return [];
  }
}

/** Optional helper */
export function normalizeKycItem(raw = {}) {
  return {
    customerId: raw.customerId,
    fullName: raw.fullName ?? raw.name ?? "Chưa cập nhật",
    email: raw.email ?? "",
    kycStatus: raw.kycStatus ?? raw.status,
    verifiedAt: raw.verifiedAt,
    verifiedBy: raw.verifiedBy,
    rejectionReason: raw.rejectionReason,
    frontUrl: raw.frontCCCDUrl ?? raw.frontUrl,
    backUrl: raw.backCCCDUrl ?? raw.backUrl,
    selfieUrl: raw.selfieUrl,
    createdAt: raw.createdAt,
    submittedAt: raw.submittedAt,
    updatedAt: raw.updatedAt,
  };
}


