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
  Radio,
  Tooltip,
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

// Helpers
const fmtVND = (n) => n.toLocaleString("vi-VN", { style: "currency", currency: "VND" });
const disabledPast = (cur) => cur && cur < dayjs().startOf("day");

// Mock items
const INITIAL_ITEMS = [
  {
    id: "mbp16-m3pro",
    name: 'MacBook Pro 16" M3 Pro',
    badge: "MacBook",
    image:
      "data:image/webp;base64,UklGRp4FAABXRUJQVlA4IJIFAACQIACdASqYAGQAPjkMjkciEREOCCADhLS24sPmtmEoiwG0YRn80/cDvHMUPNA/7no3+oP+h6sX+26+Ho1le18CCDIvMOIUUAHtasRFGaUJ0lz7D7QdLnYlPy2/YY6oXsAKEJie8AwM7lTDwZ9Pjw98bEi7bO6ECtnN8f61ayhhSUrrkTjiPaZCOyYoSDs4I67YFUQySxuQIMaOmlteF7i9CKwoh5ja5E593jpcqQpJ+m92pmFCO9ZJinM6Zllp2F3ecZSOx4kS0ZzR5f1daSxCqVtk+r0tG4vcwEkugNqE2DdWhWIu8lXtpV3oRD/nr2WbxQ0A1bINkOq8xzp2VZnFBg0wb6WvFHrUTmOKgAD+/10TPsBV++1ufdABSzof5FdN/KDv8YF3fa2gwTu1LjX8PmfLP+9tAr/xkRj0gyRA2quO1nMurREKiHDffSbOFAQxMKK1RUXVSVK6N+hvSF5Jq7o96Y8JIlOcRvskK8onIeRXsbsisRtk3HE2DO00LYsPU2vMXGrPV6ZtZKrNZ+0N9CJdmADupb4hrOuiCnWzA6opt+/TNlvCfD5/5N2S7KBtQ0LJauijmvpA/b4Kt+fbgLyELW05De+jy/87MBQfostmWGM7uCyD1WKdAqLVTOs03bhNexgN7cLjIapOHyySUXL96IVzBKOY0b9PTWU/x2LEnW6ouBG0nUK1W0JmnfhPE/L2VnYUbSLwXeXjvmwh2Ifn5QemlVCE6GzISjgLX/w2w8h/cKmL2Yp76Pq1ZZlijgvmGZtZinnkf6lTVFE64+NYwMa/JV8xVpJx9Y6hLIAOHTysIEFcaMfRUAeghvjk+4xg/RrOP5LmeEbgEXNQwf67dxX5Hq1VFscSyOvtOp+n40rrrzrWx473c7SeE25Kq/C7mpv9ol3+XEbAWTzURJo70ffySppMlVnkBTXURe3vHKwbqAbH7jAv84BOgqhk30VTsir/ZeaoR9nhUubyRTNeB3mvbXuX3HC7tfKgB/fZZ0woKzu01amqWX3HPI28S5APy7LScOT3oNWLLLMzOPu0TIuagFigYEpiwjHED6YzsPERKKaAvQOOopWZ/w7lNfUNP1E/aU/Nk+NZWHo+37g7xSl5wIGIMoZvcAe1ARsoLRl4vbbSuWr2sCWR9cK5KO5q8q7Igz2uVz5derf3ypPltl4PXk9CoVkxaL24FpevO7iZkJqTGtg7M16hUTQTzupwKskWSTNumE1sg4qA5v9loWq5nPsiejcN1bxrnJVw32LN8biTrT/TsobdnBlRrW0WyySvJgf501DNCy4t2O2G95rEy84UF3XSkzhdkPwVPbvgxI6c5kPh6A3euuqfB93el3YDCaSFL0hBUbOaQx8ntclIdaJtxto8UxgJ1XGI3uQrEtvnJQfHbrU3P3FQLuYF6OUCUSImLL2JyJDBjS2fDYLDUUCmYmBvAt7cFc70kwOul0m5iqCZIndyw84MvMaNi38/pm4WAwe2+on4YYmvptn6RklS5nP+fRbkeCNrAdM6/GMY2CMMczdgPk2MbX5+/T93VjfZ//0ng5JK1fEkoXARtJ+YI2x/MTcM3imO973N76kobuuKgI7n0/+QA+L5IPL3h2X+ksNFly1keeb6MtUaNddO356SanXEaTmYCXo+eiEaBwGtICN2UCAok1t/a0xKj98v3redv2n/JsfwFUPkOLoot0qd+UJuz4XuyA8Uea+xihKBJ/MUf/+ECbUhIRC8qB0qdgR2M5xdd92+Zj8/QGnhmRxdhjykGgwusKvtg/CtCvj4BqLnUv97t3xfvyMP4NZRyi/DFdcF07v8Rr1P/aRVB5OFsyIJl9cc6yQnnPMX+A5Qhm6V/sV54YXch63UEanFhkx3ilJH9Gnt5xDl3rRyulwAAAAAAAAA",
    dailyPrice: 1_200_000,
    qty: 1,
    note: "Hiệu năng mạnh cho đồ họa/dựng phim",
  },
  {
    id: "canon-eos-r5",
    name: "Canon EOS R5",
    badge: "Camera",
    image:
      "https://i.ebayimg.com/images/g/4uYAAeSw8Z1o8PM8/s-l1600.webp",
    dailyPrice: 1_300_000,
    qty: 1,
    note: "Máy ảnh chuyên nghiệp",
  },
  {
    id: "Iphone 17-pro-max",
    name: "Iphone 17 Pro Max",
    badge: "Điện Thoại",
    image:
      "https://lh3.googleusercontent.com/RGhCKugjPU0Lg_DINbPIkLUFpvwn4C6SQxH-5LsNxbMERnVC0hsRwHQg2akzWWgms8wPP1LNuTW-5QvYblGbipab1ds0yF9B=w500-rw",
    dailyPrice: 700_000,
    qty: 1,
    note: "Điện thoại thông minh cao cấp",
  },
];

