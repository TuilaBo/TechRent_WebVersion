import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Skeleton, Empty, Tag } from "antd";
import { ShoppingCartOutlined } from "@ant-design/icons";
import { getDeviceModels, normalizeModel, fmtVND } from "../lib/deviceModelsApi";
import { getBrandById } from "../lib/deviceManage";

export default function RelatedCard({ categoryId, excludeId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!categoryId) {
      setItems([]);
      setLoading(false);
      return;
    }
    (async () => {
      try {
        setLoading(true);
        const all = await getDeviceModels();
        const mapped = all.map(normalizeModel);
        // enrich brand name if missing
        const enriched = await Promise.all(
          mapped.map(async (it) => {
            if (!it.brand && it.brandId) {
              try {
                const b = await getBrandById(it.brandId);
                const name = b?.brandName ?? b?.name ?? "";
                return { ...it, brand: name };
              } catch {
                return it;
              }
            }
            return it;
          })
        );
        const filtered = enriched.filter(
          (it) => String(it.categoryId) === String(categoryId) && String(it.id) !== String(excludeId)
        );
        setItems(filtered);
      } catch (e) {
        setErr(e?.response?.data?.message || e?.message || "Không thể tải danh sách sản phẩm liên quan");
      } finally {
        setLoading(false);
      }
    })();
  }, [categoryId, excludeId]);

  if (loading) {
    return (
      <div style={{ padding: 40, maxWidth: 1120, margin: "0 auto" }}>
        <Skeleton active paragraph={{ rows: 4 }} />
      </div>
    );
  }
  if (err) {
    return <Empty description={err} />;
  }
  if (!items.length) {
    return <Empty description="Không có sản phẩm liên quan" />;
  }

  return (
    <div style={{ padding: "36px 0 16px", maxWidth: 1200, margin: "0 auto" }}>
      <h2
        style={{
          textAlign: "center",
          marginBottom: 32,
          color: "#1a1a1a",
          fontSize: 24,
          fontWeight: "bold",
          letterSpacing: 1,
        }}
      >
        Sản phẩm liên quan
      </h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(auto-fill, minmax(240px, 1fr))`,
          gap: 20,
          justifyContent: items.length < 4 ? "center" : "flex-start",
          maxWidth: 1120,
          margin: "0 auto",
        }}
      >
        {items.slice(0, 4).map((it) => (
          <div
            key={it.id}
            onClick={() => navigate(`/devices/${it.id}`)}
            onKeyDown={(e) => e.key === "Enter" && navigate(`/devices/${it.id}`)}
            role="button"
            tabIndex={0}
            data-card
            style={{
              maxWidth: 280,
              width: "100%",
              background: "#fff",
              borderRadius: 12,
              overflow: "hidden",
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              margin: "0 auto",
              display: "flex",
              flexDirection: "column",
              minHeight: 340,
              cursor: "pointer",
              transition: "all .25s cubic-bezier(0.4, 0, 0.2, 1)",
              border: "1px solid rgba(0,0,0,.05)",
            }}
          >
            <div style={{ position: "relative", height: 180, overflow: "hidden", background: "#f5f5f5" }}>
              <img
                alt={it.name}
                src={it.image || "https://placehold.co/800x600?text=No+Image"}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  transition: "transform .3s ease",
                }}
                />
            </div>
            <div
              style={{
                padding: "12px 14px",
                display: "flex",
                flexDirection: "column",
                gap: 4,
                flex: 1,
              }}
            >
              {it.brand && (
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
                    {it.brand}
                  </Tag>
                </div>
              )}
              <h3
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#1a1a1a",
                  margin: 0,
                  lineHeight: 1.3,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
                >
                  {it.name}
                </h3>
              </div>
            <div
              style={{
                padding: "0 14px 14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 12, color: "#888", fontWeight: 500 }}>Giá thuê</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: "#000", lineHeight: 1.2 }}>
                  {fmtVND(it.pricePerDay)}
                </span>
                <span style={{ fontSize: 11, color: "#999", fontWeight: 500 }}>/ngày</span>
              </div>
              <Button
                type="primary"
                size="middle"
                style={{
                  background: "#000",
                  borderColor: "#000",
                  color: "#fff",
                  borderRadius: 10,
                  fontWeight: 700,
                  fontSize: 13,
                  height: 40,
                  padding: "0 16px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                }}
                icon={<ShoppingCartOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/devices/${it.id}`);
                }}
              >
                Xem chi tiết
              </Button>
            </div>
          </div>
        ))}
      </div>
      <style>{`
        [data-card]:hover { 
          transform: translateY(-6px); 
          box-shadow: 0 8px 24px rgba(0,0,0,0.12); 
          border-color: rgba(0,0,0,0.1);
        }
        [data-card]:hover img { transform: scale(1.08); }
        [data-card]:focus { outline: 2px solid #000; outline-offset: 2px; }
        @media (min-width: 1200px) {
          div[style*="grid-template-columns"] { grid-template-columns: repeat(4, 1fr); }
        }
      `}</style>
    </div>
  );
}
