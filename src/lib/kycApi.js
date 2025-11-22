import { api } from "./api";

const unwrap = (res) => res?.data?.data ?? res?.data ?? null;

// đảm bảo set text part kể cả rỗng
const setText = (form, k, v) => form.set(k, v == null ? "" : String(v));

/**
 * POST /api/customers/me/kyc/documents/batch
 * multipart/form-data: front/back/selfie + text fields (flatten)
 */
export async function uploadKycDocumentsBatch({
  front,
  back,
  selfie,
  fullName,
  identificationCode,
  typeOfIdentification,
  birthday,
  expirationDate,
  permanentAddress,
} = {}) {
  const form = new FormData();

  // file parts
  if (front)  form.set("front", front);
  if (back)   form.set("back", back);
  if (selfie) form.set("selfie", selfie);

  // text parts — khớp tên field Swagger
  setText(form, "fullName",             fullName);
  setText(form, "identificationCode",   identificationCode);
  setText(form, "typeOfIdentification", typeOfIdentification);
  setText(form, "birthday",             birthday);        // YYYY-MM-DD
  setText(form, "expirationDate",       expirationDate);  // YYYY-MM-DD
  setText(form, "permanentAddress",     permanentAddress);

  // KHÔNG thêm part JSON "data" nữa (Swagger không yêu cầu)

  // để axios tự set boundary
  const res = await api.post("/api/customers/me/kyc/documents/batch", form);
  return unwrap(res);
}

/** GET current user's KYC */
export async function getMyKyc() {
  const res = await api.get("/api/customers/me/kyc");
  return unwrap(res);
}

export async function getKycByCustomerId(customerId) {
  const res = await api.get(`/api/operator/kyc/customers/${Number(customerId)}`);
  return unwrap(res);
}

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

export async function listKycStatuses() {
  const res = await api.get("/api/operator/kyc/statuses");
  const payload = unwrap(res) ?? [];
  return Array.isArray(payload) ? payload : [];
}

export async function listPendingKycs() {
  const res = await api.get("/api/operator/kyc/pending");
  const payload = unwrap(res) ?? [];
  return Array.isArray(payload) ? payload : [];
}

export async function listAllKycs() {
  try {
    const { listCustomers } = await import("./customerApi");
    const customers = await listCustomers();
    const kycs = await Promise.all(
      customers.map(async (c) => {
        try {
          const kyc = await getKycByCustomerId(c.customerId ?? c.id);
          return kyc
            ? { ...kyc, customerId: c.customerId ?? c.id, fullName: c.fullName ?? c.name ?? "Chưa cập nhật", email: c.email ?? "" }
            : null;
        } catch { return null; }
      })
    );
    return kycs.filter(Boolean);
  } catch (e) {
    console.error("Error listing all KYCs:", e);
    return [];
  }
}

export function normalizeKycItem(raw = {}) {
  return {
    customerId: raw.customerId,
    fullName: raw.fullName ?? raw.name ?? "Chưa cập nhật",
    email: raw.email ?? "",
    kycStatus: raw.kycStatus ?? raw.status,
    verifiedAt: raw.verifiedAt,
    verifiedBy: raw.verifiedBy,
    rejectionReason: raw.rejectionReason,
    // giữ lại các trường chi tiết để hiển thị ở Drawer operator
    identificationCode: raw.identificationCode,
    typeOfIdentification: raw.typeOfIdentification,
    birthday: raw.birthday,
    expirationDate: raw.expirationDate,
    permanentAddress: raw.permanentAddress,
    frontUrl: raw.frontCCCDUrl ?? raw.frontUrl,
    backUrl: raw.backCCCDUrl ?? raw.backUrl,
    selfieUrl: raw.selfieUrl,
    createdAt: raw.createdAt,
    submittedAt: raw.submittedAt,
    updatedAt: raw.updatedAt,
  };
}
