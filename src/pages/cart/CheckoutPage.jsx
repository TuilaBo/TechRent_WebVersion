import React, { useEffect, useMemo, useState } from "react";
import {
  Row, Col, Card, Typography, Breadcrumb, Button, Divider, Space,
  message, Skeleton, Form, Input
} from "antd";
import { Link, useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import { getCartFromStorage, clearCart } from "../../lib/cartUtils";
import { getDeviceModelById, normalizeModel } from "../../lib/deviceModelsApi";
import { fetchMyCustomerProfile } from "../../lib/customerApi";
import { createRentalOrder } from "../../lib/rentalOrdersApi";
import { ShoppingCartOutlined, CheckCircleOutlined } from "@ant-design/icons";

const { Title, Text, Paragraph } = Typography;

const CART_DATES_STORAGE_KEY = "techrent-cart-dates";
const fmtVND = (n) => Number(n || 0).toLocaleString("vi-VN", { style: "currency", currency: "VND" });

const toISOStartOfDay = (d) => dayjs(d).startOf("day").toDate().toISOString();
const toISOEndOfDay   = (d) => dayjs(d).endOf("day").toDate().toISOString();

export default function Checkout() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);

  const [items, setItems] = useState([]);
  const [startDate, setStartDate] = useState(dayjs().add(1, "day"));
  const [endDate, setEndDate] = useState(dayjs().add(6, "day"));

  // Customer info
  const [customerId, setCustomerId] = useState(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);

        try {
          const me = await fetchMyCustomerProfile();
          setCustomerId(me?.customerId ?? me?.id ?? null);
          setFullName(me?.fullName ?? me?.username ?? "");
          setPhone(me?.phoneNumber ?? "");
          setEmail(me?.email ?? "");
          setShippingAddress(me?.shippingAddress ?? "");
        } catch {}

        const savedDates = localStorage.getItem(CART_DATES_STORAGE_KEY);
        if (savedDates) {
          const d = JSON.parse(savedDates);
          if (d.startDate) setStartDate(dayjs(d.startDate));
          if (d.endDate) setEndDate(dayjs(d.endDate));
        }

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
                pricePerDay: it.dailyPrice, depositPercent: it.depositPercent ?? 0,
                deviceValue: it.deviceValue ?? 0, qty: it.qty || 1
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

  // Tính tiền
  const lineTotals = useMemo(() => {
    return items.map((it) => {
      const qty = Number(it.qty || 1);
      const subtotal = Number(it.pricePerDay || 0) * days * qty;
      const deposit = Math.round(
        Number(it.deviceValue || 0) * Number(it.depositPercent || 0) * qty
      );
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
    if (!items.length) return message.warning("Giỏ hàng đang trống.");
    if (!customerId) return message.error("Không xác định được khách hàng, vui lòng đăng nhập lại.");

    try {
      setPlacing(true);

      const payload = {
        startDate: toISOStartOfDay(startDate),
        endDate: toISOEndOfDay(endDate),
        customerId,
        shippingAddress: (shippingAddress || "").trim(),
        note: (note || "").trim(),
        contactName: (fullName || "").trim(),
        contactPhone: (phone || "").trim(),
        email: (email || "").trim(),
        items: items.map((x) => ({ id: x.id, qty: x.qty })),
        orderDetails: items.map((x) => ({ deviceModelId: x.id, quantity: x.qty })),
      };

      const res = await createRentalOrder(payload);
      message.success("Đặt đơn thuê thành công!");
      clearCart();
      const orderId = res?.orderId ?? res?.id;
      navigate(orderId ? `/orders/${orderId}` : "/orders");
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || "Đặt đơn thất bại.";
      message.error(msg);
    } finally {
      setPlacing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: "#F5F7FA" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <Breadcrumb items={[{ title: <Link to="/">Trang chủ</Link> }, { title: "Thanh toán" }]} className="mb-4" />
          <Title level={3} style={{ color: "#111827", marginBottom: 16 }}>Thanh toán</Title>
          <Skeleton active paragraph={{ rows: 8 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#F5F7FA" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <Breadcrumb items={[{ title: <Link to="/">Trang chủ</Link> }, { title: "Thanh toán" }]} className="mb-4" />
        <Title level={3} style={{ color: "#111827", marginBottom: 16 }}>Xác nhận & Thanh toán</Title>

        <Row gutter={[24, 24]}>
          {/* LEFT: Info */}
          <Col xs={24} lg={14}>
            <Card bordered className="rounded-xl" bodyStyle={{ padding: 16 }} title={<Text strong>Thông tin nhận hàng</Text>}>
              <Form layout="vertical">
                <Form.Item label="Họ và tên">
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Họ và tên" />
                </Form.Item>
                <Form.Item label="Số điện thoại">
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09xx xxx xxx" />
                </Form.Item>
                <Form.Item label="Email">
                  <Input value={email} disabled />
                </Form.Item>
                <Form.Item label="Địa chỉ giao">
                  <Input.TextArea
                    value={shippingAddress}
                    onChange={(e) => setShippingAddress(e.target.value)}
                    autoSize={{ minRows: 2, maxRows: 4 }}
                    placeholder="Số nhà, đường, phường, quận, TP.HCM"
                  />
                </Form.Item>
                <Form.Item label="Ghi chú thêm (tuỳ chọn)">
                  <Input.TextArea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    autoSize={{ minRows: 3, maxRows: 6 }}
                    placeholder="VD: Giao trước 9h, gọi mình trước khi tới…"
                  />
                </Form.Item>
              </Form>
            </Card>

            <Card bordered className="rounded-xl mt-3" bodyStyle={{ padding: 16 }} title={<Text strong>Sản phẩm</Text>}>
              <Space direction="vertical" size={12} style={{ width: "100%" }}>
                {lineTotals.map((ln) => {
                  const item = items.find(i => i.id === ln.id) || {};
                  const percent = Math.round(Number(item.depositPercent || 0) * 100);
                  return (
                    <div
                      key={ln.id}
                      style={{ display: "grid", gridTemplateColumns: "64px 1fr auto", gap: 12, alignItems: "center" }}
                    >
                      <div
                        style={{
                          width: 64, height: 64, borderRadius: 10,
                          background: `url(${item.image}) center/cover no-repeat`
                        }}
                      />
                      <div>
                        <Text strong style={{ display: "block" }}>{ln.name}</Text>
                        <Text type="secondary">
                          SL: {ln.qty} • {days} ngày • Cọc {percent}% 
                        </Text>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <Text strong style={{ display: "block" }}>{fmtVND(ln.subtotal)}</Text>
                        <Text type="secondary" style={{ display: "block" }}>
                          Cọc: {fmtVND(ln.deposit)}
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
            <Card bordered className="rounded-xl" bodyStyle={{ padding: 16 }} title={<Text strong>Tóm tắt thanh toán</Text>}>
              <Space direction="vertical" size={8} style={{ width: "100%" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <Text type="secondary">Tiền hàng</Text>
                  <Text>{fmtVND(subtotal)}</Text>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <Text type="secondary">Tiền cọc (theo % × giá trị máy)</Text>
                  <Text>{fmtVND(deposit)}</Text>
                </div>
                <Divider style={{ margin: "12px 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <Text strong>Tổng cộng</Text>
                  <Title level={4} style={{ margin: 0 }}>{fmtVND(grandTotal)}</Title>
                </div>

                <Paragraph type="secondary" style={{ marginTop: 8 }}>
                  *Tiền cọc tính theo tỷ lệ cọc của từng mẫu nhân với **giá trị thiết bị** và không phụ thuộc số ngày thuê.
                </Paragraph>

                <Button
                  type="primary"
                  size="large"
                  icon={<CheckCircleOutlined />}
                  block
                  onClick={placeOrder}
                  loading={placing}
                  style={{ background: "#111827", borderColor: "#111827" }}
                >
                  Đặt đơn thuê
                </Button>

                <Button icon={<ShoppingCartOutlined />} block onClick={() => navigate("/cart")}>
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
