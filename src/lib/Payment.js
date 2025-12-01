// src/lib/Payment.js
import { api } from "./api";

// Small helper to unwrap typical { data } envelope
const unwrap = (res) => (res?.data?.data ?? res?.data ?? res);

// 1) Create payment
// body example:
// {
//   orderId: 0,
//   invoiceType: "RENT_PAYMENT",
//   paymentMethod: "VNPAY" | "PAYOS",
//   amount: 0,
//   description: "string",
//   returnUrl: "string",
//   cancelUrl: "string",
//   frontendSuccessUrl: "string", // Required for VNPay
//   frontendFailureUrl: "string"  // Required for VNPay
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

// 3) Get all transactions
// Returns array of transaction objects including:
// - transactionId, amount, transactionType
// - createdAt, createdBy
// - invoiceId, rentalOrderId
// - paymentMethod, invoiceStatus
export async function getTransactions() {
  const { data } = await api.get("/api/v1/payments/transactions");
  return unwrap(data);
}

// 4) Get all invoices for current customer
// Fetches invoice details for each rental order
// Note: This requires importing listRentalOrders from rentalOrdersApi
// Returns array of invoice objects
export async function getInvoices() {
  try {
    // Import dynamically to avoid circular dependency
    const { listRentalOrders } = await import("./rentalOrdersApi");
    
    // Get all rental orders for current customer
    const ordersData = await listRentalOrders();
    const ordersArray = Array.isArray(ordersData)
      ? ordersData
      : Array.isArray(ordersData?.data)
      ? ordersData.data
      : [];
    
    // Get order IDs
    const orderIds = ordersArray
      .map((o) => o.orderId || o.rentalOrderId || o.id)
      .filter((id) => id != null);
    
    // Fetch invoice details for each order (in parallel)
    const invoicePromises = orderIds.map((orderId) =>
      getInvoiceByRentalOrderId(orderId).catch((err) => {
        // Some orders may not have invoices yet, that's okay
        console.warn(`No invoice found for order ${orderId}:`, err?.message);
        return null;
      })
    );
    
    const invoices = await Promise.all(invoicePromises);
    // Filter out null values (orders without invoices)
    return invoices.filter((inv) => inv != null);
  } catch (error) {
    console.error("Error getting invoices:", error);
    throw error;
  }
}

// 5) Confirm refund for settlement
// POST /api/v1/payments/settlements/{settlementId}/confirm-refund
// Returns empty object {} on success (200 OK)
export async function confirmRefundSettlement(settlementId) {
  const { data } = await api.post(`/api/v1/payments/settlements/${Number(settlementId)}/confirm-refund`);
  return unwrap(data);
}

export default {
  createPayment,
  getInvoiceByRentalOrderId,
  getTransactions,
  getInvoices,
  confirmRefundSettlement,
};

