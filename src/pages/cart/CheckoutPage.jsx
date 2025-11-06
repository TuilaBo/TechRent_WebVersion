// src/pages/cart/CheckoutPage.jsx (hoặc Checkout.jsx)
import React, { useEffect, useMemo, useState } from "react";
import {
  Row, Col, Card, Typography, Breadcrumb, Button, Divider, Space,
  Skeleton, Form, Input, Select
} from "antd";
import { Link, useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import toast from "react-hot-toast";
import { getCartFromStorage, clearCart } from "../../lib/cartUtils";
import { getDeviceModelById, normalizeModel } from "../../lib/deviceModelsApi";
import { fetchMyCustomerProfile } from "../../lib/customerApi";
import { createRentalOrder } from "../../lib/rentalOrdersApi";
import { ShoppingCartOutlined, CheckCircleOutlined } from "@ant-design/icons";

const { Title, Text, Paragraph } = Typography;

const CART_DATES_STORAGE_KEY = "techrent-cart-dates";
const fmtVND = (n) =>
  Number(n || 0).toLocaleString("vi-VN", { style: "currency", currency: "VND" });

// IMPORTANT: send local-time ISO WITHOUT timezone (avoid UTC shift -7h)
// Example: 2025-10-29T00:00:00 and 2025-10-30T23:59:59.999
const toISOStartOfDay = (d) => dayjs(d).startOf("day").format("YYYY-MM-DD[T]HH:mm:ss");
const toISOEndOfDay   = (d) => dayjs(d).endOf("day").format("YYYY-MM-DD[T]HH:mm:ss.SSS");

export default function Checkout() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);

  const [items, setItems] = useState([]);
  // Init dates from storage immediately to avoid overwriting with defaults
  const initialDates = (() => {
    try {
      const raw = localStorage.getItem(CART_DATES_STORAGE_KEY) || sessionStorage.getItem(CART_DATES_STORAGE_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d?.startDate && d?.endDate) {
          return { start: dayjs(d.startDate), end: dayjs(d.endDate) };
        }
      }
    } catch {
      // ignore storage parsing errors
    }
    return { start: dayjs().add(1, "day"), end: dayjs().add(6, "day") };
  })();
  const [startDate, _setStartDate] = useState(initialDates.start);
  const [endDate, _setEndDate] = useState(initialDates.end);

  // Customer info
  const [customerId, setCustomerId] = useState(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [shippingAddresses, setShippingAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);

        // prefilling customer info (không fail toàn trang nếu lỗi)
        try {
          const me = await fetchMyCustomerProfile();
          setCustomerId(me?.customerId ?? me?.id ?? null);
          setFullName(me?.fullName ?? me?.username ?? "");
          setPhone(me?.phoneNumber ?? "");
          setEmail(me?.email ?? "");
          setShippingAddress(me?.shippingAddress ?? "");
          // Load shipping addresses array
          const addresses = me?.shippingAddressDtos || [];
          setShippingAddresses(addresses);
          // Pre-select first address if available
          if (addresses.length > 0) {
            setSelectedAddressId(addresses[0].shippingAddressId);
            setShippingAddress(addresses[0].address);
          }
        } catch {
          // ignore prefill errors
        }

        // dates đã init từ storage ở bước khởi tạo state (tránh ghi đè)

        // load giỏ hàng
        const cart = getCartFromStorage();
        if (!Array.isArray(cart) || cart.length === 0) {
          setItems([]);
          return;
        }

        const normalized = await Promise.all(
          cart.map(async (it) => {
            try {
              const m = await getDeviceModelById(it.id);
              const nm = normalizeModel(m);
              return { ...nm, qty: it.qty || 1 };
            } catch {
              return {
                id: it.id, name: it.name, image: it.image,
                pricePerDay: it.dailyPrice,
                depositPercent: it.depositPercent ?? 0,
                deviceValue: it.deviceValue ?? 0,
                qty: it.qty || 1,
              };
            }
          })
        );
        setItems(normalized);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const days = useMemo(() => {
    if (!startDate || !endDate) return 1;
    const diff = endDate.startOf("day").diff(startDate.startOf("day"), "day");
    return Math.max(1, diff || 1);
  }, [startDate, endDate]);

  // Persist dates so that CartPage can restore when user navigates back
  useEffect(() => {
    if (startDate && endDate) {
      localStorage.setItem(
        CART_DATES_STORAGE_KEY,
        JSON.stringify({
          startDate: startDate.format("YYYY-MM-DD"),
          endDate: endDate.format("YYYY-MM-DD"),
        })
      );
    }
  }, [startDate, endDate]);

  // Tính tiền
  const lineTotals = useMemo(() => {
    return items.map((it) => {
      const qty = Number(it.qty || 1);
      const subtotal = Number(it.pricePerDay || 0) * days * qty;
      // Không làm tròn để đồng bộ với số liệu từ backend (orderDetails)
      const deposit = Number(it.deviceValue || 0) * Number(it.depositPercent || 0) * qty;
      return {
        id: it.id,
        name: it.name,
        qty,
        pricePerDay: Number(it.pricePerDay || 0),
        subtotal,
        deposit,
        depositPercent: Number(it.depositPercent || 0),
      };
    });
  }, [items, days]);

  const subtotal = useMemo(
    () => lineTotals.reduce((s, x) => s + x.subtotal, 0),
    [lineTotals]
  );
  const deposit = useMemo(
    () => lineTotals.reduce((s, x) => s + x.deposit, 0),
    [lineTotals]
  );
  const grandTotal = useMemo(() => subtotal + deposit, [subtotal, deposit]);

  const placeOrder = async () => {
    if (!items.length) return toast.error("Giỏ hàng đang trống.");
    if (!customerId) return toast.error("Không xác định được khách hàng, vui lòng đăng nhập lại.");
    if (placing) return; // chặn double click

    setPlacing(true);

    const payload = {
      startDate: toISOStartOfDay(startDate),
      endDate: toISOEndOfDay(endDate),
      shippingAddress: (shippingAddress || ""),
      // customerId được lấy tự động từ token xác thực, không cần gửi trong payload
      orderDetails: items.map((x) => ({
        deviceModelId: x.id,
        quantity: Number(x.qty) || 1,
      })),
      // có thể gửi note nếu BE hỗ trợ
      // note,
    };

    try {
      await toast.promise(createRentalOrder(payload), {
        loading: "Đang đặt đơn...",
        success: "Đặt đơn thành công! Vui lòng chờ xử lý.",
        error: (err) =>
          err?.response?.data?.message || err?.message || "Đặt đơn thất bại.",
      });

      clearCart();

      // cho người dùng kịp thấy toast rồi mới điều hướng
      setTimeout(() => {
        navigate("/orders");
      }, 1200);
    } catch {
      setPlacing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: "#F5F7FA" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <Breadcrumb
            items={[{ title: <Link to="/">Trang chủ</Link> }, { title: "Thanh toán" }]}
            className="mb-4"
          />
          <Title level={3} style={{ color: "#111827", marginBottom: 16 }}>
            Thanh toán
          </Title>
          <Skeleton active paragraph={{ rows: 8 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#F5F7FA" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <Breadcrumb
          items={[{ title: <Link to="/">Trang chủ</Link> }, { title: "Thanh toán" }]}
          className="mb-4"
        />
        <Title level={3} style={{ color: "#111827", marginBottom: 16 }}>
          Xác nhận & Thanh toán
        </Title>

        <Row gutter={[24, 24]}>
          {/* LEFT: Info */}
          <Col xs={24} lg={14}>
            <Card
              bordered
              className="rounded-xl"
              bodyStyle={{ padding: 20 }}
              title={<Text strong style={{ fontSize: 16 }}>Thông tin nhận hàng</Text>}
            >
              <Form layout="vertical">
                <Form.Item label={<Text strong>Họ và tên</Text>}>
                  <Input 
                    value={fullName} 
                    onChange={(e) => setFullName(e.target.value)} 
                    placeholder="Nhập họ và tên"
                    size="large"
                  />
                </Form.Item>
                <Form.Item label={<Text strong>Số điện thoại</Text>}>
                  <Input 
                    value={phone} 
                    onChange={(e) => setPhone(e.target.value)} 
                    placeholder="09xx xxx xxx"
                    size="large"
                  />
                </Form.Item>
                <Form.Item label={<Text strong>Email</Text>}>
                  <Input 
                    value={email} 
                    disabled 
                    size="large"
                  />
                </Form.Item>
                <Form.Item label={<Text strong>Địa chỉ giao hàng</Text>}>
                  <Select
                    placeholder="Chọn địa chỉ giao hàng"
                    value={selectedAddressId}
                    onChange={(addressId) => {
                      setSelectedAddressId(addressId);
                      const addr = shippingAddresses.find(a => a.shippingAddressId === addressId);
                      setShippingAddress(addr?.address || "");
                    }}
                    options={shippingAddresses.map((addr) => ({
                      value: addr.shippingAddressId,
                      label: addr.address,
                    }))}
                    notFoundContent="Chưa có địa chỉ giao hàng. Vui lòng cập nhật trong hồ sơ."
                    size="large"
                  />
                  {selectedAddressId && (
                    <div style={{ marginTop: 12, padding: 12, background: "#F9FAFB", borderRadius: 8, border: "1px solid #E5E7EB" }}>
                      <Text style={{ fontSize: 14, color: "#111827" }}>
                        📍 {shippingAddresses.find(a => a.shippingAddressId === selectedAddressId)?.address}
                      </Text>
                    </div>
                  )}
                </Form.Item>
                {shippingAddresses.length === 0 && (
                  <Form.Item>
                    <Button
                      type="link"
                      onClick={() => navigate("/profile")}
                      style={{ padding: 0, height: "auto" }}
                    >
                      Quản lý địa chỉ trong hồ sơ →
                    </Button>
                  </Form.Item>
                )}
                <Form.Item label={<Text strong>Ghi chú thêm (tuỳ chọn)</Text>}>
                  <Input.TextArea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    autoSize={{ minRows: 3, maxRows: 6 }}
                    placeholder="VD: Giao trước 9h, gọi mình trước khi tới…"
                    size="large"
                  />
                </Form.Item>
              </Form>
            </Card>

            <Card
              bordered
              className="rounded-xl mt-3"
              bodyStyle={{ padding: 20 }}
              title={<Text strong style={{ fontSize: 16 }}>Sản phẩm ({items.length})</Text>}
            >
              <Space direction="vertical" size={16} style={{ width: "100%" }}>
                {lineTotals.map((ln) => {
                  const item = items.find((i) => i.id === ln.id) || {};
                  const percent = Math.round(Number(item.depositPercent || 0) * 100);
                  return (
                    <div
                      key={ln.id}
                      style={{
                        display: "flex",
                        gap: 16,
                        alignItems: "flex-start",
                        padding: 16,
                        background: "#F9FAFB",
                        borderRadius: 10,
                        border: "1px solid #E5E7EB",
                      }}
                    >
                      <div
                        style={{
                          width: 80,
                          height: 80,
                          flexShrink: 0,
                          borderRadius: 10,
                          background: `url(${item.image}) center/cover no-repeat`,
                          border: "1px solid #E5E7EB",
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Text strong style={{ display: "block", fontSize: 15, color: "#111827", marginBottom: 6 }}>
                          {ln.name}
                        </Text>
                        <div style={{ marginBottom: 4 }}>
                          <Text style={{ fontSize: 14, color: "#111827" }}>
                            Số lượng: <strong>{ln.qty}</strong> • Thời gian: <strong>{days} ngày</strong>
                          </Text>
                        </div>
                        <div style={{ marginBottom: 4 }}>
                          <Text type="secondary" style={{ fontSize: 13 }}>
                            Giá thuê: {fmtVND(ln.pricePerDay)}/ngày
                          </Text>
                        </div>
                        <div>
                          <Text type="secondary" style={{ fontSize: 13 }}>
                            Tiền cọc ({percent}%): <strong style={{ color: "#111827" }}>{fmtVND(ln.deposit)}</strong>
                          </Text>
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <Text strong style={{ display: "block", fontSize: 16, color: "#111827" }}>
                          {fmtVND(ln.subtotal)}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 13 }}>
                          Tiền thuê
                        </Text>
                      </div>
                    </div>
                  );
                })}
              </Space>
            </Card>
          </Col>

          {/* RIGHT: Summary */}
          <Col xs={24} lg={10}>
            <Card
              bordered
              className="rounded-xl"
              bodyStyle={{ padding: 20 }}
              title={<Text strong style={{ fontSize: 16 }}>Tóm tắt đơn hàng</Text>}
            >
              <Space direction="vertical" size={8} style={{ width: "100%" }}>
                <div style={{ 
                  padding: 12, 
                  background: "#F9FAFB", 
                  borderRadius: 10,
                  border: "1px solid #E5E7EB"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <Text style={{ fontSize: 14, color: "#6B7280" }}>Ngày bắt đầu thuê</Text>
                    <Text strong style={{ fontSize: 14, color: "#111827" }}>{startDate?.format("DD/MM/YYYY")}</Text>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <Text style={{ fontSize: 14, color: "#6B7280" }}>Ngày kết thúc thuê</Text>
                    <Text strong style={{ fontSize: 14, color: "#111827" }}>{endDate?.format("DD/MM/YYYY")}</Text>
                  </div>
                  <Divider style={{ margin: "8px 0" }} />
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <Text style={{ fontSize: 15, color: "#111827" }}>Tổng số ngày</Text>
                    <Text strong style={{ fontSize: 16, color: "#111827" }}>{days} ngày</Text>
                  </div>
                </div>

                <Divider />

                {lineTotals.map((ln) => {
                  return (
                    <div
                      key={ln.id}
                      style={{ 
                        paddingBottom: 8,
                        borderBottom: "1px solid #F3F4F6"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <Text style={{ color: "#111827", fontSize: 14, flex: 1 }}>
                          {ln.name}
                        </Text>
                        <Text strong style={{ fontSize: 14, color: "#111827", marginLeft: 12 }}>
                          {fmtVND(ln.subtotal)}
                        </Text>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <Text type="secondary" style={{ fontSize: 13 }}>
                          {ln.qty} × {days} ngày
                        </Text>
                        <Text type="secondary" style={{ fontSize: 13 }}>
                          Cọc: {fmtVND(ln.deposit)}
                        </Text>
                      </div>
                    </div>
                  );
                })}

                <Divider />

                <div style={{ padding: "6px 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <Text style={{ fontSize: 14, color: "#6B7280" }}>Tiền thuê thiết bị</Text>
                    <Text strong style={{ fontSize: 15, color: "#111827" }}>{fmtVND(subtotal)}</Text>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <Text style={{ fontSize: 14, color: "#6B7280" }}>Tiền cọc</Text>
                    <Text strong style={{ fontSize: 15, color: "#111827" }}>{fmtVND(deposit)}</Text>
                  </div>
                </div>

                <Divider />

                <div style={{ 
                  display: "flex", 
                  justifyContent: "space-between",
                  padding: "8px 0"
                }}>
                  <Text strong style={{ fontSize: 16, color: "#111827" }}>Tổng cộng</Text>
                  <Title level={4} style={{ margin: 0, fontSize: 20, color: "#111827" }}>
                    {fmtVND(grandTotal)}
                  </Title>
                </div>

                <div style={{ 
                  background: "#F9FAFB", 
                  padding: 10, 
                  borderRadius: 8,
                  border: "1px solid #E5E7EB",
                  marginTop: 6
                }}>
                  <Text style={{ fontSize: 13, lineHeight: 1.6, color: "#6B7280" }}>
                    💡 Tiền cọc được hoàn trả sau khi bạn trả thiết bị trong tình trạng tốt
                  </Text>
                </div>

                <Button
                  type="primary"
                  size="large"
                  icon={<CheckCircleOutlined />}
                  block
                  onClick={placeOrder}
                  loading={placing}
                  style={{ 
                    background: "#111827", 
                    borderColor: "#111827",
                    height: 48,
                    fontSize: 16,
                    fontWeight: 500,
                    marginTop: 10
                  }}
                >
                  Đặt đơn thuê
                </Button>

                <Button 
                  icon={<ShoppingCartOutlined />} 
                  block 
                  onClick={() => navigate("/cart")} 
                  disabled={placing}
                  size="large"
                  style={{ height: 44 }}
                >
                  Quay lại giỏ hàng
                </Button>
              </Space>
            </Card>
          </Col>
        </Row>
      </div>
    </div>
  );
}