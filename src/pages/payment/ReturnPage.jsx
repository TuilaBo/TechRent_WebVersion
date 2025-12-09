// src/pages/payment/ReturnPage.jsx
import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, Result, Button, Space, Typography, Spin } from "antd";
import { CheckCircleOutlined, HomeOutlined, ShoppingOutlined } from "@ant-design/icons";
import { getInvoiceByRentalOrderId } from "../../lib/Payment";

const { Title, Text } = Typography;

// Config cho retry logic
const RETRY_CONFIG = {
  maxRetries: 10,
  initialDelay: 1500,
  maxDelay: 3000,
  backoffMultiplier: 1.2,
};

// Invoice statuses that indicate payment is complete
const PAID_STATUSES = ['SUCCEEDED', 'COMPLETED', 'PAID'];

// Invoice statuses that indicate still processing
const PENDING_STATUSES = ['PENDING', 'PROCESSING', 'AWAITING_PAYMENT'];

function formatVNDHelper(n = 0) {
  try {
    return Number(n).toLocaleString("vi-VN", { style: "currency", currency: "VND" });
  } catch {
    return `${n}`;
  }
}

const INVOICE_STATUS_MAP = {
  PENDING: "Chờ thanh toán",
  SUCCEEDED: "Đã thanh toán",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Đã hủy",
  REFUNDED: "Đã hoàn tiền",
  OVERDUE: "Quá hạn",
  PROCESSING: "Đang xử lý",
  FAILED: "Thất bại",
};

function translateStatus(status) {
  if (!status) return "";
  const upperStatus = String(status).toUpperCase();
  return INVOICE_STATUS_MAP[upperStatus] || status;
}

// Helper functions for status checking
function isPaymentComplete(status) {
  const upperStatus = String(status || "").toUpperCase();
  return PAID_STATUSES.some(s => upperStatus.includes(s));
}

function isStillProcessing(status) {
  const upperStatus = String(status || "").toUpperCase();
  return PENDING_STATUSES.some(s => upperStatus.includes(s));
}

