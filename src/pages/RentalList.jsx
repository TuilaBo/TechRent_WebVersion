// src/pages/browse/RentalList.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Row,
  Col,
  Card,
  Typography,
  Checkbox,
  Button,
  Space,
  Divider,
  Radio,
  Tooltip,
  Badge,
  Pagination,
  Skeleton,
  Alert,
  Tag,
} from "antd";
import {
  AppstoreOutlined,
  BarsOutlined,
  ShoppingCartOutlined,
  FilterOutlined,
  ClearOutlined,
} from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { fetchCategoryById } from "../lib/categoryApi";
import { getDeviceModels, normalizeModel } from "../lib/deviceModelsApi";
import { getBrandById } from "../lib/deviceManage";
import { addToCart, getCartCount } from "../lib/cartUtils";

const { Title, Text } = Typography;

const PRICE_BUCKETS = [
  { key: "lt500", label: "Dưới 500,000đ", test: (v) => v < 500000 },
  { key: "500-1m", label: "500,000đ - 1,000,000đ", test: (v) => v >= 500000 && v <= 1000000 },
  { key: "1m-1_5m", label: "1,000,000đ - 1,500,000đ", test: (v) => v > 1000000 && v <= 1500000 },
  { key: "2m-5m", label: "2,000,000đ - 5,000,000đ", test: (v) => v >= 2000000 && v <= 5000000 },
  { key: "gt5m", label: "Trên 5,000,000đ", test: (v) => v > 5000000 },
];

