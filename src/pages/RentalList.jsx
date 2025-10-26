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
} from "antd";
import {
  AppstoreOutlined,
  BarsOutlined,
  ShoppingCartOutlined,
} from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import toast, { Toaster } from "react-hot-toast";
import { useAuth } from "../context/AuthContext"; // <-- thêm
import { fetchCategoryById } from "../lib/categoryApi";
import { getDeviceModels } from "../lib/deviceModelsApi";
import { addToCart, getCartCount } from "../lib/cartUtils"; // <-- thêm

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
  const { isAuthenticated } = useAuth(); // <-- thêm

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [category, setCategory] = useState(null);
  const [models, setModels] = useState([]);

  // anti-spam theo item id
  const [addingMap, setAddingMap] = useState({}); // { [id]: boolean }
  const [justAdded, setJustAdded] = useState({}); // hiệu ứng pulse card

  // Filters
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
        // lấy tất cả rồi lọc FE theo categoryId
        const all = await getDeviceModels();
        const list = (Array.isArray(all) ? all : []).filter(
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
    return filtered.slice(start, start + pageSize);
  }, [filtered, page]);

  const formatMoney = (n) =>
    Number(n || 0).toLocaleString("vi-VN", { style: "currency", currency: "VND" });

  // Thêm vào giỏ với chặn spam + yêu cầu đăng nhập + toast 2 nút
  const onAdd = async (e, item) => {
    e.stopPropagation();
    const id = item.deviceModelId ?? item.id;
    if (addingMap[id]) return;

    if (!isAuthenticated) {
      toast((t) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <b>Vui lòng đăng nhập để thêm vào giỏ hàng</b>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => { toast.dismiss(t.id); navigate("/login"); }}
              style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #111827", background: "#111827", color: "#fff", cursor: "pointer" }}
            >
              Đăng nhập
            </button>
            <button
              onClick={() => toast.dismiss(t.id)}
              style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #e5e7eb", background: "#fff", color: "#111827", cursor: "pointer" }}
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
        // hiệu ứng pulse card
        setJustAdded((s) => ({ ...s, [id]: true }));
        setTimeout(() => {
          setJustAdded((s) => {
            const { [id]: _, ...rest } = s;
            return rest;
          });
        }, 700);

        // toast + 2 lựa chọn
        const name = item.deviceName ?? item.name ?? "Thiết bị";
        const price = item.pricePerDay ?? item.dailyPrice ?? 0;
        toast.success((t) => (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div><b>{name}</b> đã thêm vào giỏ • <b>{formatMoney(price)}/ngày</b></div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => { toast.dismiss(t.id); navigate("/cart"); }}
                style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #111827", background: "#111827", color: "#fff", cursor: "pointer" }}
              >
                Xem giỏ hàng
              </button>
              <button
                onClick={() => { toast.dismiss(t.id); navigate(`/devices/${id}`); }}
                style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #e5e7eb", background: "#fff", color: "#111827", cursor: "pointer" }}
              >
                Xem chi tiết
              </button>
            </div>
          </div>
        ), { duration: 2500 });

        // cho header biết để bump badge
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
      setAddingMap((m) => ({ ...m, [id]: false }));
    }
  };

  // Card Grid
  const GridCard = ({ item }) => {
    const id = item.deviceModelId ?? item.id;
    const price = item.pricePerDay ?? item.dailyPrice ?? 0;
    const name = item.deviceName ?? item.name ?? "Thiết bị";
    const brand = item.brand ?? item.manufacturer ?? "";
    const image = item.imageURL ?? item.imageUrl ?? item.image ?? "";

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
          maxWidth: 300,
          background: "#fff",
          borderRadius: 8,
          overflow: "hidden",
          boxShadow: "0 2px 8px rgba(0,0,0,.05)",
          transition: "all .3s ease",
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          minHeight: 350,
          margin: "0 auto",
        }}
      >
        <div style={{ height: 200, overflow: "hidden" }}>
          <img
            alt={name}
            src={image || "https://placehold.co/800x600?text=No+Image"}
            style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform .3s ease" }}
          />
        </div>

        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: "#333", margin: 0 }}>{name}</h3>
          <p style={{ color: "#666", fontSize: 14, margin: 0 }}>{brand}</p>
        </div>

        <div style={{ padding: "0 16px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 16, fontWeight: "bold", color: "#333" }}>
            {formatMoney(price)}/ngày
          </span>
          <Button
            style={{ background: "#000", color: "#fff", border: "none", borderRadius: 4, padding: "8px 16px" }}
            icon={<ShoppingCartOutlined />}
            loading={!!addingMap[id]}
            disabled={!!addingMap[id]}
            onClick={(e) => onAdd(e, item)}
          >
            {addingMap[id] ? "Đang thêm..." : "Thuê ngay"}
          </Button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Skeleton active paragraph={{ rows: 10 }} />
        <Toaster position="top-right" />
      </div>
    );
  }
  if (err) {
    return (
      <div className="max-w-7xl mx_auto px-4 sm:px-6 lg:px-8 py-6">
        <Alert type="error" message={err} showIcon />
        <Toaster position="top-right" />
      </div>
    );
  }

  const title = category?.name ?? category?.categoryName ?? "Danh mục";

  return (
    <div className="min-h-screen" style={{ background: "#FAFAFA" }}>
      {/* Toaster — bạn bảo cứ để trong component, nên mình để ở đây */}
      <Toaster position="top-right" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Row gutter={[24, 24]}>
          {/* Sidebar */}
          <Col xs={24} md={8} lg={6} xl={5}>
            <Card bordered bodyStyle={{ padding: 16 }} style={{ borderColor: "#E5E7EB", background: "#fff" }}>
              <Title level={5} style={{ marginTop: 0 }}>Bộ lọc</Title>

              <div>
                <Text strong>GIÁ SẢN PHẨM –</Text>
                <div style={{ marginTop: 8 }}>
                  <Radio.Group value={priceKey} onChange={(e) => { setPriceKey(e.target.value); setPage(1); }}>
                    <Space direction="vertical">
                      {PRICE_BUCKETS.map((b) => <Radio key={b.key} value={b.key}>{b.label}</Radio>)}
                    </Space>
                  </Radio.Group>
                </div>
              </div>

              <Divider />

              <div>
                <Text strong>Brand</Text>
                <div style={{ marginTop: 8 }}>
                  <Checkbox.Group
                    value={selectedBrands}
                    onChange={(vals) => { setSelectedBrands(vals || []); setPage(1); }}
                  >
                    <Space direction="vertical">
                      {BRANDS.map((b) => <Checkbox key={b} value={b}>{b}</Checkbox>)}
                    </Space>
                  </Checkbox.Group>
                </div>
              </div>

              <Divider />

              <Space direction="vertical" style={{ width: "100%" }}>
                <Button type="primary" block style={{ background: "#111827", borderColor: "#111827" }} onClick={() => setPage(1)}>
                  Áp dụng
                </Button>
                <Button block onClick={() => { setSelectedBrands([]); setPriceKey(null); setPage(1); }}>
                  Xoá tất cả
                </Button>
              </Space>
            </Card>
          </Col>

          {/* Content */}
          <Col xs={24} md={16} lg={18} xl={19}>
            <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, padding: 12, marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Title level={4} style={{ margin: 0 }}>{title}</Title>
                <Space>
                  <Badge count={filtered.length} color="#111827" />
                  <Radio.Group value={layout} onChange={(e) => setLayout(e.target.value)} optionType="button">
                    <Tooltip title="Lưới"><Radio.Button value="grid"><AppstoreOutlined /></Radio.Button></Tooltip>
                    <Tooltip title="Danh sách"><Radio.Button value="list"><BarsOutlined /></Radio.Button></Tooltip>
                  </Radio.Group>
                </Space>
              </div>
            </div>

            {/* Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                gap: 20,
                justifyItems: "center",
              }}
            >
              {paged.map((item) => <GridCard key={item.deviceModelId ?? item.id} item={item} />)}
            </div>

            <style>{`
              [data-card]:hover { transform: translateY(-4px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
              [data-card]:hover img { transform: scale(1.05); }
              [data-card]:focus { outline: 2px solid #1890ff; }

              /* pulse khi add */
              .added { animation: card-pulse 600ms ease; }
              @keyframes card-pulse {
                0%   { box-shadow: 0 0 0 rgba(17,24,39,0.00); transform: scale(1); }
                40%  { box-shadow: 0 0 0 6px rgba(17,24,39,0.10); transform: scale(1.01); }
                100% { box-shadow: 0 0 0 rgba(17,24,39,0.00); transform: scale(1); }
              }
            `}</style>

            <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
              <Pagination current={page} onChange={setPage} total={filtered.length} pageSize={pageSize} showSizeChanger={false} />
            </div>
          </Col>
        </Row>
      </div>
    </div>
  );
}