export default function ReturnPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [invoiceData, setInvoiceData] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [statusMessage, setStatusMessage] = useState("Đang xử lý thanh toán...");
  const retryTimeoutRef = useRef(null);

  const orderCode = searchParams.get("orderCode");
  const orderId = searchParams.get("orderId");
  const vnpResponseCode = searchParams.get("vnp_ResponseCode");

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  // Get all VNPay params for logging
  const getVnpayParams = useCallback(() => {
    const vnpParams = {};
    searchParams.forEach((value, key) => {
      if (key.startsWith("vnp_")) {
        vnpParams[key] = value;
      }
    });
    return vnpParams;
  }, [searchParams]);

  const loadInvoice = useCallback(async (rentalOrderId, currentRetry = 0) => {
    try {
      setRetryCount(currentRetry);

      if (currentRetry === 0) {
        setStatusMessage("Đang xác nhận thanh toán với hệ thống...");
      } else {
        setStatusMessage(`Đang đồng bộ với cổng thanh toán (${currentRetry}/${RETRY_CONFIG.maxRetries})...`);
      }

      console.log(`📄 [ReturnPage] Fetching invoice for order ${rentalOrderId}, retry: ${currentRetry}`);

      const invoiceResult = await getInvoiceByRentalOrderId(rentalOrderId);

      console.log("📄 [ReturnPage] Invoice API response:", {
        rentalOrderId,
        result: invoiceResult,
        retryCount: currentRetry,
      });

      // API may return a single invoice object or an array of invoices
      let invoice = null;
      if (Array.isArray(invoiceResult)) {
        invoice =
          invoiceResult.find(
            (inv) =>
              String(inv?.invoiceType || "").toUpperCase() === "RENT_PAYMENT" &&
              isPaymentComplete(inv?.invoiceStatus)
          ) ||
          invoiceResult.find(
            (inv) =>
              String(inv?.invoiceType || "").toUpperCase() === "RENT_PAYMENT"
          ) ||
          invoiceResult[0] || null;
      } else {
        invoice = invoiceResult || null;
      }

      if (invoice) {
        const status = invoice.invoiceStatus;
        const isConfirmed = isPaymentComplete(status);
        const isPending = isStillProcessing(status);

        console.log("📄 [ReturnPage] Invoice status check:", {
          invoiceId: invoice.invoiceId || invoice.id,
          invoiceStatus: status,
          isConfirmed,
          isPending,
          retryCount: currentRetry,
        });

        // If payment is complete, show success immediately
        if (isConfirmed) {
          console.log("✅ [ReturnPage] Payment confirmed as SUCCEEDED");
          setInvoiceData(invoice);
          setLoading(false);
          return;
        }

        // If still processing and retries available, wait and retry
        if (isPending && currentRetry < RETRY_CONFIG.maxRetries) {
          const delay = Math.min(
            RETRY_CONFIG.initialDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, currentRetry),
            RETRY_CONFIG.maxDelay
          );

          console.log(`⏳ [ReturnPage] Invoice status is ${status}, retrying in ${delay}ms (attempt ${currentRetry + 1}/${RETRY_CONFIG.maxRetries})...`);

          retryTimeoutRef.current = setTimeout(() => {
            loadInvoice(rentalOrderId, currentRetry + 1);
          }, delay);
          return;
        }

        // Max retries reached
        console.log(`⚠️ [ReturnPage] Max retries reached. Final status: ${status}`);
        console.log("[ReturnPage] Showing success based on VNPay response (backend may still be processing)");
        setInvoiceData(invoice);
        setLoading(false);
      } else {
        // No invoice found - retry if possible
        if (currentRetry < RETRY_CONFIG.maxRetries) {
          const delay = Math.min(
            RETRY_CONFIG.initialDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, currentRetry),
            RETRY_CONFIG.maxDelay
          );

          console.log(`⏳ [ReturnPage] No invoice found, retrying in ${delay}ms...`);

          retryTimeoutRef.current = setTimeout(() => {
            loadInvoice(rentalOrderId, currentRetry + 1);
          }, delay);
          return;
        }

        console.warn("❌ [ReturnPage] No invoice found after max retries:", rentalOrderId);
        setLoading(false);
      }
    } catch (err) {
      console.error("❌ [ReturnPage] Error loading invoice:", err);

      if (currentRetry < RETRY_CONFIG.maxRetries) {
        const delay = Math.min(
          RETRY_CONFIG.initialDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, currentRetry),
          RETRY_CONFIG.maxDelay
        );

        console.log(`⏳ [ReturnPage] Error occurred, retrying in ${delay}ms...`);

        retryTimeoutRef.current = setTimeout(() => {
          loadInvoice(rentalOrderId, currentRetry + 1);
        }, delay);
        return;
      }

      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Log VNPay params received
    const vnpParams = getVnpayParams();
    console.log("🔔 [ReturnPage] Page loaded with params:", {
      orderId,
      orderCode,
      vnpResponseCode,
      vnpParams,
    });

    // Check VNPay response
    if (vnpResponseCode !== null) {
      const isSuccess = vnpResponseCode === "00";

      console.log(`🔔 [ReturnPage] VNPay response code: ${vnpResponseCode}, isSuccess: ${isSuccess}`);

      if (!isSuccess) {
        console.log("❌ [ReturnPage] VNPay payment failed/cancelled, redirecting to failure page");
        const cancelParams = new URLSearchParams();
        if (orderId) cancelParams.set("orderId", orderId);
        if (orderCode) cancelParams.set("orderCode", orderCode);
        cancelParams.set("vnp_ResponseCode", vnpResponseCode);
        searchParams.forEach((value, key) => {
          if (key.startsWith("vnp_")) {
            cancelParams.set(key, value);
          }
        });
        navigate(`/failure?${cancelParams.toString()}`, { replace: true });
        return;
      }
    }

    // PayOS params check
    const payosCode = searchParams.get("code");
    if (payosCode !== null && payosCode !== "00") {
      console.log("❌ [ReturnPage] PayOS payment failed, redirecting to failure page");
      const cancelParams = new URLSearchParams();
      if (orderId) cancelParams.set("orderId", orderId);
      if (orderCode) cancelParams.set("orderCode", orderCode);
      navigate(`/failure?${cancelParams.toString()}`, { replace: true });
      return;
    }

    // VNPay success - wait for IPN and load invoice
    if (orderId) {
      const initialDelay = RETRY_CONFIG.initialDelay;
      console.log(`⏳ [ReturnPage] Waiting ${initialDelay}ms for IPN callback before fetching invoice...`);

      retryTimeoutRef.current = setTimeout(() => {
        loadInvoice(Number(orderId), 0);
      }, initialDelay);
    } else {
      console.warn("⚠️ [ReturnPage] No orderId in URL params");
      setLoading(false);
    }
  }, [orderId, vnpResponseCode, navigate, searchParams, orderCode, getVnpayParams, loadInvoice]);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", minHeight: "60vh", gap: 16 }}>
        <Spin size="large" />
        <Text style={{ fontSize: 16 }}>{statusMessage}</Text>
        {retryCount > 0 && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            Đang đồng bộ với cổng thanh toán...
          </Text>
        )}
      </div>
    );
  }

  const invoiceStatus = invoiceData?.invoiceStatus;
  const isConfirmedSuccess = isPaymentComplete(invoiceStatus);

  return (
    <div
      style={{
        minHeight: "calc(100vh - var(--stacked-header, 128px))",
        background: "#f0f2f5",
        padding: "24px",
      }}
    >
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <Card style={{ borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
          <Result
            status="success"
            icon={<CheckCircleOutlined style={{ color: "#52c41a", fontSize: 72 }} />}
            title={<Title level={2} style={{ margin: 0 }}>Thanh toán thành công!</Title>}
            subTitle={
              <Space direction="vertical" size="middle" style={{ width: "100%", marginTop: 16 }}>
                {orderCode && (
                  <Text type="secondary">
                    Mã đơn hàng: <Text strong>#{orderCode}</Text>
                  </Text>
                )}
                {invoiceData && (
                  <>
                    <div style={{ background: "#f6ffed", padding: 16, borderRadius: 8, border: "1px solid #b7eb8f" }}>
                      <Space direction="vertical" size="small" style={{ width: "100%" }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <Text>Tổng tiền:</Text>
                          <Text strong style={{ fontSize: 18, color: "#52c41a" }}>
                            {formatVNDHelper(invoiceData.totalAmount || 0)}
                          </Text>
                        </div>
                        {invoiceData.depositApplied > 0 && (
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <Text type="secondary">Tiền cọc đã áp dụng:</Text>
                            <Text type="secondary">{formatVNDHelper(invoiceData.depositApplied)}</Text>
                          </div>
                        )}
                      </Space>
                    </div>
                    {invoiceStatus && (
                      <Text type="secondary">
                        Trạng thái hóa đơn: <Text strong>{translateStatus(invoiceStatus)}</Text>
                        {!isConfirmedSuccess && " (đang cập nhật)"}
                      </Text>
                    )}
                  </>
                )}
                <Text type="secondary" style={{ fontSize: 14 }}>
                  Cảm ơn bạn đã thanh toán! Đơn thuê của bạn đang được xử lý.
                </Text>
              </Space>
            }
            extra={[
              <Button key="orders" type="primary" size="large" icon={<ShoppingOutlined />}
                onClick={() => navigate(orderId ? `/orders?orderId=${orderId}` : "/orders")}>
                Xem đơn hàng
              </Button>,
              <Button key="home" size="large" icon={<HomeOutlined />} onClick={() => navigate("/")}>
                Về trang chủ
              </Button>,
            ]}
          />
        </Card>
      </div>
    </div>
  );
}