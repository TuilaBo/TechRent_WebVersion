// src/pages/DeviceDetail.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Row, Col, Card, Typography, Breadcrumb, Space, Divider,
  InputNumber, Button, Image, Tabs, Skeleton, Carousel
} from "antd";
import { ShoppingCartOutlined, MinusOutlined, PlusOutlined, LeftOutlined, RightOutlined } from "@ant-design/icons";
import toast from "react-hot-toast";

import { useAuth } from "../context/AuthContext";
import { getDeviceModelById, normalizeModel, fmtVND } from "../lib/deviceModelsApi";
import { getBrandById } from "../lib/deviceManage";
import { addToCart, getCartCount } from "../lib/cartUtils";
import RelatedCard from "../components/RelatedCard";

const { Title, Text, Paragraph } = Typography;

/* ===== Helpers ===== */
const looksLikeJSON = (s) => {
  if (typeof s !== "string") return false;
  const t = s.trim();
  return (t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"));
};

// Flatten object to key/value pairs for readable list
const flattenEntries = (val, prefix = "") => {
  const out = [];
  const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
  if (Array.isArray(val)) {
    val.forEach((v, i) => {
      if (isObj(v) || Array.isArray(v)) out.push(...flattenEntries(v, `${prefix}${i + 1}. `));
      else out.push([`${prefix}${i + 1}`, v]);
    });
  } else if (isObj(val)) {
    Object.entries(val).forEach(([k, v]) => {
      const label = prefix ? `${prefix}${k}` : k;
      if (isObj(v) || Array.isArray(v)) out.push(...flattenEntries(v, `${label}.`));
      else out.push([label, v]);
    });
  } else {
    out.push([prefix || "Thông tin", val]);
  }
  return out;
};

// Render specs as text list (no JSON block)
const renderSpecsText = (specs) => {
  if (!specs) return "Chưa có thông số.";
  try {
    const parsed = typeof specs === "string" && looksLikeJSON(specs)
      ? JSON.parse(specs)
      : specs;

    // Nếu sau khi parse vẫn là string thì hiển thị như text
    if (typeof parsed === "string") {
      return <span style={{ whiteSpace: "pre-line" }}>{parsed}</span>;
    }

    const entries = flattenEntries(parsed);
    if (!entries.length) return "Chưa có thông số.";

    return (
      <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
        {entries.map(([k, v], idx) => (
          <li key={idx}>
            <b>{String(k).replace(/\.$/, "")}</b>: {String(v)}
          </li>
        ))}
      </ul>
    );
  } catch {
    // Không parse được => hiển thị thuần
    return <span style={{ whiteSpace: "pre-line" }}>{String(specs)}</span>;
  }
};

export default function DeviceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [qty, setQty] = useState(1);
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const raw = await getDeviceModelById(id);
        const nm = normalizeModel(raw);
        // fill brand by brandId if missing
        if (!nm.brand && nm.brandId) {
          try {
            const b = await getBrandById(nm.brandId);
            nm.brand = b?.brandName ?? b?.name ?? nm.brand;
          } catch {
            // Ignore: brand fetch failed, use existing value
          }
        }
        setItem(nm);
      } catch (e) {
        toast.error(e?.response?.data?.message || e?.message || "Không thể tải chi tiết thiết bị.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // Tự động điều chỉnh số lượng khi amountAvailable thay đổi
  useEffect(() => {
    if (item?.amountAvailable !== undefined) {
      const available = item.amountAvailable || 0;
      if (available > 0 && qty > available) {
        setQty(available);
      } else if (available === 0) {
        setQty(1); // Giữ ở 1 nhưng sẽ bị disable
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.amountAvailable]);

  const perDaySubtotal = useMemo(
    () => Math.round((item?.pricePerDay || 0) * qty),
    [item, qty]
  );

  const depositPercent = Number(item?.depositPercent ?? 0);
  const depositAmount = useMemo(() => {
    const value = Number(item?.deviceValue ?? 0);
    return value > 0 && depositPercent > 0 ? Math.round(value * depositPercent) : null;
  }, [item, depositPercent]);

  // Chuẩn hoá mô tả/thông số (nếu BE để specs trong description)
  const displayDesc =
    item?.specifications
      ? (item?.description || "")
      : looksLikeJSON(item?.description)
      ? "" // description là JSON => coi là specs, mô tả để trống
      : (item?.description || "");

  const displaySpecs =
    item?.specifications
      ? item.specifications
      : looksLikeJSON(item?.description)
      ? item.description
      : "";

  const handleAddToCart = async () => {
    if (adding) return;

    // Kiểm tra số lượng còn lại
    const available = item?.amountAvailable || 0;
    if (available === 0) {
      toast.error("Thiết bị không còn đủ để thuê");
      return;
    }
    if (qty > available) {
      toast.error(`Chỉ còn ${available} thiết bị có sẵn. Vui lòng chọn số lượng không quá ${available}.`);
      setQty(available);
      return;
    }

    if (!isAuthenticated) {
      toast((t) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <b>Vui lòng đăng nhập để thêm vào giỏ hàng</b>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => { toast.dismiss(t.id); navigate("/login"); }}
              style={{
                padding: "8px 12px", borderRadius: 8,
                border: "none", background: "#111827",
                color: "#fff", cursor: "pointer", fontWeight: 500,
              }}
            >
              Đăng nhập
            </button>
            <button
              onClick={() => toast.dismiss(t.id)}
              style={{
                padding: "8px 12px", borderRadius: 8,
                border: "1px solid #e5e7eb", background: "#fff",
                color: "#111827", cursor: "pointer", fontWeight: 500,
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
                  padding: "8px 12px", borderRadius: 8,
                  border: "none", background: "#111827",
                  color: "#fff", cursor: "pointer", fontWeight: 500,
                }}
              >
                Xem giỏ hàng
              </button>
              <button
                onClick={() => toast.dismiss(t.id)}
                style={{
                  padding: "8px 12px", borderRadius: 8,
                  border: "1px solid #e5e7eb", background: "#fff",
                  color: "#111827", cursor: "pointer", fontWeight: 500,
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        ), { duration: 2500 });

        try {
          const count = getCartCount();
          window.dispatchEvent(new CustomEvent("cart:updated", { detail: { count } }));
        } catch {
          // Ignore: cart count update failed
        }
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
      <div className="min-h-screen" style={{ backgroundColor: "#F9FAFB" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Skeleton active paragraph={{ rows: 12 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F9FAFB" }}>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Breadcrumb
          items={[
            { title: <a href="/">Trang chủ</a> },
            { title: item.brand || "Thiết bị" },
            { title: item.name },
          ]}
          className="mb-6"
          style={{ fontSize: 16 }}
        />

        <Row gutter={[32, 32]}>
          {/* Gallery trái - Sử dụng Carousel cho hình ảnh */}
          <Col xs={24} lg={14}>
            <Card bordered={false} className="rounded-2xl shadow-lg overflow-hidden" bodyStyle={{ padding: 0 }}>
              <Carousel
                arrows
                prevArrow={<LeftOutlined />}
                nextArrow={<RightOutlined />}
                autoplay
                autoplaySpeed={5000}
                dots={{ className: "custom-dots" }}
                className="product-carousel"
              >
                {(item.images?.length ? item.images : [item.image]).map((src, idx) => (
                  <div key={idx} className="carousel-item">
                    <Image
                      src={src || "https://placehold.co/1200x900?text=No+Image"}
                      alt={`${item.name} ${idx + 1}`}
                      width="100%"
                      height={500}
                      style={{ objectFit: "cover", borderRadius: "16px 16px 0 0" }}
                      placeholder
                    />
                  </div>
                ))}
              </Carousel>
            </Card>
          </Col>

          {/* Panel phải - Sticky, với shadow mượt hơn */}
          <Col xs={24} lg={10}>
            <Card
              bordered={false}
              className="rounded-2xl shadow-lg"
              style={{ position: "sticky", top: 32, background: "#FFFFFF" }}
              bodyStyle={{ padding: 32 }}
            >
              <div className="mb-6">
                <Title level={2} style={{ marginBottom: 8, fontFamily: "'Inter', sans-serif", color: "#101828", fontWeight: 600 }}>
                  {item.name}
                </Title>
                <Text style={{ color: "#475467", fontSize: 16 }}>
                  Thương hiệu: <b style={{ color: "#101828" }}>{item.brand || "—"}</b>
                </Text>
                <Text style={{ color: "#667085", fontSize: 14, marginTop: 8, display: "block" }}>
                  Số lượng còn lại: <b style={{ color: item.amountAvailable > 0 ? "#52c41a" : "#ff4d4f" }}>
                    {item.amountAvailable || 0}
                  </b> thiết bị
                </Text>
              </div>

              <Divider className="my-6" style={{ borderColor: "#EAECF0" }} />

              {/* Giá / ngày */}
              <div className="mb-4">
                <Text className="block text-base mb-1" style={{ color: "#667085", fontWeight: 500 }}>Giá / ngày</Text>
                <Title level={3} style={{ margin: 0, fontFamily: "'Inter', sans-serif", color: "#101828" }}>
                  {fmtVND(item.pricePerDay)}
                </Title>
              </div>

              {/* Tiền cọc + giải thích theo giá trị máy */}
              {depositAmount !== null && (
                <div className="mb-6">
                  <Text className="block text-base mb-1" style={{ color: "#667085", fontWeight: 500 }}>Tiền cọc</Text>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <Title level={4} style={{ margin: 0, fontFamily: "'Inter', sans-serif", color: "#101828" }}>
                      {fmtVND(depositAmount)}
                    </Title>
                    <Text style={{ color: "#667085" }}>
                      ({Math.round(depositPercent * 100)}%)
                    </Text>
                  </div>
                  {Number(item?.deviceValue || 0) > 0 && (
                    <Text type="secondary" style={{ display: "block", marginTop: 6 }}>
                      Công thức: Giá trị máy {fmtVND(item.deviceValue)} × {Math.round(depositPercent * 100)}% = {fmtVND(depositAmount)}
                    </Text>
                  )}
                </div>
              )}

              {/* Số lượng */}
              <div className="mb-6">
                <Text strong className="block mb-2 text-lg" style={{ color: "#101828", fontWeight: 600 }}>Số lượng</Text>
                <Space.Compact style={{ width: 200 }}>
                  <Button
                    size="large"
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    icon={<MinusOutlined />}
                    style={{ height: 48, width: 48, borderRadius: "12px 0 0 12px", borderColor: "#D0D5DD" }}
                    disabled={adding || (item.amountAvailable || 0) === 0}
                  />
                  <InputNumber
                    min={1}
                    max={item.amountAvailable || 0}
                    value={qty}
                    onChange={(v) => {
                      const max = item.amountAvailable || 0;
                      if (max > 0) {
                        setQty(Math.min(Math.max(1, v || 1), max));
                      }
                    }}
                    style={{ width: 104, height: 48, textAlign: "center", fontSize: 18, borderRadius: 0, borderColor: "#D0D5DD" }}
                    disabled={adding || (item.amountAvailable || 0) === 0}
                  />
                  <Button
                    size="large"
                    onClick={() => {
                      const max = item.amountAvailable || 0;
                      setQty((q) => Math.min(q + 1, max));
                    }}
                    icon={<PlusOutlined />}
                    style={{ height: 48, width: 48, borderRadius: "0 12px 12px 0", borderColor: "#D0D5DD" }}
                    disabled={adding || (item.amountAvailable || 0) === 0 || qty >= (item.amountAvailable || 0)}
                  />
                </Space.Compact>
                {(item.amountAvailable || 0) === 0 && (
                  <Text type="danger" style={{ display: "block", marginTop: 8, fontSize: 13 }}>
                     Thiết bị đã hết hàng
                  </Text>
                )}
                {(item.amountAvailable || 0) > 0 && qty > (item.amountAvailable || 0) && (
                  <Text type="warning" style={{ display: "block", marginTop: 8, fontSize: 13 }}>
                     Chỉ còn {item.amountAvailable} thiết bị
                  </Text>
                )}
              </div>

              {/* Thêm giỏ */}
              <Button
                type="primary"
                size="large"
                icon={<ShoppingCartOutlined />}
                className="w-full btn-primary"
                onClick={handleAddToCart}
                loading={adding}
                disabled={adding || (item.amountAvailable || 0) === 0 || qty > (item.amountAvailable || 0)}
                title={(item.amountAvailable || 0) === 0 ? "Thiết bị không còn đủ để thuê" : ""}
                style={{ 
                  background: (item.amountAvailable || 0) > 0 && qty <= (item.amountAvailable || 0) ? "#101828" : "#ccc", 
                  border: "none", 
                  borderRadius: 12, 
                  height: 52, 
                  fontSize: 16, 
                  fontWeight: 500 
                }}
              >
                {adding ? "Đang thêm..." : (item.amountAvailable || 0) === 0 ? "Hết hàng" : "Thêm vào giỏ"}
              </Button>

              {/* Subtotal */}
              <div className="mt-4 text-center">
                <Text style={{ color: "#667085" }}>Tạm tính / ngày: </Text>
                <Text strong style={{ color: "#101828", fontSize: 16 }}>{fmtVND(perDaySubtotal)}</Text>
              </div>
            </Card>
          </Col>
        </Row>

        {/* Tabs dưới - Với padding lớn hơn */}
        <Row gutter={[32, 32]} className="mt-12">
          <Col xs={24} lg={14}>
            <Card bordered={false} className="rounded-2xl shadow-lg" bodyStyle={{ padding: 32, background: "#FFFFFF" }}>
              <Tabs
                defaultActiveKey="desc"
                size="large"
                items={[
                  {
                    key: "desc",
                    label: "Mô tả",
                    children: (
                      <Paragraph style={{ marginBottom: 0, whiteSpace: "pre-line", fontSize: 16, lineHeight: 1.8, color: "#344054" }}>
                        {displayDesc || "Chưa có mô tả."}
                      </Paragraph>
                    ),
                  },
                  {
                    key: "spec",
                    label: "Thông số",
                    children: (
                      <Paragraph style={{ marginBottom: 0, fontSize: 16, lineHeight: 1.8, color: "#344054" }}>
                        {renderSpecsText(displaySpecs)}
                      </Paragraph>
                    ),
                  },
                ]}
                tabBarStyle={{ marginBottom: 24 }}
              />
            </Card>
          </Col>
        </Row>
      </div>

      {/* Sản phẩm liên quan */}
      {item?.categoryId && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <RelatedCard categoryId={item.categoryId} excludeId={item.id} />
        </div>
      )}

      <style>{`
        .product-carousel .ant-carousel .slick-arrow {
          color: #667085;
          font-size: 24px;
          background: rgba(255, 255, 255, 0.8);
          border-radius: 50%;
          padding: 8px;
          transition: all 0.3s;
        }
        .product-carousel .ant-carousel .slick-arrow:hover {
          color: #101828;
          background: #FFFFFF;
        }
        .product-carousel .ant-carousel .slick-dots li button {
          background: #D0D5DD;
          height: 4px;
          border-radius: 2px;
        }
        .product-carousel .ant-carousel .slick-dots li.slick-active button {
          background: #101828;
        }
        .carousel-item {
          display: flex !important;
          justify-content: center;
          align-items: center;
          height: 500px;
          overflow: hidden;
        }
        .btn-primary:hover, .btn-primary:focus {
          background: #0A1120 !important;
        }
        .ant-tabs-tab-btn {
          color: #667085 !important;
          font-weight: 500;
          font-size: 16px;
        }
        .ant-tabs-tab.ant-tabs-tab-active .ant-tabs-tab-btn {
          color: #101828 !important;
          font-weight: 600;
        }
        .ant-tabs-ink-bar {
          background: #101828 !important;
        }
        .ant-card {
          transition: box-shadow 0.3s;
        }
        .ant-card:hover {
          box-shadow: 0 4px 20px rgba(16, 24, 40, 0.1) !important;
        }
      `}</style>
    </div>
  );
}