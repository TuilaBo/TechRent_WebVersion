import React, { useMemo, useState, useEffect } from "react";
import {
  Row, Col, Card, Typography, Breadcrumb, Button, InputNumber,
  Divider, Space, message, Empty, DatePicker, Tooltip, Skeleton
} from "antd";
import {
  DeleteOutlined, ArrowLeftOutlined, ShoppingCartOutlined, CalendarOutlined
} from "@ant-design/icons";
import { Link, useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import { getDeviceModelById, normalizeModel } from "../../lib/deviceModelsApi";
import {
  getCartFromStorage, saveCartToStorage,
  removeFromCart, updateCartItemQuantity, debugCart
} from "../../lib/cartUtils";

const { Title, Text } = Typography;

const fmtVND = (n) => Number(n || 0).toLocaleString("vi-VN", { style: "currency", currency: "VND" });
const disabledPast = (cur) => cur && cur < dayjs().startOf("day");
const CART_DATES_STORAGE_KEY = "techrent-cart-dates";

const createCartItem = (model, qty = 1) => ({
  id: model.id,
  name: model.name,
  brand: model.brand,
  image: model.image,
  dailyPrice: model.pricePerDay,
  depositPercent: model.depositPercent,   // <-- cần có
  deviceValue: model.deviceValue,         // <-- cần có
  qty,
  note: model.description || "",
});

export default function CartPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Dates
  const [startDate, setStartDate] = useState(dayjs().add(1, "day"));
  const [endDate, setEndDate] = useState(dayjs().add(6, "day"));

  useEffect(() => {
    const loadCart = async () => {
      try {
        setLoading(true);

        const cartItems = getCartFromStorage();
        const savedDates = localStorage.getItem(CART_DATES_STORAGE_KEY);
        if (savedDates) {
          const d = JSON.parse(savedDates);
          if (d.startDate) setStartDate(dayjs(d.startDate));
          if (d.endDate) setEndDate(dayjs(d.endDate));
        }

        if (!Array.isArray(cartItems) || cartItems.length === 0) {
          setItems([]);
          return;
        }

        const itemsWithDetails = await Promise.all(
          cartItems.map(async (ci) => {
            try {
              const m = await getDeviceModelById(ci.id);
              const nm = normalizeModel(m);
              return createCartItem(nm, ci.qty || 1);
            } catch {
              // Fallback nếu API lỗi
              return {
                id: ci.id,
                name: ci.name,
                image: ci.image,
                dailyPrice: ci.dailyPrice,
                depositPercent: ci.depositPercent ?? 0,
                deviceValue: ci.deviceValue ?? 0,
                qty: ci.qty || 1,
                note: ci.note || "",
              };
            }
          })
        );

        setItems(itemsWithDetails);
        
        // Debug: Log cart state
        console.log('Cart loaded:', itemsWithDetails);
        debugCart();
      } catch (e) {
        console.error("Failed to load cart:", e);
        message.error("Không thể tải giỏ hàng");
        setItems([]);
      } finally {
        setLoading(false);
      }
    };

    loadCart();
  }, []);

  // Persist items to localStorage when changed (sau khi đã load xong)
  useEffect(() => {
    if (!loading) saveCartToStorage(items);
  }, [items, loading]);

  // Persist dates
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

  const days = useMemo(() => {
    if (!startDate || !endDate) return 1;
    const diff = endDate.startOf("day").diff(startDate.startOf("day"), "day");
    return Math.max(1, diff || 1);
  }, [startDate, endDate]);

  // Tính tiền từng dòng: subtotal theo ngày; cọc theo % * deviceValue * qty
  const lineTotals = useMemo(() => {
    return items.map((it) => {
      const qty = Number(it.qty || 1);
      const subtotal = Number(it.dailyPrice || 0) * days * qty;
      const deposit = Math.round(
        Number(it.deviceValue || 0) * Number(it.depositPercent || 0) * qty
      );
      return {
        id: it.id,
        name: it.name,
        qty,
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

  const updateItem = (id, patch) => {
    const idStr = String(id);
    const updated = items.map((it) => (String(it.id) === idStr ? { ...it, ...patch } : it));
    setItems(updated);
    if (patch.qty !== undefined) updateCartItemQuantity(id, patch.qty);
  };

  const removeItemHandler = (id) => {
    const idStr = String(id);
    setItems((prev) => prev.filter((it) => String(it.id) !== idStr));
    removeFromCart(id);
  };

  const checkout = () => {
    if (!items.length) return message.warning("Giỏ hàng đang trống.");
    navigate("/checkout");
  };

  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: "#F5F7FA" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <Breadcrumb items={[{ title: <Link to="/">Trang chủ</Link> }, { title: "Giỏ hàng" }]} className="mb-4" />
          <Title level={3}>Giỏ hàng</Title>
          <Skeleton active paragraph={{ rows: 8 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#F5F7FA" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <Breadcrumb items={[{ title: <Link to="/">Trang chủ</Link> }, { title: "Giỏ hàng" }]} className="mb-4" />
        <Title level={3} style={{ color: "#111827", marginBottom: 16 }}>
          Giỏ hàng
        </Title>
        
  

        <Row gutter={[24, 24]}>
          {/* LEFT: Items */}
          <Col xs={24} lg={9}>
            <Card bordered className="rounded-xl" bodyStyle={{ padding: 16 }} title={<Text strong>Sản phẩm trong giỏ</Text>}>
              {items.length === 0 ? (
                <Empty description="Chưa có sản phẩm" />
              ) : (
                items.map((it) => {
                  const percent = Math.round(Number(it.depositPercent || 0) * 100);
                  const line = lineTotals.find((x) => x.id === it.id);
                  return (
                    <Card key={it.id} bordered style={{ marginBottom: 12, borderColor: "#E5E7EB" }} bodyStyle={{ padding: 12 }}>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "64px 1fr auto",
                          alignItems: "center",
                          columnGap: 12,
                        }}
                      >
                        <div
                          style={{
                            width: 64,
                            height: 64,
                            backgroundImage: `url(${it.image})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                            borderRadius: 10,
                          }}
                        />
                        <div style={{ minWidth: 0 }}>
                          <Text strong style={{ color: "#111827", display: "block" }}>
                            {it.name}
                          </Text>

                          <Text type="secondary" style={{ display: "block", marginBottom: 6 }}>
                            {fmtVND(it.dailyPrice)} / ngày
                          </Text>
                          <Text type="secondary">
                            Cọc {percent}%: {fmtVND(line?.deposit || 0)}
                          </Text>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <Tooltip title="Xóa">
                              <Button type="text" icon={<DeleteOutlined />} onClick={() => removeItemHandler(it.id)} />
                            </Tooltip>
                          </div>
                          <Space.Compact>
                            <Button onClick={() => updateItem(it.id, { qty: Math.max(1, it.qty - 1) })}>–</Button>
                            <InputNumber
                              min={1}
                              value={it.qty}
                              onChange={(v) => updateItem(it.id, { qty: v || 1 })}
                              style={{ width: 72, textAlign: "center" }}
                            />
                            <Button onClick={() => updateItem(it.id, { qty: it.qty + 1 })}>+</Button>
                          </Space.Compact>
                        </div>
                      </div>
                    </Card>
                  );
                })
              )}
            </Card>
          </Col>

          {/* MIDDLE: Dates */}
          <Col xs={24} lg={8}>
            <Card bordered className="rounded-xl" bodyStyle={{ padding: 16 }} title={<Text strong>Thời gian thuê</Text>}>
              <Space direction="vertical" size={12} style={{ width: "100%" }}>
                <div>
                  <Text type="secondary" className="block">Ngày bắt đầu</Text>
                  <DatePicker
                    value={startDate}
                    onChange={setStartDate}
                    style={{ width: "100%" }}
                    format="YYYY-MM-DD"
                    disabledDate={disabledPast}
                    suffixIcon={<CalendarOutlined />}
                  />
                </div>
                <div>
                  <Text type="secondary" className="block">Ngày kết thúc</Text>
                  <DatePicker
                    value={endDate}
                    onChange={setEndDate}
                    style={{ width: "100%" }}
                    format="YYYY-MM-DD"
                    disabledDate={(cur) =>
                      disabledPast(cur) || (startDate && cur.startOf("day").diff(startDate.startOf("day"), "day") <= 0)
                    }
                    suffixIcon={<CalendarOutlined />}
                  />
                </div>
                <div>
                  <Text type="secondary" className="block">Số ngày</Text>
                  <div
                    style={{
                      width: "100%",
                      height: 36,
                      border: "1px solid #E5E7EB",
                      borderRadius: 6,
                      background: "#F9FAFB",
                      display: "flex",
                      alignItems: "center",
                      padding: "0 12px",
                      color: "#111827",
                    }}
                  >
                    {days} ngày
                  </div>
                </div>
              </Space>
            </Card>
          </Col>

          {/* RIGHT: Summary */}
          <Col xs={24} lg={7}>
            <Card bordered className="rounded-xl" bodyStyle={{ padding: 16 }} title={<Text strong>Tóm tắt đơn hàng</Text>}>
              <Space direction="vertical" size={8} style={{ width: "100%" }}>
                {lineTotals.map((ln) => (
                  <div
                    key={ln.id}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: "#111827" }}
                  >
                    <Text type="secondary" style={{ maxWidth: 220 }}>
                      {ln.name} ({days} ngày)
                    </Text>
                    <Text>{fmtVND(ln.subtotal)}</Text>
                  </div>
                ))}
              </Space>

              <Divider />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Text type="secondary">Tiền hàng</Text>
                  <Text>{fmtVND(subtotal)}</Text>
                </div>
                <div className="flex items-center justify-between">
                  <Text type="secondary">Tiền cọc (theo % × giá trị máy)</Text>
                  <Text>{fmtVND(deposit)}</Text>
                </div>
              </div>

              <Divider />

              <div className="flex items-center justify-between">
                <Text strong>Tổng cộng</Text>
                <Title level={4} style={{ margin: 0, color: "#111827" }}>
                  {fmtVND(grandTotal)}
                </Title>
              </div>

              <Text type="secondary" style={{ display: "block", marginTop: 8 }}>
                *Tiền cọc được tính theo tỉ lệ cọc của từng mẫu nhân với giá trị thiết bị.
              </Text>

              <Button
                type="primary"
                size="large"
                block
                icon={<ShoppingCartOutlined />}
                onClick={checkout}
                style={{ marginTop: 12, background: "#111827", borderColor: "#111827" }}
              >
                Tiến hành thanh toán
              </Button>

              <Button
                type="link"
                block
                icon={<ArrowLeftOutlined />}
                style={{ marginTop: 8, color: "#6B7280" }}
                onClick={() => navigate("/")}
              >
                Tiếp tục mua sắm
              </Button>
            </Card>
          </Col>
        </Row>
      </div>
    </div>
  );
}
