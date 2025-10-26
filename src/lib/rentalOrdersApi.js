import {api} from "./api"

/**
 * items: [{ id: deviceModelId, qty: number }]
 * startDate/endDate: ISO string (server-side mong muốn dạng UTC ISO)
 */
export async function createRentalOrder({ startDate, endDate, customerId, items }) {
  const payload = {
    startDate,
    endDate,
    customerId,
    orderDetails: (items || []).map(it => ({
      quantity: Number(it.qty || 1),
      deviceModelId: Number(it.id),
    })),
  };

  const { data } = await api.post("/api/rental-orders", payload);
  return data?.data ?? data ?? null;
}
