// src/pages/cart/CartPage.jsx
import React, { useMemo, useState, useEffect } from "react";
import {
  Row, Col, Card, Typography, Breadcrumb, Button, InputNumber,
  Divider, Space, Empty, DatePicker, Tooltip, Skeleton
} from "antd";
import {
  DeleteOutlined, ArrowLeftOutlined, ShoppingCartOutlined, CalendarOutlined
} from "@ant-design/icons";
import { Link, useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import toast from "react-hot-toast";
import { getDeviceModelById, normalizeModel } from "../../lib/deviceModelsApi";
import {
  getCartFromStorage, saveCartToStorage,
  removeFromCart, updateCartItemQuantity, debugCart
} from "../../lib/cartUtils";
import { getMyKyc } from "../../lib/kycApi";

const { Title, Text } = Typography;

const fmtVND = (n) =>
  Number(n || 0).toLocaleString("vi-VN", { style: "currency", currency: "VND" });
const disabledPast = (cur) => cur && cur < dayjs().startOf("day");
const CART_DATES_STORAGE_KEY = "techrent-cart-dates";

/* ===== Helpers: persist/read rental dates ===== */
function persistCartDates(startDate, endDate) {
  if (!startDate || !endDate) return;
  const payload = {
    startDate: dayjs(startDate).format("YYYY-MM-DD"),
    endDate: dayjs(endDate).format("YYYY-MM-DD"),
  };
  try {
    localStorage.setItem(CART_DATES_STORAGE_KEY, JSON.stringify(payload));
    // backup session để hạn chế mất dữ liệu khi tab riêng tư
    sessionStorage.setItem(CART_DATES_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore storage errors (quota/unsupported)
  }
}

function readCartDates() {
  try {
    const fromLocal = localStorage.getItem(CART_DATES_STORAGE_KEY);
    const fromSession = sessionStorage.getItem(CART_DATES_STORAGE_KEY);
    const raw = fromLocal || fromSession;
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d?.startDate || !d?.endDate) return null;
    return { start: dayjs(d.startDate), end: dayjs(d.endDate) };
  } catch {
    return null;
  }
}

const createCartItem = (model, qty = 1) => ({
  id: model.id,
  name: model.name,
  brand: model.brand,
  image: model.image,
  dailyPrice: model.pricePerDay,
  depositPercent: model.depositPercent,
  deviceValue: model.deviceValue,
  qty,
  note: model.description || "",
});

export default function CartPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // KYC
  const [kycStatus, setKycStatus] = useState("");
  const [kycLoading, setKycLoading] = useState(true);

  // Dates (init from storage to avoid reset)
  const initialDates = (() => {
    const stored = readCartDates();
    if (stored?.start && stored?.end) return stored;
    return { start: dayjs().add(1, "day"), end: dayjs().add(6, "day") };
  })();
  const [startDate, setStartDate] = useState(initialDates.start);
  const [endDate, setEndDate] = useState(initialDates.end);

  useEffect(() => {
    const loadCart = async () => {
      try {
        setLoading(true);

        // 1) đọc ngày đã lưu (nếu có)
        const stored = readCartDates();
        if (stored?.start) setStartDate(stored.start);
        if (stored?.end) setEndDate(stored.end);

        // 2) load items
        const cartItems = getCartFromStorage();
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
        debugCart();
      } finally {
        setLoading(false);
      }
    };

    loadCart();
  }, []);

  // Load KYC status
  useEffect(() => {
    const loadKycStatus = async () => {
      try {
        setKycLoading(true);
        const kyc = await getMyKyc();
        const status = String(kyc?.kycStatus || kyc?.status || "").toLowerCase();
        setKycStatus(status || "unverified");
      } catch {
        setKycStatus("unverified");
      } finally {
        setKycLoading(false);
      }
    };
    loadKycStatus();
  }, []);

  // Persist items
  useEffect(() => {
    if (!loading) saveCartToStorage(items);
  }, [items, loading]);

  // Persist dates tự động + đảm bảo khi rời trang
  useEffect(() => {
    if (startDate && endDate) persistCartDates(startDate, endDate);

    const onBeforeUnload = () => {
      if (startDate && endDate) persistCartDates(startDate, endDate);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        if (startDate && endDate) persistCartDates(startDate, endDate);
      }
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [startDate, endDate]);

  const days = useMemo(() => {
    if (!startDate || !endDate) return 1;
    const diff = endDate.startOf("day").diff(startDate.startOf("day"), "day");
    return Math.max(1, diff || 1);
  }, [startDate, endDate]);

  // Tính tiền
  const lineTotals = useMemo(
    () =>
      items.map((it) => {
        const qty = Number(it.qty || 1);
        const subtotal = Number(it.dailyPrice || 0) * days * qty;
        const deposit = Number(it.deviceValue || 0) * Number(it.depositPercent || 0) * qty;
        return {
          id: it.id,
          name: it.name,
          qty,
          subtotal,
          deposit,
          depositPercent: Number(it.depositPercent || 0),
        };
      }),
    [items, days]
  );

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
    const updated = items.map((it) =>
      String(it.id) === idStr ? { ...it, ...patch } : it
    );
    setItems(updated);
    if (patch.qty !== undefined) updateCartItemQuantity(id, patch.qty);
  };

  const removeItemHandler = (id) => {
    const idStr = String(id);
    setItems((prev) => prev.filter((it) => String(it.id) !== idStr));
    removeFromCart(id);
  };

  // Chuẩn hoá kyc -> bucket
  const kycBucket = useMemo(() => {
    const s = String(kycStatus || "").toLowerCase();
    if (!s || s === "unverified") return "unverified";
    if (s.includes("verified") || s.includes("approved")) return "verified";
    if (s.includes("reject") || s.includes("denied")) return "rejected";
    if (s.includes("pending") || s.includes("submit") || s.includes("review"))
      return "pending";
    return "unverified";
  }, [kycStatus]);

  const goShopping = () => {
    persistCartDates(startDate, endDate);
    navigate("/");
  };

  const checkout = () => {
    persistCartDates(startDate, endDate);

    if (!items.length) {
      toast("Giỏ hàng đang trống.", { icon: "🛒" });
      return;
    }
    if (kycLoading) {
      toast.loading("Đang kiểm tra trạng thái KYC...", { id: "kyc-check" });
      setTimeout(() => toast.dismiss("kyc-check"), 900);
      return;
    }

    if (kycBucket !== "verified") {
      toast("Vui lòng hoàn tất KYC trước khi đặt đơn.", { icon: "🪪" });
      navigate(`/kyc?return=${encodeURIComponent("/checkout")}`);
      return;
    }

    navigate("/checkout");
  };

  if (loading || kycLoading) {
    return (
      <div className="min-h-screen" style={{ background: "#F5F7FA" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <Breadcrumb
            items={[{ title: <Link to="/">Trang chủ</Link> }, { title: "Giỏ hàng" }]}
            className="mb-4"
          />
          <Title level={3}>Giỏ hàng</Title>
          <Skeleton active paragraph={{ rows: 8 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#F5F7FA" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <Breadcrumb
          items={[{ title: <Link to="/">Trang chủ</Link> }, { title: "Giỏ hàng" }]}
          className="mb-4"
        />
        <Title level={3} style={{ color: "#111827", marginBottom: 16 }}>
          Giỏ hàng
        </Title>

        <Row gutter={[24, 24]}>
          {/* LEFT: Items */}
          <Col xs={24} lg={9}>
            <Card
              bordered
              className="rounded-xl"
              bodyStyle={{ padding: 16 }}
              title={<Text strong>Sản phẩm trong giỏ</Text>}
            >
              {items.length === 0 ? (
                <Empty description="Chưa có sản phẩm" />
              ) : (
                items.map((it) => {
                  const percent = Math.round(Number(it.depositPercent || 0) * 100);
                  const line = lineTotals.find((x) => x.id === it.id);
                  return (
                    <Card
                      key={it.id}
                      bordered
                      style={{ marginBottom: 12, borderColor: "#E5E7EB" }}
                      bodyStyle={{ padding: 16 }}
                    >
                      <div
                        style={{
                          display: "flex",
                          gap: 16,
                          alignItems: "flex-start",
                        }}
                      >
                        <div
                          style={{
                            width: 80,
                            height: 80,
                            flexShrink: 0,
                            backgroundImage: `url(${it.image})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                            borderRadius: 10,
                            border: "1px solid #E5E7EB",
                          }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                            <Text strong style={{ color: "#111827", fontSize: 15 }}>
                              {it.name}
                            </Text>
                            <Tooltip title="Xóa khỏi giỏ hàng">
                              <Button
                                type="text"
                                danger
                                size="small"
                                icon={<DeleteOutlined />}
                                onClick={() => removeItemHandler(it.id)}
                              />
                            </Tooltip>
                          </div>

                          <div style={{ marginBottom: 12 }}>
                            <div style={{ marginBottom: 4 }}>
                              <Text style={{ color: "#111827", fontSize: 14 }}>
                                Giá thuê: <strong>{fmtVND(it.dailyPrice)}</strong> / ngày
                              </Text>
                            </div>
                            <div style={{ marginBottom: 4 }}>
                              <Text type="secondary" style={{ fontSize: 13 }}>
                                Giá trị thiết bị: {fmtVND(it.deviceValue)}
                              </Text>
                            </div>
                            <div>
                              <Text type="secondary" style={{ fontSize: 13 }}>
                                Tiền cọc ({percent}%): <strong style={{ color: "#111827" }}>{fmtVND(line?.deposit || 0)}</strong>
                              </Text>
                            </div>
                          </div>

                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <Space.Compact>
                              <Button onClick={() => updateItem(it.id, { qty: Math.max(1, it.qty - 1) })}>
                                –
                              </Button>
                              <InputNumber
                                min={1}
                                value={it.qty}
                                onChange={(v) => updateItem(it.id, { qty: v || 1 })}
                                style={{ width: 60, textAlign: "center" }}
                              />
                              <Button onClick={() => updateItem(it.id, { qty: it.qty + 1 })}>+</Button>
                            </Space.Compact>
                            
                            <Text strong style={{ color: "#111827", fontSize: 15 }}>
                              {fmtVND(line?.subtotal || 0)}
                            </Text>
                          </div>
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
            <Card
              bordered
              className="rounded-xl"
              bodyStyle={{ padding: 16 }}
              title={<Text strong>Thời gian thuê</Text>}
            >
              <Space direction="vertical" size={12} style={{ width: "100%" }}>
                <div>
                  <Text type="secondary" className="block">
                    Ngày bắt đầu
                  </Text>
                  <DatePicker
                    value={startDate}
                    onChange={(v) => {
                      setStartDate(v);
                      persistCartDates(v, endDate);
                    }}
                    style={{ width: "100%" }}
                    format="YYYY-MM-DD"
                    disabledDate={disabledPast}
                    suffixIcon={<CalendarOutlined />}
                  />
                </div>
                <div>
                  <Text type="secondary" className="block">
                    Ngày kết thúc
                  </Text>
                  <DatePicker
                    value={endDate}
                    onChange={(v) => {
                      setEndDate(v);
                      persistCartDates(startDate, v);
                    }}
                    style={{ width: "100%" }}
                    format="YYYY-MM-DD"
                    disabledDate={(cur) =>
                      disabledPast(cur) ||
                      (startDate &&
                        cur.startOf("day").diff(startDate.startOf("day"), "day") <= 0)
                    }
                    suffixIcon={<CalendarOutlined />}
                  />
                </div>
                <div>
                  <Text type="secondary" className="block">
                    Số ngày
                  </Text>
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
            <Card
              bordered
              className="rounded-xl"
              bodyStyle={{ padding: 16 }}
              title={<Text strong>Tóm tắt đơn hàng</Text>}
            >
              <Space direction="vertical" size={12} style={{ width: "100%" }}>
                {lineTotals.map((ln) => (
                  <div
                    key={ln.id}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      paddingBottom: 8,
                      borderBottom: "1px solid #F3F4F6",
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <Text style={{ color: "#111827", display: "block", fontSize: 14 }}>
                        {ln.name}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 13 }}>
                        {ln.qty} × {days} ngày
                      </Text>
                    </div>
                    <Text strong style={{ color: "#111827", fontSize: 14, marginLeft: 12 }}>
                      {fmtVND(ln.subtotal)}
                    </Text>
                  </div>
                ))}
              </Space>

              <Divider />

              <div className="space-y-2">
                <div className="flex items-center justify-between" style={{ padding: "8px 0" }}>
                  <Text style={{ color: "#6B7280", fontSize: 14 }}>Tiền thuê thiết bị</Text>
                  <Text strong style={{ color: "#111827", fontSize: 15 }}>{fmtVND(subtotal)}</Text>
                </div>
                <div className="flex items-center justify-between" style={{ padding: "8px 0" }}>
                  <Text style={{ color: "#6B7280", fontSize: 14 }}>Tiền cọc</Text>
                  <Text strong style={{ color: "#111827", fontSize: 15 }}>{fmtVND(deposit)}</Text>
                </div>
              </div>

              <Divider />

              <div className="flex items-center justify-between" style={{ padding: "12px 0" }}>
                <Text strong style={{ fontSize: 16, color: "#111827" }}>Tổng cộng</Text>
                <Title level={4} style={{ margin: 0, color: "#111827", fontSize: 20 }}>
                  {fmtVND(grandTotal)}
                </Title>
              </div>

              <div style={{ 
                background: "#F9FAFB", 
                padding: 12, 
                borderRadius: 8, 
                marginTop: 8,
                border: "1px solid #E5E7EB"
              }}>
                <Text type="secondary" style={{ fontSize: 13, lineHeight: 1.6 }}>
                  💡 Tiền cọc được hoàn trả sau khi bạn trả thiết bị trong tình trạng tốt
                </Text>
              </div>

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
                onClick={goShopping}
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