// src/pages/payment/ReturnPage.jsx
import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, Result, Button, Space, Typography, Spin } from "antd";
import { CheckCircleOutlined, HomeOutlined, ShoppingOutlined } from "@ant-design/icons";
import { getInvoiceByRentalOrderId } from "../../lib/Payment";

const { Title, Text } = Typography;

function formatVNDHelper(n = 0) {
  try {
    return Number(n).toLocaleString("vi-VN", { style: "currency", currency: "VND" });
  } catch {
    return `${n}`;
  }
}

export default function ReturnPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [invoiceData, setInvoiceData] = useState(null);

  const orderCode = searchParams.get("orderCode");
  const orderId = searchParams.get("orderId");

  // VNPay params
  const vnpResponseCode = searchParams.get("vnp_ResponseCode");

  const loadInvoice = useCallback(async (rentalOrderId, retryCount = 0) => {
    try {
      setLoading(true);
      const invoiceResult = await getInvoiceByRentalOrderId(rentalOrderId);
      
      console.log("📄 ReturnPage - Loaded invoice result:", {
        rentalOrderId,
        result: invoiceResult,
        retryCount,
      });
      
      // API may return a single invoice object or an array of invoices
      let invoice = null;
      if (Array.isArray(invoiceResult)) {
        // If result is an array, prioritize RENT_PAYMENT type, otherwise use first invoice
        invoice =
          invoiceResult.find(
            (inv) =>
              String(inv?.invoiceType || "").toUpperCase() === "RENT_PAYMENT"
          ) || invoiceResult[0] || null;
      } else {
        invoice = invoiceResult || null;
      }
      
      if (invoice) {
        console.log("📄 ReturnPage - Selected invoice:", {
          invoiceId: invoice.invoiceId || invoice.id,
          totalAmount: invoice.totalAmount,
          invoiceStatus: invoice.invoiceStatus,
        });
        setInvoiceData(invoice);
        setLoading(false);
      } else {
        // Retry after a short delay if invoice not found (backend might still be processing)
        if (retryCount < 3) {
          console.log(`⏳ Retrying invoice load (attempt ${retryCount + 1}/3)...`);
          setTimeout(() => {
            loadInvoice(rentalOrderId, retryCount + 1);
          }, 2000); // Wait 2 seconds before retry
          return;
        }
        console.warn("No invoice found for order after retries:", rentalOrderId);
        setLoading(false);
      }
    } catch (err) {
      console.error("Error loading invoice:", err);
      // Retry on error if we haven't exceeded retry limit
      if (retryCount < 3) {
        console.log(`⏳ Retrying invoice load after error (attempt ${retryCount + 1}/3)...`);
        setTimeout(() => {
          loadInvoice(rentalOrderId, retryCount + 1);
        }, 2000);
        return;
      }
      // Silently handle error - user can still see success message
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Kiểm tra nếu là VNPay và có response code
    // VNPay: vnp_ResponseCode = "00" là success, khác là failure/cancel
    if (vnpResponseCode !== null) {
      const isSuccess = vnpResponseCode === "00";
      
      if (!isSuccess) {
        // Redirect sang CancelPage nếu không phải success
        const cancelParams = new URLSearchParams();
        if (orderId) cancelParams.set("orderId", orderId);
        if (orderCode) cancelParams.set("orderCode", orderCode);
        // Giữ lại các params VNPay để debug
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
      // PayOS: code != "00" là failure
      const cancelParams = new URLSearchParams();
      if (orderId) cancelParams.set("orderId", orderId);
      if (orderCode) cancelParams.set("orderCode", orderCode);
      navigate(`/failure?${cancelParams.toString()}`, { replace: true });
      return;
    }

    // Nếu có orderId từ URL và đã confirm là success, fetch thông tin invoice
    if (orderId) {
      loadInvoice(Number(orderId));
    } else {
      setLoading(false);
    }
  }, [orderId, vnpResponseCode, navigate, searchParams, orderCode, loadInvoice]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <Spin size="large" tip="Đang xử lý..." />
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "calc(100vh - var(--stacked-header, 128px))",
        background: "#f0f2f5",
        padding: "24px",
      }}
    >
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <Card
          style={{
            borderRadius: 12,
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          }}
        >
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
                            <Text type="secondary">
                              {formatVNDHelper(invoiceData.depositApplied)}
                            </Text>
                          </div>
                        )}
                        {invoiceData.subTotal && (
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <Text type="secondary">Tạm tính:</Text>
                            <Text type="secondary">
                              {formatVNDHelper(invoiceData.subTotal)}
                            </Text>
                          </div>
                        )}
                      </Space>
                    </div>
                    {invoiceData.invoiceStatus && (
                      <Text type="secondary">
                        Trạng thái: <Text strong>{invoiceData.invoiceStatus}</Text>
                      </Text>
                    )}
                  </>
                )}
                <Text type="secondary" style={{ fontSize: 14 }}>
                  Cảm ơn bạn đã thanh toán! Đơn hàng của bạn đang được xử lý.
                </Text>
              </Space>
            }
            extra={[
              <Button
                key="home"
                type="primary"
                size="large"
                icon={<HomeOutlined />}
                onClick={() => navigate("/")}
              >
                Về trang chủ
              </Button>,
              <Button
                key="orders"
                size="large"
                icon={<ShoppingOutlined />}
                onClick={() => navigate("/orders")}
              >
                Xem đơn hàng
              </Button>,
            ]}
          />
        </Card>
      </div>
    </div>
  );
}

