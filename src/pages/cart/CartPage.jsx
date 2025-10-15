// src/pages/cart/CartPage.jsx
import React, { useMemo, useState } from "react";
import {
  Row,
  Col,
  Card,
  Typography,
  Breadcrumb,
  Button,
  InputNumber,
  Divider,
  Space,
  message,
  Empty,
  DatePicker,
} from "antd";
import {
  DeleteOutlined,
  ArrowLeftOutlined,
  ShoppingCartOutlined,
  CalendarOutlined,
} from "@ant-design/icons";
import { Link, useNavigate } from "react-router-dom";
import dayjs from "dayjs";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

function formatVND(n) {
  return n.toLocaleString("vi-VN", { style: "currency", currency: "VND" });
}

// ---- Mock giỏ hàng (thay bằng Redux/API sau) ----
const INITIAL_ITEMS = [
  {
    id: "chair-sim",
    name: "Cho thuê bộ Ghế Lái Xe Giả Lập",
    image:
      "https://images.unsplash.com/photo-1584156584582-461f6ec49a2b?q=80&w=1200&auto=format&fit=crop",
    dailyPrice: 2_500_000, // giá/1 ngày sau giảm
    compareAtPrice: 2_625_000, // giá gốc (gạch)
    qty: 1,
    note: "Kèm màn hình 32inch 4K / 1 ngày",
  },
];

// TỶ LỆ CỌC (mock)
const DEPOSIT_RATE = 0.3;

