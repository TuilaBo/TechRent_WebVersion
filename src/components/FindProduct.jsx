import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Input, Skeleton, Empty, Button } from "antd";
import { SearchOutlined, ShoppingCartOutlined } from "@ant-design/icons";
import toast from "react-hot-toast";
import { searchDeviceModels, normalizeModel, fmtVND } from "../lib/deviceModelsApi";
import { getBrandById } from "../lib/deviceManage";
import { addToCart, getCartCount } from "../lib/cartUtils";
import { useAuth } from "../context/AuthContext";

export default function FindProduct() {
  const navigate = useNavigate();
  const { search } = useLocation();
  const urlQ = new URLSearchParams(search).get("q") || "";

  const [query, setQuery] = useState(urlQ);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const { isAuthenticated } = useAuth();
  const [addingMap, setAddingMap] = useState({});

  const fetchSearch = async (q) => {
    const keyword = (q || "").trim();
    if (!keyword) {
      setItems([]);
      return;
    }
    try {
      setLoading(true);
      const res = await searchDeviceModels({ deviceName: keyword, page: 0, size: 40, isActive: true });
      const mapped = (res || []).map(normalizeModel);
      const enriched = await Promise.all(
        mapped.map(async (it) => {
          if (!it.brand && it.brandId) {
            try {
              const b = await getBrandById(it.brandId);
              return { ...it, brand: b?.brandName ?? b?.name ?? it.brand };
            } catch { return it; }
          }
          return it;
        })
      );
      // Fallback filter client-side nếu BE không lọc theo tên
      const filtered = enriched.filter((it) =>
        String(it.name).toLowerCase().includes(keyword.toLowerCase())
      );
      setItems(filtered.length || !enriched.length ? filtered : enriched);
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Không thể tìm kiếm");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSearch(urlQ);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlQ]);

  const submit = (e) => {
    e.preventDefault();
    navigate(`/search?q=${encodeURIComponent(query || "")}`);
  };

  const handleAdd = async (e, it) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      toast("Vui lòng đăng nhập để thêm vào giỏ hàng");
      return;
    }
    if (addingMap[it.id]) return;
    try {
      setAddingMap((m) => ({ ...m, [it.id]: true }));
      const result = await addToCart(it.id, 1);
      if (result.success) {
        toast.success(`${it.name} đã thêm vào giỏ`);
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
      setAddingMap((m) => ({ ...m, [it.id]: false }));
    }
  };

  return (
    <div style={{ background: "#F9FAFB" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" style={{ paddingTop: 24, paddingBottom: 24 }}>
        <form onSubmit={submit} style={{ display: 'flex', gap: 12, justifyContent: 'center', margin: '12px 0 24px' }}>
          <Input
            size="large"
            value={query}
            onChange={(e)=> setQuery(e.target.value)}
            placeholder="Tìm theo tên sản phẩm (VD: iPhone, Dell, Xbox)"
            prefix={<SearchOutlined />}
            style={{ maxWidth: 520, borderRadius: 50, border: "2px solid #e5e7eb", padding: '8px 18px', background: '#fff', fontWeight: 600 }}
            allowClear
          />
          <Button type="primary" htmlType="submit" size="large" style={{ borderRadius: 50, background: '#000', border: 'none', fontWeight: 700 }}>Tìm kiếm</Button>
        </form>

        {loading ? (
          <Skeleton active paragraph={{ rows: 10 }} />
        ) : items.length === 0 ? (
          <Empty description="Không tìm thấy sản phẩm phù hợp" />
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 280px))",
              gap: 16,
              justifyContent: "center",
              maxWidth: 960,
              margin: "0 auto",
            }}
          >
            {items.map((it) => (
              <div
                key={it.id}
                onClick={() => navigate(`/devices/${it.id}`)}
                role="button"
                tabIndex={0}
                data-card
                style={{
                  maxWidth: 280,
                  width: "100%",
                  background: "#fff",
                  borderRadius: 10,
                  overflow: "hidden",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                  transition: "all .3s ease",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  margin: "0 auto",
                  minHeight: 320,
                }}
              >
                <div style={{ height: 160, overflow: "hidden" }}>
                  <img
                    alt={it.name}
                    src={it.image || "https://placehold.co/800x600?text=No+Image"}
                    style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform .3s ease" }}
                  />
                </div>

                <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#111', wordBreak: 'break-word' }}>{it.name}</div>
                  <div style={{ color: '#555' }}>Thương hiệu: <b style={{ color: '#111' }}>{it.brand || '—'}</b></div>
                </div>

                <div style={{ padding: '0 14px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 16, fontWeight: 700 }}>{fmtVND(it.pricePerDay)}/ngày</span>
                  <Button
                    icon={<ShoppingCartOutlined />}
                    onClick={(e) => handleAdd(e, it)}
                    loading={!!addingMap[it.id]}
                    disabled={!!addingMap[it.id]}
                    style={{ background: '#000', color: '#fff', border: 'none' }}
                  >
                    Thuê ngay
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        [data-card]:hover { transform: translateY(-4px); box-shadow: 0 6px 16px rgba(0,0,0,.12); }
        [data-card]:hover img { transform: scale(1.05); }
      `}</style>
    </div>
  );
}
