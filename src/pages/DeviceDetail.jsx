// src/pages/DeviceDetail.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Row, Col, Card, Typography, Breadcrumb, Space, Divider,
  InputNumber, Button, Image, Tabs, Skeleton, Carousel, Tag
} from "antd";
import { 
  ShoppingCartOutlined, MinusOutlined, PlusOutlined, LeftOutlined, 
  RightOutlined, CheckCircleFilled, CloseCircleFilled, FireOutlined,
  SafetyOutlined
} from "@ant-design/icons";
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

const renderSpecsText = (specs) => {
  if (!specs) return "Chưa có thông số.";
  try {
    const parsed = typeof specs === "string" && looksLikeJSON(specs)
      ? JSON.parse(specs)
      : specs;

    if (typeof parsed === "string") {
      return <span style={{ whiteSpace: "pre-line" }}>{parsed}</span>;
    }

    const entries = flattenEntries(parsed);
    if (!entries.length) return "Chưa có thông số.";

    return (
      <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", lineHeight: 1.8 }}>
        {entries.map(([k, v], idx) => (
          <li key={idx} style={{ 
            padding: "10px 16px", 
            background: idx % 2 === 0 ? "#fafafa" : "transparent",
            borderRadius: 6,
            marginBottom: 2,
            transition: "all 0.2s"
          }}
          className="spec-item"
          >
            <span style={{ color: "#666", fontSize: 14, fontWeight: 500 }}>
              {String(k).replace(/\.$/, "")}
            </span>
            <span style={{ float: "right", color: "#111", fontSize: 14, fontWeight: 600 }}>
              {String(v)}
            </span>
          </li>
        ))}
      </ul>
    );
  } catch {
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
        if (!nm.brand && nm.brandId) {
          try {
            const b = await getBrandById(nm.brandId);
            nm.brand = b?.brandName ?? b?.name ?? nm.brand;
          } catch {
            // Ignore
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

  useEffect(() => {
    if (item?.amountAvailable !== undefined) {
      const available = item.amountAvailable || 0;
      if (available > 0 && qty > available) {
        setQty(available);
      } else if (available === 0) {
        setQty(1);
      }
    }
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

  const displayDesc =
    item?.specifications
      ? (item?.description || "")
      : looksLikeJSON(item?.description)
      ? ""
      : (item?.description || "");

  const displaySpecs =
    item?.specifications
      ? item.specifications
      : looksLikeJSON(item?.description)
      ? item.description
      : "";

  const handleAddToCart = async () => {
    if (adding) return;

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
          // Ignore
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
      <div className="min-h-screen" style={{ backgroundColor: "#fafafa" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Skeleton active paragraph={{ rows: 12 }} />
        </div>
      </div>
    );
  }

  const isAvailable = (item.amountAvailable || 0) > 0;
  const isLowStock = isAvailable && item.amountAvailable <= 5;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#fafafa" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Breadcrumb
          items={[
            { title: <a href="/">Trang chủ</a> },
            { title: item.brand || "Thiết bị" },
            { title: item.name },
          ]}
          className="mb-6"
          style={{ fontSize: 15 }}
        />

        <Row gutter={[24, 24]}>
          {/* Gallery */}
          <Col xs={24} lg={14}>
            <Card 
              bordered={false} 
              className="rounded-xl shadow-sm overflow-hidden product-card"
              bodyStyle={{ padding: 0 }}
              style={{ background: "#fff", border: "1px solid #e5e7eb" }}
            >
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
                      height={480}
                      style={{ objectFit: "cover" }}
                      placeholder
                    />
                  </div>
                ))}
              </Carousel>
              
              {isLowStock && (
                <div style={{
                  position: "absolute",
                  top: 16,
                  left: 16,
                  zIndex: 10
                }}>
                  <Tag 
                    icon={<FireOutlined />}
                    color="error"
                    style={{ 
                      fontSize: 13, 
                      padding: "6px 12px",
                      fontWeight: 600
                    }}
                  >
                    Sắp hết hàng
                  </Tag>
                </div>
              )}
            </Card>
          </Col>

          {/* Info Panel */}
          <Col xs={24} lg={10}>
            <Card
              bordered={false}
              className="rounded-xl shadow-sm info-card"
              style={{ 
                position: "sticky", 
                top: 24,
                background: "#fff",
                border: "1px solid #e5e7eb"
              }}
              bodyStyle={{ padding: 28 }}
            >
              <div className="mb-5">
                <Title level={2} style={{ 
                  marginBottom: 8, 
                  fontFamily: "'Inter', sans-serif", 
                  color: "#111",
                  fontWeight: 700,
                  fontSize: 26,
                  lineHeight: 1.3
                }}>
                  {item.name}
                </Title>
                
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <Text style={{ color: "#666", fontSize: 14 }}>Thương hiệu:</Text>
                  <Tag style={{ 
                    fontSize: 13, 
                    padding: "4px 10px",
                    fontWeight: 600,
                    border: "1px solid #e5e7eb",
                    background: "#fafafa"
                  }}>
                    {item.brand || "—"}
                  </Tag>
                </div>

                <div style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  background: isAvailable ? "#f0fdf4" : "#fef2f2",
                  border: `1px solid ${isAvailable ? "#86efac" : "#fecaca"}`,
                  borderRadius: 8
                }}>
                  {isAvailable ? (
                    <CheckCircleFilled style={{ color: "#16a34a", fontSize: 14 }} />
                  ) : (
                    <CloseCircleFilled style={{ color: "#dc2626", fontSize: 14 }} />
                  )}
                  <Text style={{ 
                    color: isAvailable ? "#15803d" : "#991b1b", 
                    fontSize: 13, 
                    fontWeight: 600, 
                    margin: 0 
                  }}>
                    {isAvailable 
                      ? `Còn ${item.amountAvailable} thiết bị` 
                      : "Hết hàng"}
                  </Text>
                </div>
              </div>

              <Divider style={{ margin: "20px 0", borderColor: "#e5e7eb" }} />

              {/* Price */}
              <div className="mb-4">
                <Text className="block mb-2" style={{ 
                  color: "#666", 
                  fontWeight: 500,
                  fontSize: 13,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px"
                }}>
                  Giá thuê / ngày
                </Text>
                <Title level={3} style={{ 
                  margin: 0, 
                  fontFamily: "'Inter', sans-serif",
                  color: "#111",
                  fontWeight: 700,
                  fontSize: 32
                }}>
                  {fmtVND(item.pricePerDay)}
                </Title>
              </div>

              {/* Deposit */}
              {depositAmount !== null && (
                <div className="mb-5" style={{
                  background: "#fffbeb",
                  padding: "14px",
                  borderRadius: 10,
                  border: "1px solid #fde68a"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <SafetyOutlined style={{ color: "#d97706", fontSize: 16 }} />
                    <Text style={{ 
                      color: "#92400e", 
                      fontWeight: 600,
                      fontSize: 13,
                      textTransform: "uppercase",
                      letterSpacing: "0.3px"
                    }}>
                      Tiền cọc
                    </Text>
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                    <Title level={4} style={{ 
                      margin: 0, 
                      color: "#b45309",
                      fontWeight: 700,
                      fontSize: 22
                    }}>
                      {fmtVND(depositAmount)}
                    </Title>
                    <Tag style={{ 
                      fontWeight: 600, 
                      fontSize: 12,
                      background: "#fed7aa",
                      border: "none",
                      color: "#92400e"
                    }}>
                      {Math.round(depositPercent * 100)}%
                    </Tag>
                  </div>
                  {Number(item?.deviceValue || 0) > 0 && (
                    <Text type="secondary" style={{ 
                      display: "block", 
                      marginTop: 6,
                      fontSize: 12,
                      color: "#78716c"
                    }}>
                      Giá trị máy {fmtVND(item.deviceValue)} × {Math.round(depositPercent * 100)}%
                    </Text>
                  )}
                </div>
              )}

              {/* Quantity */}
              <div className="mb-5">
                <Text strong className="block mb-2" style={{ 
                  color: "#111", 
                  fontWeight: 600,
                  fontSize: 14
                }}>
                  Số lượng
                </Text>
                <Space.Compact style={{ width: "100%" }}>
                  <Button
                    size="middle"
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    icon={<MinusOutlined />}
                    style={{ 
                      height: 40, 
                      width: 40, 
                      borderRadius: "8px 0 0 8px",
                      borderColor: "#d1d5db",
                      transition: "all 0.2s"
                    }}
                    className="qty-btn"
                    disabled={adding || !isAvailable}
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
                    style={{ 
                      flex: 1,
                      height: 40, 
                      textAlign: "center", 
                      fontSize: 16,
                      fontWeight: 600,
                      borderRadius: 0,
                      borderColor: "#d1d5db",
                      borderLeft: "none",
                      borderRight: "none"
                    }}
                    disabled={adding || !isAvailable}
                  />
                  <Button
                    size="middle"
                    onClick={() => {
                      const max = item.amountAvailable || 0;
                      setQty((q) => Math.min(q + 1, max));
                    }}
                    icon={<PlusOutlined />}
                    style={{ 
                      height: 40, 
                      width: 40, 
                      borderRadius: "0 8px 8px 0",
                      borderColor: "#d1d5db",
                      transition: "all 0.2s"
                    }}
                    className="qty-btn"
                    disabled={adding || !isAvailable || qty >= (item.amountAvailable || 0)}
                  />
                </Space.Compact>
                {!isAvailable && (
                  <Text type="danger" style={{ 
                    display: "block", 
                    marginTop: 8, 
                    fontSize: 13,
                    fontWeight: 500
                  }}>
                    ⚠️ Thiết bị đã hết hàng
                  </Text>
                )}
              </div>

              {/* Add to cart */}
              <Button
                type="primary"
                size="large"
                icon={adding ? null : <ShoppingCartOutlined style={{ fontSize: 16 }} />}
                className="w-full add-to-cart-btn"
                onClick={handleAddToCart}
                loading={adding}
                disabled={adding || !isAvailable || qty > (item.amountAvailable || 0)}
                style={{ 
                  background: isAvailable && qty <= (item.amountAvailable || 0) ? "#111" : "#d1d5db",
                  border: "none", 
                  borderRadius: 10, 
                  height: 44, 
                  fontSize: 15, 
                  fontWeight: 600,
                  transition: "all 0.2s"
                }}
              >
                {adding ? "Đang thêm..." : !isAvailable ? "Hết hàng" : "Thêm vào giỏ"}
              </Button>

              {/* Subtotal */}
              <div style={{
                marginTop: 16,
                padding: "12px",
                background: "#fafafa",
                borderRadius: 8,
                textAlign: "center",
                border: "1px solid #e5e7eb"
              }}>
                <Text style={{ color: "#666", fontSize: 14 }}>Tạm tính / ngày: </Text>
                <Text strong style={{ 
                  color: "#111", 
                  fontSize: 16,
                  fontWeight: 700
                }}>
                  {fmtVND(perDaySubtotal)}
                </Text>
              </div>
            </Card>
          </Col>
        </Row>

        {/* Tabs */}
        <Row gutter={[24, 24]} className="mt-10">
          <Col xs={24} lg={14}>
            <Card 
              bordered={false} 
              className="rounded-xl shadow-sm"
              bodyStyle={{ padding: 28, background: "#fff" }}
              style={{ border: "1px solid #e5e7eb" }}
            >
              <Tabs
                defaultActiveKey="desc"
                size="large"
                items={[
                  {
                    key: "desc",
                    label: <span style={{ fontSize: 15, fontWeight: 600 }}>Mô tả</span>,
                    children: (
                      <Paragraph style={{ 
                        marginBottom: 0, 
                        whiteSpace: "pre-line", 
                        fontSize: 15, 
                        lineHeight: 1.7, 
                        color: "#374151"
                      }}>
                        {displayDesc || "Chưa có mô tả."}
                      </Paragraph>
                    ),
                  },
                  {
                    key: "spec",
                    label: <span style={{ fontSize: 15, fontWeight: 600 }}>Thông số</span>,
                    children: (
                      <div style={{ marginBottom: 0 }}>
                        {renderSpecsText(displaySpecs)}
                      </div>
                    ),
                  },
                ]}
                tabBarStyle={{ marginBottom: 20 }}
              />
            </Card>
          </Col>
        </Row>
      </div>

      {/* Related products */}
      {item?.categoryId && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <RelatedCard categoryId={item.categoryId} excludeId={item.id} />
        </div>
      )}

      <style>{`
        .product-carousel .ant-carousel .slick-arrow {
          color: #666;
          font-size: 20px;
          background: rgba(255, 255, 255, 0.9);
          border-radius: 50%;
          width: 36px;
          height: 36px;
          display: flex !important;
          align-items: center;
          justify-content: center;
          z-index: 10;
          transition: all 0.2s;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
        .product-carousel .ant-carousel .slick-arrow:hover {
          color: #111;
          background: #fff;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        .product-carousel .ant-carousel .slick-dots {
          bottom: 16px;
        }
        .product-carousel .ant-carousel .slick-dots li button {
          background: rgba(0, 0, 0, 0.2);
          height: 3px;
          border-radius: 2px;
          transition: all 0.3s;
        }
        .product-carousel .ant-carousel .slick-dots li.slick-active button {
          background: #111;
          width: 24px;
        }
        .carousel-item {
          display: flex !important;
          justify-content: center;
          align-items: center;
          height: 480px;
          overflow: hidden;
          background: #fafafa;
        }
        .add-to-cart-btn:hover:not(:disabled) {
          background: #000 !important;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }
        .add-to-cart-btn:active:not(:disabled) {
          transform: translateY(0);
        }
        .qty-btn:hover:not(:disabled) {
          border-color: #111 !important;
          color: #111 !important;
          background: #fafafa !important;
        }
        .ant-tabs-tab {
          padding: 10px 0;
          transition: all 0.2s;
        }
        .ant-tabs-tab-btn {
          color: #666 !important;
          transition: all 0.2s;
        }
        .ant-tabs-tab:hover .ant-tabs-tab-btn {
          color: #111 !important;
        }
        .ant-tabs-tab.ant-tabs-tab-active .ant-tabs-tab-btn {
          color: #111 !important;
          font-weight: 700;
        }
        .ant-tabs-ink-bar {
          background: #111 !important;
          height: 2px !important;
        }
        .product-card, .info-card {
          transition: all 0.2s;
        }
        .product-card:hover {
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08) !important;
        }
        .info-card:hover {
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08) !important;
        }
        .spec-item:hover {
          background: #f3f4f6 !important;
        }
        .ant-input-number:focus,
        .ant-input-number-focused {
          border-color: #111 !important;
          box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.05) !important;
        }
        .ant-breadcrumb a {
          color: #666;
          transition: color 0.2s;
        }
        .ant-breadcrumb a:hover {
          color: #111;
        }
        
        @media (max-width: 768px) {
          .carousel-item {
            height: 300px;
          }
          .product-carousel .ant-carousel .slick-arrow {
            width: 32px;
            height: 32px;
            font-size: 16px;
          }
        }
      `}</style>
    </div>
  );
}