export default function RentalList() {
  const { id: categoryId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [category, setCategory] = useState(null);
  const [models, setModels] = useState([]);

  const [addingMap, setAddingMap] = useState({});
  const [justAdded, setJustAdded] = useState({});

  const [selectedBrands, setSelectedBrands] = useState([]);
  const [priceKey, setPriceKey] = useState(null);
  const [layout, setLayout] = useState("grid");
  const [page, setPage] = useState(1);
  const pageSize = 8;

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      setSelectedBrands([]);
      setPriceKey(null);
      setPage(1);
      try {
        const cat = await fetchCategoryById(categoryId);
        setCategory(cat ?? null);
        const all = await getDeviceModels();
        const normalized = (Array.isArray(all) ? all : []).map(normalizeModel);
        const enriched = await Promise.all(
          normalized.map(async (m) => {
            if (!m.brand && m.brandId) {
              try {
                const b = await getBrandById(m.brandId);
                return { ...m, brand: b?.brandName ?? b?.name ?? "" };
              } catch { return m; }
            }
            return m;
          })
        );
        const list = enriched.filter(
          (m) => String(m.categoryId ?? m.deviceCategoryId ?? m.category?.id) === String(categoryId)
        );
        setModels(list);
      } catch (e) {
        setErr(e?.response?.data?.message || e?.message || "Không tải được sản phẩm.");
      } finally {
        setLoading(false);
      }
    })();
  }, [categoryId]);

  const BRANDS = useMemo(() => {
    const s = new Set(
      models.map((m) => (m.brand || m.manufacturer || "").trim()).filter(Boolean)
    );
    return Array.from(s);
  }, [models]);

  const filtered = useMemo(() => {
    return models.filter((m) => {
      const price = Number(m?.pricePerDay ?? m?.dailyPrice ?? 0);
      const brand = (m.brand || m.manufacturer || "").trim();
      if (selectedBrands.length && !selectedBrands.includes(brand)) return false;
      if (priceKey) {
        const bucket = PRICE_BUCKETS.find((b) => b.key === priceKey);
        if (bucket && !bucket.test(price)) return false;
      }
      return true;
    });
  }, [models, selectedBrands, priceKey]);

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    const sorted = [...filtered].sort((a, b) => {
      const avA = Number(a?.amountAvailable || 0) > 0 ? 1 : 0;
      const avB = Number(b?.amountAvailable || 0) > 0 ? 1 : 0;
      return avB - avA; // còn hàng trước
    });
    return sorted.slice(start, start + pageSize);
  }, [filtered, page]);

  const formatMoney = (n) =>
    Number(n || 0).toLocaleString("vi-VN", { style: "currency", currency: "VND" });

  const onAdd = async (e, item) => {
    e.stopPropagation();
    const id = item.deviceModelId ?? item.id;
    if (addingMap[id]) return;

    const available = item.amountAvailable || 0;
    if (available === 0) {
      toast.error("Thiết bị không còn đủ để thuê");
      return;
    }

    if (!isAuthenticated) {
      toast((t) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <b>Vui lòng đăng nhập để thêm vào giỏ hàng</b>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => { toast.dismiss(t.id); navigate("/login"); }}
              style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#000", color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 14 }}
            >
              Đăng nhập
            </button>
            <button
              onClick={() => toast.dismiss(t.id)}
              style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", color: "#000", cursor: "pointer", fontWeight: 500, fontSize: 14 }}
            >
              Để sau
            </button>
          </div>
        </div>
      ));
      return;
    }

    try {
      setAddingMap((m) => ({ ...m, [id]: true }));
      const result = await addToCart(id, 1);
      if (result.success) {
        setJustAdded((s) => ({ ...s, [id]: true }));
        setTimeout(() => {
          setJustAdded((s) => {
            const { [id]: _, ...rest } = s;
            return rest;
          });
        }, 700);

        const name = item.deviceName ?? item.name ?? "Thiết bị";
        const price = item.pricePerDay ?? item.dailyPrice ?? 0;
        toast.success((t) => (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 14 }}>
              <b>{name}</b> đã thêm vào giỏ • <b>{formatMoney(price)}/ngày</b>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => { toast.dismiss(t.id); navigate("/cart"); }}
                style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#000", color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 14 }}
              >
                Xem giỏ hàng
              </button>
              <button
                onClick={() => { toast.dismiss(t.id); navigate(`/devices/${id}`); }}
                style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", color: "#000", cursor: "pointer", fontWeight: 500, fontSize: 14 }}
              >
                Xem chi tiết
              </button>
            </div>
          </div>
        ), { duration: 3000 });

        try {
          const count = getCartCount();
          window.dispatchEvent(new CustomEvent("cart:updated", { detail: { count } }));
        } catch {
          // ignore
        }
      } else {
        toast.error(result.error || "Không thể thêm vào giỏ hàng");
      }
    } catch {
      toast.error("Có lỗi xảy ra khi thêm vào giỏ hàng");
    } finally {
      setAddingMap((m) => ({ ...m, [id]: false }));
    }
  };

  const GridCard = ({ item }) => {
    const id = item.deviceModelId ?? item.id;
    const price = item.pricePerDay ?? item.dailyPrice ?? 0;
    const name = item.deviceName ?? item.name ?? "Thiết bị";
    const brand = item.brand ?? item.manufacturer ?? "";
    const image = item.imageURL ?? item.imageUrl ?? item.image ?? "";
    const available = item.amountAvailable || 0;

    const gotoDetail = () => navigate(`/devices/${id}`);

    return (
      <div
        data-card
        onClick={gotoDetail}
        onKeyDown={(e) => e.key === "Enter" && gotoDetail()}
        role="button"
        tabIndex={0}
        className={justAdded[id] ? "added" : ""}
        style={{
          width: "100%",
          maxWidth: 320,
          background: "#fff",
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: "0 2px 12px rgba(0,0,0,.06)",
          transition: "all .3s cubic-bezier(0.4, 0, 0.2, 1)",
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          minHeight: 380,
          margin: "0 auto",
          border: "1px solid rgba(0,0,0,.05)",
        }}
      >
        <div style={{ position: "relative", height: 220, overflow: "hidden", background: "#f5f5f5" }}>
          <img
            alt={name}
            src={image || "https://placehold.co/800x600?text=No+Image"}
            style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform .4s ease" }}
          />
          {available === 0 && (
            <div style={{
              position: "absolute",
              top: 12,
              right: 12,
              background: "rgba(255,77,79,0.95)",
              color: "#fff",
              padding: "6px 14px",
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 700,
              backdropFilter: "blur(4px)",
            }}>
              Hết hàng
            </div>
          )}
          {available === 1 && (
            <div style={{
              position: "absolute",
              top: 12,
              right: 12,
              background: "rgba(250,173,20,0.95)",
              color: "#fff",
              padding: "6px 14px",
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 700,
              backdropFilter: "blur(4px)",
            }}>
              Sắp hết
            </div>
          )}
        </div>

        <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
          {brand && (
            <div style={{ marginBottom: 2 }}>
              <Tag 
                style={{ 
                  border: "none", 
                  background: "rgba(0,0,0,0.05)", 
                  color: "#666",
                  fontSize: 11,
                  padding: "2px 10px",
                  borderRadius: 12,
                  fontWeight: 600,
                }}
              >
                {brand}
              </Tag>
            </div>
          )}
          <h3 style={{ 
            fontSize: 17, 
            fontWeight: 700, 
            color: "#1a1a1a", 
            margin: 0,
            lineHeight: 1.3,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}>
            {name}
          </h3>
          <div style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: 6,
            marginTop: 4,
          }}>
            <span style={{ 
              fontSize: 13, 
              color: "#888",
              fontWeight: 500,
            }}>
              Còn lại:
            </span>
            <span style={{ 
              fontSize: 14,
              fontWeight: 700,
              color: available > 1 ? "#52c41a" : available > 0 ? "#faad14" : "#ff4d4f",
            }}>
              {available}
            </span>
          </div>
        </div>

        <div style={{ 
          padding: "0 18px 18px", 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "space-between",
          gap: 12,
        }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 12, color: "#888", fontWeight: 500 }}>Giá thuê</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: "#000", lineHeight: 1.2 }}>
              {formatMoney(price)}
            </span>
            <span style={{ fontSize: 11, color: "#999", fontWeight: 500 }}>/ngày</span>
          </div>
          <Button
            type="primary"
            size="large"
            style={{ 
              background: available > 0 ? "#000" : "#d9d9d9", 
              borderColor: available > 0 ? "#000" : "#d9d9d9",
              color: "#fff", 
              borderRadius: 12,
              fontWeight: 700,
              fontSize: 14,
              height: 44,
              padding: "0 20px",
              boxShadow: available > 0 ? "0 2px 8px rgba(0,0,0,0.15)" : "none",
            }}
            icon={<ShoppingCartOutlined />}
            loading={!!addingMap[id]}
            disabled={!!addingMap[id] || available === 0}
            onClick={(e) => onAdd(e, item)}
          >
            {addingMap[id] ? "Đang thêm" : "Thuê ngay"}
          </Button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Skeleton active paragraph={{ rows: 10 }} />
      </div>
    );
  }
  if (err) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Alert type="error" message={err} showIcon />
      </div>
    );
  }

  const title = category?.name ?? category?.categoryName ?? "Danh mục";

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(180deg, #fafafa 0%, #fff 100%)" }}>
      <style>{`
        [data-card]:hover { 
          transform: translateY(-6px); 
          box-shadow: 0 8px 24px rgba(0,0,0,0.12); 
          border-color: rgba(0,0,0,0.1);
        }
        [data-card]:hover img { transform: scale(1.08); }
        [data-card]:focus { outline: 2px solid #000; outline-offset: 2px; }
        [data-card]:active { transform: translateY(-2px); }

        .added { animation: card-pulse 700ms cubic-bezier(0.4, 0, 0.2, 1); }
        @keyframes card-pulse {
          0%   { box-shadow: 0 0 0 0 rgba(0,0,0,0); transform: scale(1); }
          50%  { box-shadow: 0 0 0 8px rgba(0,0,0,0.1); transform: scale(1.02); }
          100% { box-shadow: 0 0 0 0 rgba(0,0,0,0); transform: scale(1); }
        }

        .filter-card {
          border-radius: 16px !important;
          border: 1px solid rgba(0,0,0,0.06) !important;
          box-shadow: 0 2px 12px rgba(0,0,0,0.04) !important;
        }

        .filter-section {
          padding: 16px 0;
        }

        .ant-radio-wrapper, .ant-checkbox-wrapper {
          font-weight: 500 !important;
          color: #333 !important;
          padding: 8px 0;
          transition: all 0.2s ease;
        }

        .ant-radio-wrapper:hover, .ant-checkbox-wrapper:hover {
          color: #000 !important;
        }

        .header-bar {
          background: #fff;
          border: 1px solid rgba(0,0,0,0.06);
          border-radius: 16px;
          padding: 18px 24px;
          margin-bottom: 24px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.04);
        }

        .filter-btn {
          border-radius: 10px !important;
          font-weight: 600 !important;
          height: 42px !important;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }

        .filter-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
        }

        .ant-pagination-item {
          border-radius: 8px !important;
          font-weight: 600 !important;
        }

        .ant-pagination-item-active {
          background: #000 !important;
          border-color: #000 !important;
        }

        .ant-pagination-item-active a {
          color: #fff !important;
        }
      `}</style>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Row gutter={[24, 24]}>
          {/* Sidebar */}
          <Col xs={24} md={8} lg={6} xl={5}>
            <Card className="filter-card" bodyStyle={{ padding: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                <FilterOutlined style={{ fontSize: 20 }} />
                <Title level={4} style={{ margin: 0, fontWeight: 700 }}>Bộ lọc</Title>
              </div>

              <div className="filter-section">
                <Text strong style={{ fontSize: 15, color: "#1a1a1a", fontWeight: 700 }}>Giá thuê</Text>
                <div style={{ marginTop: 12 }}>
                  <Radio.Group value={priceKey} onChange={(e) => { setPriceKey(e.target.value); setPage(1); }}>
                    <Space direction="vertical" style={{ width: "100%" }}>
                      {PRICE_BUCKETS.map((b) => <Radio key={b.key} value={b.key}>{b.label}</Radio>)}
                    </Space>
                  </Radio.Group>
                </div>
              </div>

              <Divider style={{ margin: "20px 0" }} />

              <div className="filter-section">
                <Text strong style={{ fontSize: 15, color: "#1a1a1a", fontWeight: 700 }}>Thương hiệu</Text>
                <div style={{ marginTop: 12 }}>
                  <Checkbox.Group
                    value={selectedBrands}
                    onChange={(vals) => { setSelectedBrands(vals || []); setPage(1); }}
                  >
                    <Space direction="vertical" style={{ width: "100%" }}>
                      {BRANDS.map((b) => <Checkbox key={b} value={b}>{b}</Checkbox>)}
                    </Space>
                  </Checkbox.Group>
                </div>
              </div>

              <Divider style={{ margin: "20px 0" }} />

              <Space direction="vertical" style={{ width: "100%", gap: 10 }}>
                <Button 
                  type="primary" 
                  block 
                  className="filter-btn"
                  style={{ background: "#000", borderColor: "#000" }} 
                  onClick={() => setPage(1)}
                >
                  Áp dụng bộ lọc
                </Button>
                <Button 
                  block 
                  className="filter-btn"
                  icon={<ClearOutlined />}
                  onClick={() => { setSelectedBrands([]); setPriceKey(null); setPage(1); }}
                >
                  Xóa bộ lọc
                </Button>
              </Space>
            </Card>
          </Col>

          {/* Content */}
          <Col xs={24} md={16} lg={18} xl={19}>
            <div className="header-bar">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
                <div>
                  <Title level={3} style={{ margin: 0, fontWeight: 800 }}>{title}</Title>
                  <Text style={{ color: "#666", fontSize: 14, fontWeight: 500 }}>
                    {filtered.length} sản phẩm
                  </Text>
                </div>
                <Space size={12}>
                  <Badge 
                    count={filtered.length} 
                    style={{ 
                      background: "#000", 
                      fontWeight: 700,
                      fontSize: 13,
                      padding: "0 10px",
                      height: 24,
                      lineHeight: "24px",
                    }} 
                  />
                  <Radio.Group 
                    value={layout} 
                    onChange={(e) => setLayout(e.target.value)} 
                    optionType="button"
                    buttonStyle="solid"
                  >
                    <Tooltip title="Lưới">
                      <Radio.Button value="grid"><AppstoreOutlined /></Radio.Button>
                    </Tooltip>
                    <Tooltip title="Danh sách">
                      <Radio.Button value="list"><BarsOutlined /></Radio.Button>
                    </Tooltip>
                  </Radio.Group>
                </Space>
              </div>
            </div>

            {paged.length === 0 ? (
              <div style={{ 
                textAlign: "center", 
                padding: "60px 20px",
                background: "#fff",
                borderRadius: 16,
                border: "1px solid rgba(0,0,0,0.06)",
              }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
                <Title level={4} style={{ color: "#666" }}>Không tìm thấy sản phẩm nào</Title>
                <Text style={{ color: "#999" }}>Thử điều chỉnh bộ lọc của bạn</Text>
              </div>
            ) : (
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                    gap: 24,
                    justifyItems: "center",
                  }}
                >
                  {paged.map((item) => <GridCard key={item.deviceModelId ?? item.id} item={item} />)}
                </div>

                <div style={{ display: "flex", justifyContent: "center", marginTop: 32 }}>
                  <Pagination 
                    current={page} 
                    onChange={setPage} 
                    total={filtered.length} 
                    pageSize={pageSize} 
                    showSizeChanger={false}
                    showTotal={(total, range) => `${range[0]}-${range[1]} của ${total} sản phẩm`}
                  />
                </div>
              </>
            )}
          </Col>
        </Row>
      </div>
    </div>
  );
}