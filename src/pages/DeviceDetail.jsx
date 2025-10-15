// src/pages/DeviceDetail.jsx
import React, { useMemo, useState } from "react";
import {
  Row, Col, Card, Typography, Breadcrumb, Tag, Space, Divider,
  InputNumber, Button, Image, Tabs, Tooltip, Rate, DatePicker
} from "antd";
import { ShoppingCartOutlined, HeartOutlined, ShareAltOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

const { Title, Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;

// Mock data
const product = {
  id: "ps5-combo-tv",
  name: "Cho thuê combo Playstation 5 kèm TV",
  brand: "Sony",
  sku: "PS5-55-4K-1D-RENT",
  category: "Gaming Console",
  tags: ["4K", "4K 120Hz"],
  rating: 4.8,
  reviews: 126,
  pricePerDay: 1000000, // VND/ngày
  variants: [
    { key: 'PS5 + TV 55" 4K', disabled: false, priceFactor: 1 },
    { key: 'PS5 + TV 75" 4K', disabled: false, priceFactor: 1.4 },
    { key: 'PS5 + TV 98" 4K', disabled: true, priceFactor: 2 },
  ],
  images: [
    "https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=1600&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=1600&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=1600&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=1600&auto=format&fit=crop",
  ],
  shortDesc:
    "Bộ combo PS5 + TV 4K sẵn sàng cắm là chơi. Hỗ trợ 4K/120Hz, trải nghiệm game mượt mà cho party/teambuilding.",
  longDesc: `Combo bao gồm: Playstation 5 (Digital), 2 tay cầm DualSense, TV 4K, dây HDMI 2.1, dây nguồn, chân đế.
Miễn phí tư vấn setup, hỗ trợ giao lắp tại nội thành. Thiết bị được vệ sinh/QC trước và sau mỗi lượt thuê.`,
  specs: [
    { k: "Độ phân giải", v: "4K (3840x2160) 60/120Hz" },
    { k: "Kết nối", v: "HDMI 2.1, Wi-Fi, Bluetooth" },
    { k: "Phụ kiện", v: "02 tay cầm DualSense, cáp, remote TV" },
  ],
  policy: [
    "Cọc 2–5 triệu tùy gói. Xuất hóa đơn GTGT theo yêu cầu.",
    "Miễn phí đổi thiết bị nếu lỗi do nhà cung cấp.",
    "Bồi thường theo chính sách nếu hư hại/thiếu phụ kiện.",
  ],
};

export default function DeviceDetail() {
  const [variant, setVariant] = useState(product.variants[0].key);
  const [dateRange, setDateRange] = useState([]); // [start, end]
  const [qty, setQty] = useState(1);

  const currentVariant = useMemo(
    () => product.variants.find((v) => v.key === variant),
    [variant]
  );

  // tính số ngày từ khoảng ngày (>= 1)
  const days = useMemo(() => {
    const [start, end] = dateRange || [];
    if (!start || !end) return 1;
    const diff = dayjs(end).startOf("day").diff(dayjs(start).startOf("day"), "day");
    return Math.max(1, diff || 1);
  }, [dateRange]);

  const subtotal = useMemo(() => {
    const factor = currentVariant?.priceFactor ?? 1;
    return Math.round(product.pricePerDay * factor * days * qty);
  }, [days, qty, currentVariant]);

  const formatVND = (n) =>
    n.toLocaleString("vi-VN", { style: "currency", currency: "VND" });

  const handleAddToCart = () => {
    console.log({
      productId: product.id,
      variant,
      startDate: dateRange?.[0]?.toISOString?.() || null,
      endDate: dateRange?.[1]?.toISOString?.() || null,
      days,
      qty,
      subtotal,
    });
    // TODO: gọi API thêm giỏ
  };

  return (
    <div className="min-h-screen bg-gray-50"> {/* Softer background */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Breadcrumb
          items={[
            { title: <a href="/">Trang chủ</a> },
            { title: <a href="/games">Máy Games</a> },
            { title: product.name },
          ]}
          className="mb-4"
        />

        <Row gutter={[32, 32]}> {/* Increased gutter for breathing room */}
          {/* Gallery trái */}
          <Col xs={24} lg={14}>
            <Card bordered={false} className="rounded-2xl shadow-md overflow-hidden" bodyStyle={{ padding: 0 }}>
              <Image.PreviewGroup>
                <Row gutter={[12, 12]}>
                  {product.images.slice(0, 3).map((src, idx) => (
                    <Col span={idx === 0 ? 24 : 12} key={idx}>
                      <div className="overflow-hidden rounded-xl transition-transform hover:scale-105 duration-300">
                        <Image
                          src={src}
                          alt={`${product.name} ${idx + 1}`}
                          width="100%"
                          height={idx === 0 ? 400 : 200} // Adjusted heights for better proportion
                          style={{ objectFit: "cover" }}
                          placeholder
                        />
                      </div>
                    </Col>
                  ))}
                </Row>
              </Image.PreviewGroup>
            </Card>
          </Col>

          {/* Panel phải */}
          <Col xs={24} lg={10}>
            <Card
              bordered={false}
              className="rounded-2xl shadow-md"
              style={{ position: "sticky", top: 24 }} // Slightly higher sticky for modern feel
              bodyStyle={{ padding: 24 }}
            >
              <div className="mb-4">
                <Title level={2} style={{ marginBottom: 8, fontFamily: "'Inter', sans-serif" }}>
                  {product.name}
                </Title>
                <Text type="secondary" style={{ fontSize: 16 }}>{product.shortDesc}</Text>
              </div>

              <div className="grid grid-cols-2 gap-y-2 text-base mb-4"> {/* Larger text */}
                <Text type="secondary">Thương hiệu:</Text>
                <Text strong>{product.brand}</Text>
                <Text type="secondary">Loại sản phẩm:</Text>
                <Text>{product.category}</Text>
                <Text type="secondary">Đánh giá:</Text>
                <span className="inline-flex items-center gap-2">
                  <Rate allowHalf disabled defaultValue={product.rating} style={{ fontSize: 18 }} />
                  <Text type="secondary">({product.reviews})</Text>
                </span>
              </div>

              <Space size={[8, 8]} wrap className="mb-4">
                {product.tags.map((t) => (
                  <Tag key={t} color="blue" style={{ borderRadius: 20, padding: '0 12px' }}>{t}</Tag>
                ))}
              </Space>

              <Divider className="my-4" />

              {/* Giá */}
              <div className="mb-4">
                <Text type="secondary" className="block text-base mb-1">
                  Giá / ngày (theo cấu hình)
                </Text>
                <Title level={3} style={{ color: "#ef4444", margin: 0, fontFamily: "'Inter', sans-serif" }}>
                  {formatVND(product.pricePerDay * (currentVariant?.priceFactor ?? 1))}
                </Title>
              </div>

              {/* Kiểu dáng */}
              <div className="mb-4">
                <Text strong className="block mb-2 text-lg">Kiểu dáng:</Text>
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  {product.variants.map((v) => (
                    <Button
                      key={v.key}
                      type={variant === v.key ? "primary" : "default"}
                      block
                      size="large"
                      disabled={v.disabled}
                      onClick={() => setVariant(v.key)}
                      style={{
                        borderRadius: 8,
                        transition: 'all 0.3s',
                        height: 48, // Taller buttons for touch-friendliness
                      }}
                    >
                      {v.key} {v.disabled && <Tag color="default" className="ml-2">Hết hàng</Tag>}
                    </Button>
                  ))}
                </Space>
              </div>

              {/* Khoảng ngày thuê */}
              <div className="mb-4">
                <Text strong className="block mb-2 text-lg">Thời gian thuê:</Text>
                <RangePicker
                  style={{ width: "100%", height: 48, borderRadius: 8 }}
                  format="DD/MM/YYYY"
                  disabledDate={(current) => current && current < dayjs().startOf("day")}
                  onChange={(vals) => setDateRange(vals)}
                />
                <Text type="secondary" className="block mt-2">
                  Số ngày tính tiền: <Text strong>{days}</Text>
                </Text>
              </div>

              {/* Số lượng + thêm giỏ */}
              <div className="mb-2 flex items-center gap-4">
                <InputNumber min={1} value={qty} onChange={(v) => setQty(v || 1)} style={{ width: 80, height: 48, borderRadius: 8 }} />
                <Button
                  type="primary"
                  size="large"
                  icon={<ShoppingCartOutlined />}
                  className="flex-1"
                  onClick={handleAddToCart}
                  style={{
                    background: 'linear-gradient(to right, #3b82f6, #2563eb)',
                    border: 'none',
                    borderRadius: 8,
                    height: 48,
                    fontSize: 16,
                  }}
                >
                  Thêm vào giỏ
                </Button>
              </div>
              <Text type="secondary" className="block text-right">
                Tạm tính: <Text strong style={{ color: '#ef4444' }}>{formatVND(subtotal)}</Text>
              </Text>
            </Card>
          </Col>
        </Row>

        {/* Tabs dưới */}
        <Row gutter={[32, 32]} className="mt-8">
          <Col xs={24} lg={14}>
            <Card bordered={false} className="rounded-2xl shadow-md" bodyStyle={{ padding: 24 }}>
              <Tabs
                defaultActiveKey="desc"
                size="large"
                items={[
                  {
                    key: "desc",
                    label: "Mô tả",
                    children: (
                      <Paragraph style={{ marginBottom: 0, whiteSpace: "pre-line", fontSize: 16, lineHeight: 1.8 }}>
                        {product.longDesc}
                      </Paragraph>
                    ),
                  },
                  {
                    key: "spec",
                    label: "Thông số",
                    children: (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {product.specs.map((s) => (
                          <div key={s.k} className="rounded-xl border border-gray-200 p-4 bg-white shadow-sm">
                            <Text type="secondary" className="block text-base">{s.k}</Text>
                            <Text strong style={{ fontSize: 16 }}>{s.v}</Text>
                          </div>
                        ))}
                      </div>
                    ),
                  },
                  {
                    key: "policy",
                    label: "Chính sách",
                    children: (
                      <ul className="list-disc pl-6 space-y-3 text-base">
                        {product.policy.map((p, i) => <li key={i}>{p}</li>)}
                      </ul>
                    ),
                  },
                ]}
              />
            </Card>
          </Col>
        </Row>
      </div>
    </div>
  );
}