const DEPOSIT_RATE = 0.35;

export default function CartPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState(INITIAL_ITEMS);

  // Dates
  const [startDate, setStartDate] = useState(dayjs().add(1, "day"));
  const [endDate, setEndDate] = useState(dayjs().add(6, "day"));
  const [delivery, setDelivery] = useState(true);

  const days = useMemo(() => {
    if (!startDate || !endDate) return 1;
    const diff = endDate.startOf("day").diff(startDate.startOf("day"), "day");
    return Math.max(1, diff || 1);
  }, [startDate, endDate]);

  const lineTotals = useMemo(
    () =>
      items.map((it) => ({
        id: it.id,
        name: it.name,
        total: it.dailyPrice * days * it.qty,
      })),
    [items, days]
  );

  const subtotal = useMemo(() => lineTotals.reduce((s, x) => s + x.total, 0), [lineTotals]);
  const deposit = useMemo(() => Math.round(subtotal * DEPOSIT_RATE), [subtotal]);
  const grandTotal = useMemo(() => subtotal + deposit, [subtotal, deposit]);

  const updateItem = (id, patch) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const removeItem = (id) => setItems((prev) => prev.filter((it) => it.id !== id));

  const checkout = () => {
    if (items.length === 0) return message.warning("Giỏ hàng đang trống.");
    if (!startDate || !endDate) return message.warning("Vui lòng chọn ngày thuê.");
    message.success("Đi tới trang thanh toán…");
    navigate("/checkout");
  };

  return (
    <div className="min-h-screen" style={{ background: "#F5F7FA" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <Breadcrumb
          items={[
            { title: <Link to="/">Trang chủ</Link> },
            { title: "Giỏ hàng" },
          ]}
          className="mb-4"
        />

        <Title level={3} style={{ color: "#111827", marginBottom: 16 }}>
          Giỏ hàng
        </Title>

        <Row gutter={[24, 24]}>
          {/* LEFT: Items in Cart */}
          <Col xs={24} lg={9}>
            <Card
              bordered
              className="rounded-xl"
              bodyStyle={{ padding: 16 }}
              title={<Text strong>Sản phẩm trong giỏ</Text>}
              headStyle={{ background: "#fff" }}
            >
              {items.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có sản phẩm" />
              ) : (
                items.map((it) => {
                  const lineTotal = it.dailyPrice * days * it.qty;
                  return (
                    <Card
                      key={it.id}
                      bordered
                      style={{ background: "#fff", marginBottom: 12, borderColor: "#E5E7EB" }}
                      bodyStyle={{ padding: 12 }}
                    >
                      {/* 3 cột cố định như Figma: 64px | 1fr | auto */}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "64px 1fr auto",
                          alignItems: "center",
                          columnGap: 12,
                        }}
                      >
                        {/* Ảnh 64x64 */}
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

                        {/* Thông tin (để minWidth:0 để không phá grid) */}
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                            <Link to={`/device/${it.id}`} style={{ minWidth: 0 }}>
                              <Text
                                strong
                                style={{
                                  color: "#111827",
                                  display: "block",
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  maxWidth: "100%",
                                }}
                              >
                                {it.name}
                              </Text>
                            </Link>
                          </div>

                          <Text type="secondary" style={{ display: "block", marginBottom: 6 }}>
                            {it.note}
                          </Text>

                          <Text strong style={{ fontSize: 14, color: "#111827" }}>
                            {fmtVND(it.dailyPrice)}
                          </Text>
                          <Text type="secondary"> / ngày</Text>
                        </div>

                        {/* Cột phải: trên = thành tiền + xoá, dưới = số lượng (căn phải) */}
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-end",
                            gap: 8,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <Tooltip title="Xóa">
                              <Button type="text" icon={<DeleteOutlined />} onClick={() => removeItem(it.id)} />
                            </Tooltip>
                          </div>

                          <Space.Compact>
                            <Button onClick={() => updateItem(it.id, { qty: Math.max(1, it.qty - 1) })}>
                              –
                            </Button>
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

          {/* MIDDLE: Rental Dates */}
          <Col xs={24} lg={8}>
            <Card
              bordered
              className="rounded-xl"
              bodyStyle={{ padding: 16 }}
              title={<Text strong>Thời gian thuê</Text>}
              headStyle={{ background: "#fff" }}
            >
              <Space direction="vertical" size={12} style={{ width: "100%" }}>
                <div>
                  <Text type="secondary" className="block">
                    Ngày bắt đầu
                  </Text>
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
                  <Text type="secondary" className="block">
                    Ngày kết thúc
                  </Text>
                  <DatePicker
                    value={endDate}
                    onChange={setEndDate}
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

          {/* RIGHT: Order Summary */}
          <Col xs={24} lg={7}>
            <Card
              bordered
              className="rounded-xl"
              bodyStyle={{ padding: 16 }}
              title={<Text strong>Tóm tắt đơn hàng</Text>}
              headStyle={{ background: "#fff" }}
              style={{ position: "sticky", top: 24 }}
            >
              <Space direction="vertical" size={8} style={{ width: "100%" }}>
                {lineTotals.map((ln) => (
                  <div
                    key={ln.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      color: "#111827",
                    }}
                  >
                    <Text type="secondary" style={{ maxWidth: 220 }}>
                      {ln.name} ({days} ngày)
                    </Text>
                    <Text>{fmtVND(ln.total)}</Text>
                  </div>
                ))}
              </Space>

              <Divider />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Text type="secondary">Tiền cọc</Text>
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
                *Tiền cọc sẽ được hoàn lại sau khi trả hàng đúng điều kiện.
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
