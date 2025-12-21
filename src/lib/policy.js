import { api } from "./api";

/**
 * GET /api/admin/policies - Danh sách tất cả policy
 * @returns {Promise<Array>} Danh sách policies
 */
export async function listPolicies() {
  const { data } = await api.get("/api/admin/policies");
  const payload = data?.data ?? data ?? [];
  return Array.isArray(payload) ? payload : [];
}

/**
 * GET /api/admin/policies/{policyId} - Xem chi tiết policy
 * @param {number} policyId - ID của policy
 * @returns {Promise<Object>} Chi tiết policy
 */
export async function getPolicyById(policyId) {
  const { data } = await api.get(`/api/admin/policies/${policyId}`);
  return data?.data ?? data;
}

/**
 * POST /api/admin/policies - Tạo policy mới với file PDF hoặc Word
 * @param {Object} body
 * @param {string} body.title - Tiêu đề policy
 * @param {string} body.description - Mô tả policy
 * @param {string} body.effectiveFrom - Ngày bắt đầu hiệu lực (format: "YYYY-MM-DD")
 * @param {string} body.effectiveTo - Ngày kết thúc hiệu lực (format: "YYYY-MM-DD")
 * @param {File} [body.file] - File PDF hoặc Word (optional)
 * @returns {Promise<Object>} Policy đã tạo
 */
export async function createPolicy(body) {
  const formData = new FormData();

  // Phần JSON phải đặt tên là 'request' theo yêu cầu BE
  const requestObj = {
    title: String(body.title || ""),
    description: String(body.description || ""),
    effectiveFrom: String(body.effectiveFrom || ""),
    effectiveTo: String(body.effectiveTo || ""),
  };

  formData.append("request", new Blob([JSON.stringify(requestObj)], { type: "application/json" }));

  // File PDF hoặc Word (nếu có)
  if (body.file) {
    formData.append("file", body.file, body.file.name || "policy.pdf");
  }

  const { data } = await api.post("/api/admin/policies", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data?.data ?? data;
}

/**
 * PUT /api/admin/policies/{policyId} - Cập nhật thông tin policy và file
 * @param {number} policyId - ID của policy
 * @param {Object} body
 * @param {string} body.title - Tiêu đề policy
 * @param {string} body.description - Mô tả policy
 * @param {string} body.effectiveFrom - Ngày bắt đầu hiệu lực (format: "YYYY-MM-DD")
 * @param {string} body.effectiveTo - Ngày kết thúc hiệu lực (format: "YYYY-MM-DD")
 * @param {File} [body.file] - File PDF hoặc Word mới (optional)
 * @returns {Promise<Object>} Policy đã cập nhật
 */
export async function updatePolicy(policyId, body) {
  const formData = new FormData();

  // Phần JSON phải đặt tên là 'request' theo yêu cầu BE
  const requestObj = {
    title: String(body.title || ""),
    description: String(body.description || ""),
    effectiveFrom: String(body.effectiveFrom || ""),
    effectiveTo: String(body.effectiveTo || ""),
  };

  formData.append("request", new Blob([JSON.stringify(requestObj)], { type: "application/json" }));

  // File PDF hoặc Word mới (nếu có)
  if (body.file) {
    formData.append("file", body.file, body.file.name || "policy.pdf");
  }

  const { data } = await api.put(`/api/admin/policies/${policyId}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data?.data ?? data;
}

/**
 * DELETE /api/admin/policies/{policyId} - Xóa policy (soft delete)
 * @param {number} policyId - ID của policy
 * @returns {Promise<Object>} Kết quả xóa
 */
export async function deletePolicy(policyId) {
  const { data } = await api.delete(`/api/admin/policies/${policyId}`);
  return data?.data ?? data;
}

/**
 * GET /api/admin/policies/{policyId}/download - Tải file gốc policy (Word/DOCX)
 * @param {number} policyId - ID của policy
 * @returns {Promise<Blob>} File blob để download
 */
export async function downloadPolicyFile(policyId) {
  const response = await api.get(`/api/admin/policies/${policyId}/download`, {
    responseType: "blob",
  });
  return response.data;
}

/**
 * GET /api/admin/policies/{policyId}/file - Xem file policy (PDF) trực tiếp trên browser
 * @param {number} policyId - ID của policy
 * @returns {string} URL để xem file PDF
 */
export function getPolicyFileUrl(policyId) {
  // Trả về URL trực tiếp để mở trong browser
  return `${api.defaults.baseURL || ""}/api/admin/policies/${policyId}/file`;
}
