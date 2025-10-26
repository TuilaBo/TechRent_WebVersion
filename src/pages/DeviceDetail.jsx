// src/pages/DeviceDetail.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Row, Col, Card, Typography, Breadcrumb, Space, Divider,
  InputNumber, Button, Image, Tabs, Skeleton
} from "antd";
import { ShoppingCartOutlined, MinusOutlined, PlusOutlined } from "@ant-design/icons";
import toast, { Toaster } from "react-hot-toast";
import { useAuth } from "../context/AuthContext";                  // +++
import { getDeviceModelById, normalizeModel, fmtVND } from "../lib/deviceModelsApi";
import { addToCart, getCartCount } from "../lib/cartUtils";        // +++

const { Title, Text, Paragraph } = Typography;

export default function DeviceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();                           // +++

  const [qty, setQty] = useState(1);
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false); // chặn spam

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const raw = await getDeviceModelById(id);
        setItem(normalizeModel(raw));
      } catch (e) {
        toast.error(e?.response?.data?.message || e?.message || "Không thể tải chi tiết thiết bị.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const perDaySubtotal = useMemo(
    () => Math.round((item?.pricePerDay || 0) * qty),
    [item, qty]
  );

  const handleAddToCart = async () => {
    if (adding) return;

    // Chặn khi chưa đăng nhập + gợi ý đăng nhập
    if (!isAuthenticated) {
      toast((t) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <b>Vui lòng đăng nhập để thêm vào giỏ hàng</b>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => { toast.dismiss(t.id); navigate("/login"); }}
              style={{
                padding: "6px 10px", borderRadius: 6,
                border: "1px solid #111827", background: "#111827",
                color: "#fff", cursor: "pointer",
              }}
            >
              Đăng nhập
            </button>
            <button
              onClick={() => toast.dismiss(t.id)}
              style={{
                padding: "6px 10px", borderRadius: 6,
                border: "1px solid #e5e7eb", background: "#fff",
                color: "#111827", cursor: "pointer",
              }}
            >
              Để sau
            </button>
          </div>
        </div>
      ));
      return;
    }

    try {
      setAdding(true);
      const result = await addToCart(id, qty);
      if (result.success) {
        // Toast xác nhận
        toast.success((t) => (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div>
              <b>{item?.name}</b> × <b>{qty}</b> đã thêm vào giỏ •{" "}
              <b>{fmtVND(item?.pricePerDay)}/ngày</b>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => { toast.dismiss(t.id); navigate("/cart"); }}
                style={{
                  padding: "6px 10px", borderRadius: 6,
                  border: "1px solid #111827", background: "#111827",
                  color: "#fff", cursor: "pointer",
                }}
              >
                Xem giỏ hàng
              </button>
              <button
                onClick={() => toast.dismiss(t.id)}
                style={{
                  padding: "6px 10px", borderRadius: 6,
                  border: "1px solid #e5e7eb", background: "#fff",
                  color: "#111827", cursor: "pointer",
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        ), { duration: 2500 });

        // Báo cho header cập nhật badge + bump
        try {
          const count = getCartCount();
          window.dispatchEvent(new CustomEvent("cart:updated", { detail: { count } }));
        } catch {}
      } else {
        toast.error(result.error || "Không thể thêm vào giỏ hàng");
      }
    } catch {
      toast.error("Có lỗi xảy ra khi thêm vào giỏ hàng");
    } finally {
      setAdding(false);
    }
  };

  if (loading || !item) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: "#FAFAFA" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Skeleton active paragraph={{ rows: 12 }} />
          <Toaster position="top-right" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#FAFAFA" }}>
      {/* Toaster cục bộ (giữ đúng như bạn muốn) */}
      <Toaster position="top-right" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Breadcrumb
          items={[
            { title: <a href="/">Trang chủ</a> },
            { title: item.brand || "Thiết bị" },
            { title: item.name },
          ]}
          className="mb-4"
        />

        <Row gutter={[32, 32]}>
          {/* Gallery trái */}
          <Col xs={24} lg={14}>
            <Card bordered={false} className="rounded-2xl shadow-md overflow-hidden" bodyStyle={{ padding: 0, background: "#fff" }}>
              <Image.PreviewGroup>
                <Row gutter={[12, 12]}>
                  {(item.images?.length ? item.images : [item.image]).slice(0, 3).map((src, idx) => (
                    <Col span={idx === 0 ? 24 : 12} key={idx}>
                      <div className="overflow-hidden rounded-xl transition-transform hover:scale-105 duration-300">
                        <Image
                          src={src || "https://placehold.co/1200x900?text=No+Image"}
                          alt={`${item.name} ${idx + 1}`}
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
                  {item.name}
                </Title>
                <Text style={{ color: "#4B5563", fontSize: 16 }}>
                  Thương hiệu: <b style={{ color: "#111827" }}>{item.brand || "—"}</b>
                </Text>
              </div>

              <Divider className="my-4" style={{ borderColor: "#E5E7EB" }} />

              {/* Giá / ngày */}
              <div className="mb-4">
                <Text className="block text-base mb-1" style={{ color: "#6B7280" }}>Giá / ngày</Text>
                <Title level={3} style={{ margin: 0, fontFamily: "'Inter', sans-serif", color: "#111827" }}>
                  {fmtVND(item.pricePerDay)}
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
                    disabled={adding}
                  />
                  <InputNumber
                    min={1}
                    value={qty}
                    onChange={(v) => setQty(v || 1)}
                    style={{ width: 120, height: 48, textAlign: "center", fontSize: 18 }}
                    disabled={adding}
                  />
                  <Button
                    size="large"
                    onClick={() => setQty((q) => q + 1)}
                    icon={<PlusOutlined />}
                    style={{ height: 48, borderTopRightRadius: 10, borderBottomRightRadius: 10 }}
                    disabled={adding}
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
                  loading={adding}
                  disabled={adding}
                  style={{ background: "#111827", border: "1px solid #111827", borderRadius: 10, height: 52, fontSize: 16 }}
                >
                  {adding ? "Đang thêm..." : "Thêm vào giỏ"}
                </Button>
              </div>

              {/* Subtotal */}
              <div className="mt-2">
                <Text style={{ color: "#6B7280" }}>Tạm tính / ngày: </Text>
                <Text strong style={{ color: "#111827" }}>{fmtVND(perDaySubtotal)}</Text>
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
                        {item.description || "Chưa có mô tả."}
                      </Paragraph>
                    ),
                  },
                  {
                    key: "spec",
                    label: "Thông số",
                    children: (
                      <Paragraph style={{ marginBottom: 0, whiteSpace: "pre-line", fontSize: 16, lineHeight: 1.8, color: "#111827" }}>
                        {item.specifications || "Chưa có thông số."}
                      </Paragraph>
                    ),
                  },
                ]}
                tabBarStyle={{ color: "#111827" }}
              />
            </Card>
          </Col>
        </Row>
      </div>

      <style>{`
        .btn-black:hover, .btn-black:focus { background: #0B1220 !important; border-color: #0B1220 !important; }
        .ant-tabs-tab-btn { color: #6B7280; }
        .ant-tabs-tab.ant-tabs-tab-active .ant-tabs-tab-btn { color: #111827 !important; }
        .ant-tabs-ink-bar { background: #111827 !important; }
      `}</style>
    </div>
  );
}
