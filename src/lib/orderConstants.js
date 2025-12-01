/**
 * Order status mapping
 */
export const ORDER_STATUS_MAP = {
  pending:   { label: "Chờ xác nhận", color: "default" },
  pending_kyc: { label: "Chờ xác thực thông tin", color: "orange" },
  confirmed: { label: "Đã xác nhận",  color: "blue"    },
  delivering:{ label: "Đang giao",    color: "cyan"    },
  active:    { label: "Đang thuê",    color: "gold"    },
  in_use:    { label: "Đang sử dụng", color: "geekblue" },
  returned:  { label: "Đã trả",       color: "green"   },
  cancelled: { label: "Đã hủy",       color: "red"     },
  processing:{ label: "Đang xử lý",   color: "purple"  },
  delivery_confirmed: { label: "Chuẩn bị giao hàng", color: "green" },
  completed: { label: "Hoàn tất đơn hàng", color: "green" },
};

export const ORDER_STATUS_ALIASES = {
  "đã xác nhận giao hàng": "delivery_confirmed",
  "da xac nhan giao hang": "delivery_confirmed",
};

/**
 * Payment status mapping
 */
export const PAYMENT_STATUS_MAP = {
  unpaid:   { label: "Chưa thanh toán",      color: "volcano"  },
  paid:     { label: "Đã thanh toán",        color: "green"    },
  refunded: { label: "Đã hoàn tiền",         color: "geekblue" },
  partial:  { label: "Chưa thanh toán thành công",  color: "purple"   },
};

/**
 * Settlement status mapping
 */
export const SETTLEMENT_STATUS_MAP = {
  draft: { label: "Nháp", color: "default" },
  pending: { label: "Chờ xử lý", color: "gold" },
  awaiting_customer: { label: "Chờ khách xác nhận", color: "orange" },
  submitted: { label: "Đã gửi", color: "blue" },
  issued: { label: "Đã chấp nhận", color: "green" },
  closed: { label: "Đã tất toán", color: "geekblue" },
  rejected: { label: "Đã từ chối", color: "red" },
};

/**
 * Contract status mapping
 */
export const CONTRACT_STATUS_MAP = {
  draft: { label: "Nháp", color: "default" },
  pending_signature: { label: "Chờ khách hàng ký", color: "gold" },
  pending_admin_signature: { label: "Chờ ký (admin)", color: "orange" },
  signed: { label: "Đã ký", color: "green" },
  active: { label: "2 bên đã ký", color: "green" },
  expired: { label: "Hết hạn", color: "red" },
  cancelled: { label: "Đã hủy", color: "red" },
};

export const CONTRACT_TYPE_LABELS = { RENTAL: "Hợp đồng thuê thiết bị" };

/**
 * Map invoice status to payment status
 */
export function mapInvoiceStatusToPaymentStatus(invoiceStatus) {
  if (!invoiceStatus) return "unpaid";
  const status = String(invoiceStatus).toUpperCase();
  if (status === "SUCCEEDED" || status === "PAID" || status === "COMPLETED") {
    return "paid";
  }
  if (status === "FAILED" || status === "CANCELLED" || status === "EXPIRED") {
    return "unpaid";
  }
  if (status === "PENDING" || status === "PROCESSING") {
    return "partial";
  }
  if (status === "REFUNDED") {
    return "refunded";
  }
  return "unpaid";
}

/**
 * Split settlement amounts
 */
export function splitSettlementAmounts(finalAmount = 0) {
  const amount = Number(finalAmount || 0);
  return {
    refundAmount: amount > 0 ? amount : 0,
    customerDueAmount: amount < 0 ? Math.abs(amount) : 0,
    netAmount: amount,
  };
}