export default function CartPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState(INITIAL_ITEMS);

  // ---- RANGE THUÊ DÙNG CHUNG TOÀN GIỎ ----
  const [rentalRange, setRentalRange] = useState(null); // [startDayjs, endDayjs]

  const globalDays = useMemo(() => {
    if (!rentalRange || rentalRange.length !== 2) return 1; // mặc định 1 ngày
    const [s, e] = rentalRange;
    const diff = e.startOf("day").diff(s.startOf("day"), "day");
    return Math.max(1, diff || 1);
  }, [rentalRange]);

  const totals = useMemo(() => {
    const subtotal = items.reduce(
      (sum, it) => sum + it.dailyPrice * globalDays * it.qty,
      0
    );
    const deposit = Math.round(subtotal * DEPOSIT_RATE);
    const grandTotal = subtotal + deposit;
    return { subtotal, deposit, grandTotal };
  }, [items, globalDays]);

  const updateItem = (id, patch) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...patch } : it))
    );
  };

  const removeItem = (id) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const checkout = () => {
    if (items.length === 0) {
      message.warning("Giỏ hàng đang trống.");
      return;
    }
    if (!rentalRange || rentalRange.length !== 2) {
      message.warning("Vui lòng chọn thời gian thuê chung cho giỏ hàng.");
      return;
    }
    message.success("Đi tới trang thanh toán…");
    navigate("/checkout");
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Breadcrumb */}
        <Breadcrumb
          items={[
            { title: <Link to="/">Trang chủ</Link> },
            { title: `Giỏ hàng (${items.length})` },
          ]}
          className="mb-2"
        />

        <Title
          level={2}
          style={{ textAlign: "center", color: "#1677ff", marginBottom: 8 }}
        >
          Giỏ hàng của bạn
        </Title>

        <div
          style={{
            width: 80,
            height: 4,
            background: "#0b5fff",
            borderRadius: 999,
            margin: "0 auto 24px",
          }}
        />

        <Row gutter={[24, 24]}>
          {/* LEFT: Danh sách sản phẩm + quy trình */}
          <Col xs={24} lg={16}>
            <Card
              bordered
              className="rounded-xl"
              bodyStyle={{ padding: 16 }}
              title={
                <span>
                Giỏ hàng 
                </span>
              }
              extra={
                <Space>
                  <CalendarOutlined />
                  <span>Thời gian thuê (áp dụng cho toàn giỏ):</span>
                  <RangePicker
                    value={rentalRange}
                    onChange={setRentalRange}
                    format="DD/MM/YYYY"
                    disabledDate={(cur) => cur && cur < dayjs().startOf("day")}
                  />
                  <Text type="secondary">Số ngày:&nbsp;<Text strong>{globalDays}</Text></Text>
                </Space>
              }
            >
              {items.length === 0 ? (
                <Empty
                  description="Chưa có sản phẩm nào"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              ) : (
                items.map((it) => {
                  const lineTotal = it.dailyPrice * globalDays * it.qty;
                  return (
                    <Card
                      key={it.id}
                      bordered={false}
                      style={{ background: "#fafafa", marginBottom: 12 }}
                      bodyStyle={{ padding: 16 }}
                    >
                      <Row gutter={[16, 16]} align="middle">
                        <Col xs={24} sm={6} md={5}>
                          <div
                            style={{
                              width: "100%",
                              paddingTop: "70%",
                              backgroundImage: `url(${it.image})`,
                              backgroundSize: "cover",
                              backgroundPosition: "center",
                              borderRadius: 8,
                            }}
                          />
                        </Col>
                        <Col xs={24} sm={18} md={19}>
                          <div className="flex justify-between items-start gap-3">
                            <div>
                              <Link to={`/device/${it.id}`}>
                                <Title level={5} style={{ margin: 0, color: "#1677ff" }}>
                                  {it.name}
                                </Title>
                              </Link>
                              <Text type="secondary">{it.note}</Text>

                              <div className="mt-2">
                                <Text strong style={{ fontSize: 16 }}>
                                  {formatVND(it.dailyPrice)}
                                </Text>
                                {it.compareAtPrice && (
                                  <Text delete type="secondary" style={{ marginLeft: 8 }}>
                                    {formatVND(it.compareAtPrice)}
                                  </Text>
                                )}
                                <Text type="secondary"> / ngày</Text>
                              </div>
                              <div className="mt-1">
                                <Text type="secondary">
                                  (Áp dụng <strong>{globalDays}</strong> ngày cho toàn giỏ)
                                </Text>
                              </div>
                            </div>

                            <div className="text-right">
                              <Text type="secondary" className="block">
                                Thành tiền:
                              </Text>
                              <Title level={4} style={{ margin: 0, color: "#ff4d4f" }}>
                                {formatVND(lineTotal)}
                              </Title>
                              <Button
                                type="text"
                                danger
                                icon={<DeleteOutlined />}
                                onClick={() => removeItem(it.id)}
                              />
                            </div>
                          </div>

                          <Divider style={{ margin: "12px 0" }} />

                          <Row gutter={[12, 12]} align="middle">
                            <Col>
                              <Text type="secondary">Số lượng:&nbsp;</Text>
                              <Space.Compact>
                                <Button
                                  onClick={() =>
                                    updateItem(it.id, { qty: Math.max(1, it.qty - 1) })
                                  }
                                >
                                  –
                                </Button>
                                <InputNumber
                                  min={1}
                                  value={it.qty}
                                  onChange={(v) => updateItem(it.id, { qty: v || 1 })}
                                  style={{ width: 70 }}
                                />
                                <Button onClick={() => updateItem(it.id, { qty: it.qty + 1 })}>
                                  +
                                </Button>
                              </Space.Compact>
                            </Col>
                          </Row>
                        </Col>
                      </Row>
                    </Card>
                  );
                })
              )}
            </Card>
          </Col>

          {/* RIGHT: Thông tin đơn hàng */}
          <Col xs={24} lg={8}>
            <Card
              bordered
              className="rounded-xl"
              bodyStyle={{ padding: 16 }}
              title={
                <Title level={4} style={{ margin: 0, color: "#1677ff" }}>
                  Thông tin đơn hàng
                </Title>
              }
              style={{ position: "sticky", top: "calc(var(--stacked-header,0px) + 16px)" }}
            >
              <Divider style={{ marginTop: 8 }} />

              {/* Hiển thị chọn ngày (optional, mirror) */}
              <div className="space-y-2" style={{ marginBottom: 12 }}>
                <Text type="secondary" className="block">Thời gian thuê</Text>
                <RangePicker
                  value={rentalRange}
                  onChange={setRentalRange}
                  format="DD/MM/YYYY"
                  style={{ width: "100%" }}
                  disabledDate={(cur) => cur && cur < dayjs().startOf("day")}
                />
                <Text type="secondary">Số ngày: <Text strong>{globalDays}</Text></Text>
              </div>

              <Divider />

              {/* Breakdown */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Text>Tạm tính</Text>
                  <Text strong>{formatVND(totals.subtotal)}</Text>
                </div>
                <div className="flex items-center justify-between">
                  <Text>Tiền cọc</Text>
                  <Text strong>{formatVND(totals.deposit)}</Text>
                </div>
              </div>

              <Divider />

              <div className="flex items-center justify-between">
                <Text strong>Tổng cộng</Text>
                <Title level={2} style={{ margin: 0, color: "#ff4d4f" }}>
                  {formatVND(totals.grandTotal)}
                </Title>
              </div>

              <Text type="secondary" style={{ display: "block", marginTop: 12 }}>
                Tiền cọc sẽ được hoàn lại sau khi trả thiết bị đúng điều kiện.
              </Text>

              <Button
                type="primary"
                size="large"
                block
                className="bg-red-600"
                icon={<ShoppingCartOutlined />}
                onClick={checkout}
                style={{ marginTop: 12 }}
              >
                THANH TOÁN
              </Button>

              <Button
                type="link"
                block
                icon={<ArrowLeftOutlined />}
                style={{ marginTop: 8 }}
                onClick={() => navigate("/")}
              >
                Tiếp tục mua hàng
              </Button>
            </Card>
          </Col>
        </Row>
      </div>
    </div>
  );
}
