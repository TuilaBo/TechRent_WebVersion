// src/lib/Payment.js
import { api } from "./api";

// Small helper to unwrap typical { data } envelope
const unwrap = (res) => (res?.data?.data ?? res?.data ?? res);

// 1) Create payment
// body example:
// {
//   orderId: 0,
//   invoiceType: "RENT_PAYMENT",
//   paymentMethod: "PAYOS",
//   amount: 0,
//   description: "string",
//   returnUrl: "string",
//   cancelUrl: "string"
// }
export async function createPayment(payload) {
  const { data } = await api.post("/api/v1/payments", payload);
  return unwrap(data);
}

// 2) Get invoice by rental order ID
// Returns invoice details including:
// - invoiceId, rentalOrderId, invoiceType, paymentMethod
// - invoiceStatus, subTotal, taxAmount, discountAmount
// - totalAmount, depositApplied
// - paymentDate, dueDate, issueDate, pdfUrl
export async function getInvoiceByRentalOrderId(rentalOrderId) {
  const { data } = await api.get(`/api/v1/payments/invoice/${rentalOrderId}`);
  return unwrap(data);
}

export default {
  createPayment,
  getInvoiceByRentalOrderId,
};

