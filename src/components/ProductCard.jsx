import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Skeleton, Empty, message } from "antd";
import { getDeviceModels, normalizeModel, fmtVND } from "../lib/deviceModelsApi";

export default function ProductCard() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const list = await getDeviceModels();
        setItems(list.map(normalizeModel));
      } catch (e) {
        setErr(e?.response?.data?.message || e?.message || "Không thể tải danh sách thiết bị.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const goDetail = (id) => navigate(`/devices/${id}`);

  if (loading) {
    return (
      <div style={{ padding: 40, maxWidth: 1200, margin: "0 auto" }}>
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    );
  }

  if (err) {
    message.error(err);
  }

  return (
    <div style={{ padding: "40px 20px", maxWidth: "1200px", margin: "0 auto" }}>
      <h2 style={{ textAlign: "center", marginBottom: 40, color: "#1a1a1a", fontSize: 28, fontWeight: "bold", letterSpacing: 1 }}>
        Sản phẩm
      </h2>

      {items.length === 0 ? (
        <Empty description="Chưa có mẫu thiết bị" />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            columnGap: 20,
            rowGap: 40,
          }}
        >
          {items.map((it) => (
            <div
              key={it.id}
              onClick={() => goDetail(it.id)}
              onKeyDown={(e) => e.key === "Enter" && goDetail(it.id)}
              role="button"
              tabIndex={0}
              style={{
                background: "#fff",
                borderRadius: 8,
                overflow: "hidden",
                boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                transition: "all .3s ease",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                minHeight: 350,
              }}
            >
              <div style={{ height: 200, overflow: "hidden" }}>
                <img
                  alt={it.name}
                  src={it.image || "https://placehold.co/800x600?text=No+Image"}
                  style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform .3s ease" }}
                />
              </div>

              <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: "#333", margin: 0 }}>{it.name}</h3>
                <p style={{ color: "#666", fontSize: 14, margin: 0 }}>Thương hiệu: <b style={{ color: "#111" }}>{it.brand || "—"}</b></p>
              </div>

              <div style={{ padding: "0 16px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 16, fontWeight: "bold", color: "#333" }}>
                  {fmtVND(it.pricePerDay)}/ngày
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
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/devices/${it.id}`);
                  }}
                >
                  Thuê ngay
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        div[role="button"]:hover { transform: translateY(-4px); box-shadow: 0 4px 12px rgba(0,0,0,.1); }
        div[role="button"]:hover img { transform: scale(1.05); }
        div[role="button"]:focus { outline: 2px solid #1890ff; }
        @media (min-width: 1200px) {
          div[style*="grid-template-columns"] { grid-template-columns: repeat(4, 1fr); }
        }
      `}</style>
    </div>
  );
}
