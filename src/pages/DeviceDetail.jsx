// src/pages/DeviceDetail.jsx
import React, { useMemo, useState } from "react";
import {
  Row, Col, Card, Typography, Breadcrumb, Tag, Space, Divider,
  InputNumber, Button, Image, Tabs, Rate
} from "antd";
import { ShoppingCartOutlined, MinusOutlined, PlusOutlined } from "@ant-design/icons";

const { Title, Text, Paragraph } = Typography;

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
  images: [
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
  const [qty, setQty] = useState(1);

  const formatVND = (n) =>
    n.toLocaleString("vi-VN", { style: "currency", currency: "VND" });

  // Tạm tính theo NGÀY (không chọn ngày ở trang detail, không còn kiểu dáng)
  const perDaySubtotal = useMemo(() => {
    return Math.round(product.pricePerDay * qty);
  }, [qty]);

  const handleAddToCart = () => {
    console.log({
      productId: product.id,
      qty,
      // Ngày thuê sẽ chọn chung ở Cart, không gửi ở đây
    });
    // TODO: gọi API thêm giỏ
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Breadcrumb
          items={[
            { title: <a href="/">Trang chủ</a> },
            { title: <a href="/games">Máy Games</a> },
            { title: product.name },
          ]}
          className="mb-4"
        />

        <Row gutter={[32, 32]}>
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
                          height={idx === 0 ? 400 : 200}
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
              style={{ position: "sticky", top: 24 }}
              bodyStyle={{ padding: 24 }}
            >
              <div className="mb-4">
                <Title level={2} style={{ marginBottom: 8, fontFamily: "'Inter', sans-serif" }}>
                  {product.name}
                </Title>
                <Text type="secondary" style={{ fontSize: 16 }}>{product.shortDesc}</Text>
              </div>

              <div className="grid grid-cols-2 gap-y-2 text-base mb-4">
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

              {/* Giá / ngày */}
              <div className="mb-4">
                <Text type="secondary" className="block text-base mb-1">
                  Giá / ngày
                </Text>
                <Title level={3} style={{ color: "#ef4444", margin: 0, fontFamily: "'Inter', sans-serif" }}>
                  {formatVND(product.pricePerDay)}
                </Title>
              </div>

              {/* Số lượng (nổi bật hơn) */}
              <div className="mb-4">
                <Text strong className="block mb-2 text-lg">Số lượng</Text>
                <Space.Compact style={{ width: 240 }}>
                  <Button
                    size="large"
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    icon={<MinusOutlined />}
                    style={{ height: 48, borderTopLeftRadius: 10, borderBottomLeftRadius: 10 }}
                  />
                  <InputNumber
                    min={1}
                    value={qty}
                    onChange={(v) => setQty(v || 1)}
                    style={{
                      width: 120,
                      height: 48,
                      textAlign: "center",
                      fontSize: 18,
                    }}
                  />
                  <Button
                    size="large"
                    onClick={() => setQty((q) => q + 1)}
                    icon={<PlusOutlined />}
                    style={{ height: 48, borderTopRightRadius: 10, borderBottomRightRadius: 10 }}
                  />
                </Space.Compact>
              </div>

              {/* Thêm giỏ + Tạm tính */}
              <div className="mb-2 flex items-center gap-4">
                <Button
                  type="primary"
                  size="large"
                  icon={<ShoppingCartOutlined />}
                  className="flex-1"
                  onClick={handleAddToCart}
                  style={{
                    background: 'linear-gradient(to right, #3b82f6, #2563eb)',
                    border: 'none',
                    borderRadius: 10,
                    height: 52,
                    fontSize: 16,
                  }}
                >
                  Thêm vào giỏ
                </Button>
              </div>
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
