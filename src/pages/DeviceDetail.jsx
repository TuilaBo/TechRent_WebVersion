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
  name: "Macbook Pro 16-inch M1 Max 2021",
  brand: "Apple",

  category: "Laptop",
  tags: ["4K", "4K 120Hz"],
  rating: 4.8,
  reviews: 126,
  pricePerDay: 1000000, // VND/ngày
  images: [
    "https://cdn.tgdd.vn/Products/Images/44/279402/macbook-pro-16-inch-m1-max-2021-32-core-gpu-1-750x500.jpg",
    "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTjGUwy2P8lSD0uK0wRiEj11hii7XUj1GldOQ&s",
    "https://macfinder.co.uk/wp-content/smush-webp/2023/08/img-MacBook-Pro-Retina-16-Inch-41411-scaled-scaled-1250x1250.jpg.webp",
  ],
  shortDesc:
  "MacBook Pro 16-inch (Apple Silicon) – màn hình Liquid Retina XDR 120Hz, pin lâu, hiệu năng mạnh cho đồ họa, dựng phim, lập trình.",

longDesc: `Gói thuê gồm: MacBook Pro 16-inch (M3 Pro/M2 Pro tùy lô), bộ sạc 140W USB-C và cáp USB-C.
Máy được cài macOS mới nhất, hỗ trợ cài phần mềm cơ bản theo yêu cầu. Thiết bị được vệ sinh/QC trước và sau mỗi lượt thuê.`,

specs: [
  { k: "Màn hình", v: "16.2\" Liquid Retina XDR, 3456×2234, ProMotion 120Hz" },
  { k: "CPU", v: "Apple Silicon (M3 Pro/M2 Pro tùy lô)" },
  { k: "RAM", v: "16–36GB (tùy cấu hình)" },
  { k: "Lưu trữ", v: "512GB–1TB SSD (tùy cấu hình)" },
  { k: "Cổng kết nối", v: "MagSafe 3, 3× Thunderbolt 4 (USB-C), HDMI, SDXC, tai nghe 3.5mm" },
  { k: "Không dây", v: "Wi-Fi 6E, Bluetooth 5.x" },
  { k: "Âm thanh & camera", v: "6 loa Spatial Audio, mic chất lượng studio, camera 1080p" },
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

  const perDaySubtotal = useMemo(() => {
    return Math.round(product.pricePerDay * qty);
  }, [qty]);

  const handleAddToCart = () => {
    console.log({
      productId: product.id,
      qty,
    });
    // TODO: gọi API thêm giỏ
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#FAFAFA" }}>
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
            <Card bordered={false} className="rounded-2xl shadow-md overflow-hidden" bodyStyle={{ padding: 0, background: "#fff" }}>
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
              style={{ position: "sticky", top: 24, background: "#fff" }}
              bodyStyle={{ padding: 24 }}
            >
              <div className="mb-4">
                <Title level={2} style={{ marginBottom: 8, fontFamily: "'Inter', sans-serif", color: "#111827" }}>
                  {product.name}
                </Title>
                <Text style={{ color: "#4B5563", fontSize: 16 }}>{product.shortDesc}</Text>
              </div>

              <div className="grid grid-cols-2 gap-y-2 text-base mb-4">
                <Text style={{ color: "#6B7280" }}>Thương hiệu:</Text>
                <Text strong style={{ color: "#111827" }}>{product.brand}</Text>
                <Text style={{ color: "#6B7280" }}>Loại sản phẩm:</Text>
                <Text style={{ color: "#111827" }}>{product.category}</Text>
                <Text style={{ color: "#6B7280" }}>Đánh giá:</Text>
                <span className="inline-flex items-center gap-2">
                  <Rate allowHalf disabled defaultValue={product.rating} style={{ fontSize: 18, color: "#111827" }} />
                  <Text style={{ color: "#6B7280" }}>({product.reviews})</Text>
                </span>
              </div>


              <Divider className="my-4" style={{ borderColor: "#E5E7EB" }} />

              {/* Giá / ngày */}
              <div className="mb-4">
                <Text className="block text-base mb-1" style={{ color: "#6B7280" }}>
                  Giá / ngày
                </Text>
                <Title level={3} style={{ margin: 0, fontFamily: "'Inter', sans-serif", color: "#111827" }}>
                  {formatVND(product.pricePerDay)}
                </Title>
              </div>

              {/* Số lượng */}
              <div className="mb-4">
                <Text strong className="block mb-2 text-lg" style={{ color: "#111827" }}>Số lượng</Text>
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

              {/* Thêm giỏ */}
              <div className="mb-2 flex items-center gap-4">
                <Button
                  type="primary"
                  size="large"
                  icon={<ShoppingCartOutlined />}
                  className="flex-1 btn-black"
                  onClick={handleAddToCart}
                  style={{
                    background: "#111827",
                    border: "1px solid #111827",
                    borderRadius: 10,
                    height: 52,
                    fontSize: 16,
                  }}
                >
                  Thêm vào giỏ
                </Button>
              </div>

              {/* Subtotal (ẩn màu) */}
              <div className="mt-2">
                <Text style={{ color: "#6B7280" }}>Tạm tính / ngày: </Text>
                <Text strong style={{ color: "#111827" }}>{formatVND(perDaySubtotal)}</Text>
              </div>
            </Card>
          </Col>
        </Row>

        {/* Tabs dưới */}
        <Row gutter={[32, 32]} className="mt-8">
          <Col xs={24} lg={14}>
            <Card bordered={false} className="rounded-2xl shadow-md" bodyStyle={{ padding: 24, background: "#fff" }}>
              <Tabs
                defaultActiveKey="desc"
                size="large"
                items={[
                  {
                    key: "desc",
                    label: "Mô tả",
                    children: (
                      <Paragraph style={{ marginBottom: 0, whiteSpace: "pre-line", fontSize: 16, lineHeight: 1.8, color: "#111827" }}>
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
                          <div key={s.k} className="rounded-xl p-4 bg-white shadow-sm" style={{ border: "1px solid #E5E7EB" }}>
                            <Text className="block text-base" style={{ color: "#6B7280" }}>{s.k}</Text>
                            <Text strong style={{ fontSize: 16, color: "#111827" }}>{s.v}</Text>
                          </div>
                        ))}
                      </div>
                    ),
                  },
                  {
                    key: "policy",
                    label: "Chính sách",
                    children: (
                      <ul className="list-disc pl-6 space-y-3 text-base" style={{ color: "#111827" }}>
                        {product.policy.map((p, i) => <li key={i}>{p}</li>)}
                      </ul>
                    ),
                  },
                ]}
                tabBarStyle={{ color: "#111827" }}
              />
            </Card>
          </Col>
        </Row>
      </div>

      {/* styles nhỏ cho B/W */}
      <style>{`
        .btn-black:hover,
        .btn-black:focus {
          background: #0B1220 !important;
          border-color: #0B1220 !important;
        }
        .ant-tabs-tab-btn { color: #6B7280; }
        .ant-tabs-tab.ant-tabs-tab-active .ant-tabs-tab-btn { color: #111827 !important; }
        .ant-tabs-ink-bar { background: #111827 !important; }
      `}</style>
    </div>
  );
}
