import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Skeleton, Empty } from "antd";
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
          gridTemplateColumns: `repeat(auto-fit, minmax(280px, 1fr))`,
          gap: 24,
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
              borderRadius: 8,
              overflow: "hidden",
              boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
              margin: "0 auto",
              display: "flex",
              flexDirection: "column",
              minHeight: 320,
              cursor: "pointer",
              transition: "all .3s ease",
            }}
          >
            <div style={{ height: 160, overflow: "hidden" }}>
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
                padding: 16,
                display: "flex",
                flexDirection: "column",
                gap: 4,
                flex: 1,
              }}
            >
              <h3
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: "#333",
                  margin: 0,
                  wordBreak: "break-word",
                }}
              >
                {it.name}
              </h3>
              <p style={{ color: "#666", fontSize: 14, margin: 0 }}>
                Thương hiệu: <b style={{ color: "#111" }}>{it.brand || "—"}</b>
              </p>
            </div>
            <div
              style={{
                padding: "0 16px 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span
                style={{ fontSize: 16, fontWeight: "bold", color: "#333" }}
              >
                {fmtVND(it.pricePerDay)}/ngày
              </span>
              <Button
                style={{
                  background: "#000",
                  color: "#fff",
                  border: "none",
                  borderRadius: 4,
                  padding: "8px 16px",
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
        [data-card]:hover { transform: translateY(-4px); box-shadow: 0 4px 12px rgba(0,0,0,.1); }
        [data-card]:hover img { transform: scale(1.05); }
        [data-card]:focus { outline: 2px solid #1890ff; }
        @media (min-width: 1200px) {
          div[style*="grid-template-columns"] { grid-template-columns: repeat(4, 1fr); }
        }
      `}</style>
    </div>
  );
}
