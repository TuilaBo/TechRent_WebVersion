// src/pages/browse/RentalList.jsx
import React, { useMemo, useState } from "react";
import {
  Row,
  Col,
  Card,
  Typography,
  Checkbox,
  Button,
  Space,
  Divider,
  Tag,
  Pagination,
  Radio,
  Tooltip,
  Badge,
} from "antd";
import {
  AppstoreOutlined,
  BarsOutlined,
  ShoppingCartOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";

const { Title, Text } = Typography;

/* ---------------- Mock data ---------------- */
const PRODUCTS = [
  {
    id: "p1",
    name: "Canon EOS R5",
    subtitle: "Máy ảnh mirrorless chuyên nghiệp",
    pricePerDay: 2238900,
    brand: "Canon",
    category: "Cameras",
    image:
      "https://legacy-photolab.com/cdn/shop/files/IMG_7927_4b780e65-9b6c-4ede-a5b7-285e5903fe37_525x700.jpg?v=1728587942",
  },
  {
    id: "p2",
    name: "Canon Eos 3000D",
    subtitle: "Máy ảnh mirrorless chuyên nghiệp",
    pricePerDay: 1712100,
    brand: "Canon",
    category: "Cameras",
    image:
      "https://kyma.vn/cdn-cgi/imagedelivery/ZeGtsGSjuQe1P3UP_zk3fQ/45852ce5-f488-4b49-f23c-7b22539c0800/storedata",
  },
  {
    id: "p3",
    name: "Canon Eos RP kit 24-105mm",
    subtitle: "Máy ảnh mirrorless chuyên nghiệp",
    pricePerDay: 1185300,
    brand: "Canon",
    category: "Cameras",
    image:
      "https://kyma.vn/cdn-cgi/imagedelivery/ZeGtsGSjuQe1P3UP_zk3fQ/277e51b4-cf3c-4696-99ff-7761c7189000/storedata",
  },
  {
    id: "p4",
    name: "Fujji X-T4",
    subtitle: "Mirrorless quay chụp đa dụng",
    pricePerDay: 1975500,
    brand: "Fujifilm",
    category: "Cameras",
    image:
      "https://kyma.vn/cdn-cgi/imagedelivery/ZeGtsGSjuQe1P3UP_zk3fQ/6e0b07c0-0ae2-4cb7-b82b-ba18aaa06300/storedata",
  },
];

const BRANDS = ["Canon", "Fujifilm", "Sony", "Nikon", "DJI"];

/** 5 khoảng giá (đơn vị VND/ngày) */
const PRICE_BUCKETS = [
  { key: "lt500", label: "Dưới 500,000đ", test: (v) => v < 500000 },
  { key: "500-1m", label: "500,000đ - 1,000,000đ", test: (v) => v >= 500000 && v <= 1000000 },
  { key: "1m-1_5m", label: "1,000,000đ - 1,500,000đ", test: (v) => v > 1000000 && v <= 1500000 },
  { key: "2m-5m", label: "2,000,000đ - 5,000,000đ", test: (v) => v >= 2000000 && v <= 5000000 },
  { key: "gt5m", label: "Trên 5,000,000đ", test: (v) => v > 5000000 },
];

export default function RentalList() {
  const navigate = useNavigate();

  /* ---------------- Filters state (JS thuần, không TS) ---------------- */
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [priceKey, setPriceKey] = useState(null);
  const [layout, setLayout] = useState("grid"); // 'grid' | 'list'
  const [page, setPage] = useState(1);
  const pageSize = 6;

  const clearAll = () => {
    setSelectedBrands([]);
    setPriceKey(null);
    setPage(1);
  };

  const filtered = useMemo(() => {
    return PRODUCTS.filter((p) => {
      if (selectedBrands.length && !selectedBrands.includes(p.brand)) return false;
      if (priceKey) {
        const bucket = PRICE_BUCKETS.find((b) => b.key === priceKey);
        if (bucket && !bucket.test(p.pricePerDay)) return false;
      }
      return true;
    });
  }, [selectedBrands, priceKey]);

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page]);

  /* ---------------- CARD — giống ProductCard & chống giãn ---------------- */
  const GridCard = ({ item }) => {
    const gotoDetail = () => navigate(`/devices/${item.id}`);

    return (
      <div
        data-card
        onClick={gotoDetail}
        onKeyDown={(e) => e.key === "Enter" && gotoDetail()}
        role="button"
        tabIndex={0}
        style={{
          width: "100%",
          maxWidth: 300,           // hạn chế card không giãn to
          background: "#ffffff",
          borderRadius: 8,
          overflow: "hidden",
          boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
          transition: "all .3s ease",
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          minHeight: 350,
          margin: "0 auto",       // căn giữa trong ô grid
        }}
      >
        <div style={{ height: 200, overflow: "hidden" }}>
          <img
            alt={item.name}
            src={item.image}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transition: "transform .3s ease",
            }}
          />
        </div>

        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: "#333", margin: 0 }}>{item.name}</h3>
          <p style={{ color: "#666", fontSize: 14, margin: 0 }}>{item.subtitle}</p>
        </div>

        <div
          style={{
            padding: "0 16px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: 16, fontWeight: "bold", color: "#333" }}>
            {item.pricePerDay.toLocaleString("vi-VN")} đ/ngày
          </span>
          <Button
            style={{
              background: "#000",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              padding: "8px 16px",
              fontSize: 14,
              fontWeight: 500,
              transition: "background .3s ease",
            }}
            icon={<ShoppingCartOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              navigate("/cart");
            }}
          >
            Thuê ngay
          </Button>
        </div>
      </div>
    );
  };

  /* ----- List item ----- */
  const ProductRow = ({ item }) => (
    <Card bordered style={{ marginBottom: 12, borderColor: "#E5E7EB" }} bodyStyle={{ padding: 12 }}>
      <Row gutter={12} align="middle">
        <Col span={6}>
          <div
            style={{
              width: "100%",
              paddingTop: "56%",
              backgroundImage: `url(${item.image})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              borderRadius: 8,
            }}
          />
        </Col>
        <Col span={18}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div>
              <Space size={6} wrap>
                <Tag>{item.category}</Tag>
                <Tag>{item.brand}</Tag>
              </Space>
              <Title level={5} style={{ margin: "4px 0 0 0" }}>
                {item.name}
              </Title>
              <Text type="secondary">{item.subtitle}</Text>
            </div>
            <div style={{ textAlign: "right" }}>
              <Text strong style={{ display: "block" }}>
                {item.pricePerDay.toLocaleString("vi-VN")} đ/ngày
              </Text>
              <Button size="small" icon={<ShoppingCartOutlined />} style={{ marginTop: 6, color: "#111827", borderColor: "#E5E7EB" }}>
                Thuê ngay
              </Button>
            </div>
          </div>
        </Col>
      </Row>
    </Card>
  );

  return (
    <div className="min-h-screen" style={{ background: "#FAFAFA" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Row gutter={[24, 24]}>
          {/* ---------------- Sidebar ---------------- */}
          <Col xs={24} md={8} lg={6} xl={5}>
            <Card bordered bodyStyle={{ padding: 16 }} style={{ borderColor: "#E5E7EB", background: "#fff" }}>
              <Title level={5} style={{ marginTop: 0 }}>
                Bộ lọc
              </Title>

              {/* Giá sản phẩm */}
              <div>
                <Text strong>GIÁ SẢN PHẨM –</Text>
                <div style={{ marginTop: 8 }}>
                  <Radio.Group
                    value={priceKey}
                    onChange={(e) => {
                      setPriceKey(e.target.value);
                      setPage(1);
                    }}
                  >
                    <Space direction="vertical">
                      {PRICE_BUCKETS.map((b) => (
                        <Radio key={b.key} value={b.key}>
                          {b.label}
                        </Radio>
                      ))}
                    </Space>
                  </Radio.Group>
                </div>
              </div>

              <Divider />

              {/* Brand */}
              <div>
                <Text strong>Brand</Text>
                <div style={{ marginTop: 8 }}>
                  <Checkbox.Group
                    value={selectedBrands}
                    onChange={(vals) => {
                      setSelectedBrands(vals || []);
                      setPage(1);
                    }}
                  >
                    <Space direction="vertical">
                      {BRANDS.map((b) => (
                        <Checkbox key={b} value={b}>
                          {b}
                        </Checkbox>
                      ))}
                    </Space>
                  </Checkbox.Group>
                </div>
              </div>

              <Divider />

              <Space direction="vertical" style={{ width: "100%" }}>
                <Button
                  type="primary"
                  block
                  style={{ background: "#111827", borderColor: "#111827" }}
                  onClick={() => setPage(1)}
                >
                  Áp dụng
                </Button>
                <Button block onClick={clearAll}>
                  Xoá tất cả
                </Button>
              </Space>
            </Card>
          </Col>

          {/* ---------------- Content ---------------- */}
          <Col xs={24} md={16} lg={18} xl={19}>
            <div
              style={{
                background: "#fff",
                border: "1px solid #E5E7EB",
                borderRadius: 8,
                padding: 12,
                marginBottom: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Title level={4} style={{ margin: 0 }}>
                  Máy ảnh
                </Title>
                <Space>
                  <Badge count={filtered.length} color="#111827" />
                  <Radio.Group value={layout} onChange={(e) => setLayout(e.target.value)} optionType="button">
                    <Tooltip title="Lưới">
                      <Radio.Button value="grid">
                        <AppstoreOutlined />
                      </Radio.Button>
                    </Tooltip>
                    <Tooltip title="Danh sách">
                      <Radio.Button value="list">
                        <BarsOutlined />
                      </Radio.Button>
                    </Tooltip>
                  </Radio.Group>
                </Space>
              </div>
            </div>

            {layout === "grid" ? (
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                    gap: 20,
                    justifyItems: "center",
                  }}
                >
                  {paged.map((item) => (
                    <GridCard key={item.id} item={item} />
                  ))}
                </div>

                <style>{`
                  [data-card]:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                  }
                  [data-card]:hover img {
                    transform: scale(1.05);
                  }
                  [data-card]:focus {
                    outline: 2px solid #1890ff;
                  }
                `}</style>
              </>
            ) : (
              <div>
                {paged.map((item) => (
                  <ProductRow item={item} key={item.id} />
                ))}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
              <Pagination current={page} onChange={setPage} total={filtered.length} pageSize={pageSize} showSizeChanger={false} />
            </div>
          </Col>
        </Row>
      </div>
    </div>
  );
}
