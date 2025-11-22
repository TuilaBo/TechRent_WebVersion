// src/lib/settlementApi.js
import { api } from "./api";

// Small helper to unwrap typical { data } envelope
const unwrap = (res) => (res?.data?.data ?? res?.data ?? res);

// 1) Create settlement (Draft)
// body example:
// {
//   orderId: 1,
//   totalRent: 1000000,
//   damageFee: 0,
//   lateFee: 0,
//   accessoryFee: 0,
//   depositUsed: 0,
//   finalAmount: 1000000
// }
export async function createSettlement(payload) {
  const { data } = await api.post("/api/settlements", payload);
  return unwrap(data);
}

// 2) Update settlement by id (PUT)
// body example:
// {
//   totalRent: 0,
//   damageFee: 0,
//   lateFee: 0,
//   accessoryFee: 0,
//   depositUsed: 0,
//   finalAmount: 0,
//   state: "Draft" // or "Submitted", "Approved", ... tuỳ BE
// }
export async function updateSettlement(id, payload) {
  const { data } = await api.put(`/api/settlements/${id}`, payload);
  return unwrap(data);
}

// 3) Get settlement by orderId
export async function getSettlementByOrderId(orderId) {
  const { data } = await api.get(`/api/settlements/order/${orderId}`);
  return unwrap(data);
}

// 4) List settlements with pagination
// params: { page = 0, size = 10, sort = [] } – convert to Spring style
export async function listSettlements({ page = 0, size = 10, sort = [] } = {}) {
  const params = { page, size };
  // allow both string and array sort
  if (Array.isArray(sort)) params.sort = sort; else if (sort) params.sort = [sort];
  const { data } = await api.get("/api/settlements", { params });
  return unwrap(data);
}

// 5) Customer respond to settlement (confirm/reject)
// PATCH /api/settlements/{id}/respond?accepted={true|false}
// accepted: boolean - true = confirm, false = reject
// If confirmed, state will change to "Issued"
// Returns empty object {} on success (200 OK)
export async function respondSettlement(id, accepted) {
  const { data } = await api.patch(`/api/settlements/${Number(id)}/respond`, null, {
    params: { accepted: Boolean(accepted) },
  });
  return unwrap(data);
}

export default {
  createSettlement,
  updateSettlement,
  getSettlementByOrderId,
  listSettlements,
  respondSettlement,
};


