// src/pages/payment/CancelPage.jsx
import React, { useEffect } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { Card, Result, Button, Space, Typography } from "antd";
import { CloseCircleOutlined, HomeOutlined, ShoppingOutlined, ReloadOutlined } from "@ant-design/icons";

const { Title, Text } = Typography;

export default function CancelPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  
  // Log ngay để debug
  console.log("CancelPage component rendered");
  console.log("Location:", location);
  console.log("Search params:", Object.fromEntries(searchParams.entries()));

  // PayOS có thể gửi về các query params với nhiều tên khác nhau
  // Lưu ý: PayOS orderCode khác với orderCode của chúng ta!
  // PayOS gửi: orderCode (PayOS orderCode), code (PayOS response code), id (PayOS payment ID)
  // Chúng ta cần lấy orderCode thực từ localStorage hoặc từ params mà chúng ta gửi đi
  
  // PayOS params
  const payosOrderCode = searchParams.get("orderCode"); // PayOS orderCode (không phải của chúng ta)
  const payosId = searchParams.get("id"); // PayOS payment ID
  const payosCode = searchParams.get("code"); // PayOS response code ("00" = success, khác = error)
  const cancelStatus = searchParams.get("cancel"); // "true" nếu là cancel
  const paymentStatus = searchParams.get("status"); // "CANCELLED" từ PayOS
  
  // OrderCode và OrderId của chúng ta (từ URL params hoặc localStorage)
  const ourOrderCode = searchParams.get("orderCode") || searchParams.get("order_code");
  const ourOrderId = searchParams.get("orderId") || searchParams.get("order_id");
  
  // Lấy từ localStorage nếu không có trong URL (trường hợp PayOS không redirect về đúng URL)
  const [localOrderId, setLocalOrderId] = React.useState(null);
  const [localOrderCode, setLocalOrderCode] = React.useState(null);
  
  useEffect(() => {
    // Log toàn bộ thông tin để debug
    console.log("=== CancelPage Debug Info ===");
    console.log("Current URL:", window.location.href);
    console.log("Pathname:", location.pathname);
    console.log("Search:", location.search);
    console.log("All query params:", Object.fromEntries(searchParams.entries()));
    
    // Lấy debug info từ localStorage (nếu có)
    const debugInfoStr = localStorage.getItem("paymentDebugInfo");
    if (debugInfoStr) {
      try {
        const debugInfo = JSON.parse(debugInfoStr);
        console.log("📋 Payment Debug Info from localStorage:", debugInfo);
        console.log("📋 Original cancelUrl sent to backend:", debugInfo.cancelUrl);
        console.log("📋 Original returnUrl sent to backend:", debugInfo.returnUrl);
        console.log("📋 API Response:", debugInfo.apiResponse);
      } catch (e) {
        console.error("Failed to parse debug info:", e);
      }
    }
    
    // Ưu tiên lấy từ localStorage vì PayOS không gửi orderCode/orderId của chúng ta
    const pendingOrderId = localStorage.getItem("pendingPaymentOrderId");
    const pendingOrderCode = localStorage.getItem("pendingPaymentOrderCode");
    
    if (pendingOrderId || pendingOrderCode) {
      setLocalOrderId(pendingOrderId);
      setLocalOrderCode(pendingOrderCode);
      console.log("Using localStorage values:", { pendingOrderId, pendingOrderCode });
      // Không xóa localStorage ngay, để có thể retry nếu cần
    }
    
    const finalOrderIdValue = ourOrderId || localOrderId;
    const finalOrderCodeValue = ourOrderCode || localOrderCode;
    
    console.log("CancelPage - Extracted values:", {
      ourOrderCode: finalOrderCodeValue,
      ourOrderId: finalOrderIdValue,
      payosOrderCode, // PayOS orderCode (khác với orderCode của chúng ta)
      payosId,
      payosCode,
      cancelStatus,
      paymentStatus,
      fromLocalStorage: !ourOrderId && !!localOrderId,
    });
    console.log("=== End CancelPage Debug ===");
    
    // Log so sánh cancelUrl đã gửi vs URL thực tế PayOS redirect về
    if (debugInfoStr) {
      try {
        const debugInfo = JSON.parse(debugInfoStr);
        console.log("🔍 URL Comparison:");
        console.log("  Expected cancelUrl:", debugInfo.cancelUrl);
        console.log("  Actual redirect URL:", window.location.href);
        console.log("  Match:", window.location.href.includes(debugInfo.cancelUrl?.split('?')[0] || ''));
      } catch {
        // ignore
      }
    }
  }, [searchParams, location, ourOrderCode, ourOrderId, localOrderCode, localOrderId, payosId, payosCode, payosOrderCode, cancelStatus, paymentStatus]);
  
  // Sử dụng orderId và orderCode từ URL hoặc localStorage
  // Ưu tiên localStorage vì PayOS không gửi orderCode/orderId của chúng ta
  const finalOrderId = ourOrderId || localOrderId;
  const finalOrderCode = ourOrderCode || localOrderCode;
  
  // Nếu không có thông tin gì, có thể là user quay lại từ PayOS nhưng PayOS không redirect đúng
  // Trong trường hợp này, vẫn hiển thị trang cancel nhưng với thông báo chung chung hơn

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
            status="error"
            icon={<CloseCircleOutlined style={{ color: "#ff4d4f", fontSize: 72 }} />}
            title={<Title level={2} style={{ margin: 0 }}>Thanh toán đã bị hủy</Title>}
            subTitle={
              <Space direction="vertical" size="middle" style={{ width: "100%", marginTop: 16 }}>
                {finalOrderCode && (
                  <Text type="secondary">
                    Mã đơn hàng: <Text strong>#{finalOrderCode}</Text>
                  </Text>
                )}
                <Text type="secondary" style={{ fontSize: 14 }}>
                  Bạn đã hủy quá trình thanh toán. Đơn hàng của bạn vẫn được giữ nguyên và bạn có thể thanh toán lại bất cứ lúc nào.
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
              finalOrderId ? (
                <Button
                  key="retry"
                  size="large"
                  icon={<ReloadOutlined />}
                  onClick={() => navigate(`/orders`)}
                >
                  Thử lại
                </Button>
              ) : null
            ]}
          />
        </Card>
      </div>
    </div>
  );
}

