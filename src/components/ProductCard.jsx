// src/components/ProductCard.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Skeleton, Empty } from "antd";
import { ShoppingCartOutlined } from "@ant-design/icons";
import toast from "react-hot-toast"; // <-- chỉ giữ toast API
import { useAuth } from "../context/AuthContext";
import { getDeviceModels, normalizeModel, fmtVND } from "../lib/deviceModelsApi";
import { addToCart, getCartCount } from "../lib/cartUtils";

export default function ProductCard() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  // anti-spam theo item
  const [addingMap, setAddingMap] = useState({}); // { [id]: true }
  const [justAdded, setJustAdded] = useState({}); // { [id]: true } để animate

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const list = await getDeviceModels();
        setItems(list.map(normalizeModel));
      } catch (e) {
        setErr(
          e?.response?.data?.message ||
            e?.message ||
            "Không thể tải danh sách thiết bị."
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (err) toast.error(err);
  }, [err]);

  const goDetail = (id) => navigate(`/devices/${id}`);

  const handleAdd = async (e, it) => {
    e.stopPropagation();

    if (!isAuthenticated) {
      toast((t) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <b>Vui lòng đăng nhập để thêm vào giỏ hàng</b>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => {
                toast.dismiss(t.id);
                navigate("/login");
              }}
              style={{
                padding: "6px 10px",
                borderRadius: 6,
                border: "1px solid #111827",
                background: "#111827",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              Đăng nhập
            </button>
            <button
              onClick={() => toast.dismiss(t.id)}
              style={{
                padding: "6px 10px",
                borderRadius: 6,
                border: "1px solid #e5e7eb",
                background: "#fff",
                color: "#111827",
                cursor: "pointer",
              }}
            >
              Để sau
            </button>
          </div>
        </div>
      ));
      return;
    }

    if (addingMap[it.id]) return;

    try {
      setAddingMap((m) => ({ ...m, [it.id]: true }));
      const result = await addToCart(it.id, 1);

      if (result.success) {
        setJustAdded((s) => ({ ...s, [it.id]: true }));
        setTimeout(() => {
          setJustAdded((s) => {
            const { [it.id]: _, ...rest } = s;
            return rest;
          });
        }, 700);

        toast.success(
          (t) => (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div>
                <b>{it.name}</b> đã thêm vào giỏ •{" "}
                <b>{fmtVND(it.pricePerDay)}/ngày</b>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => {
                    toast.dismiss(t.id);
                    navigate("/cart");
                  }}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 6,
                    border: "1px solid #111827",
                    background: "#111827",
                    color: "#fff",
                    cursor: "pointer",
                  }}
                >
                  Xem giỏ hàng
                </button>
                <button
                  onClick={() => toast.dismiss(t.id)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 6,
                    border: "1px solid #e5e7eb",
                    background: "#fff",
                    color: "#111827",
                    cursor: "pointer",
                  }}
                >
                  Đóng
                </button>
              </div>
            </div>
          ),
          { duration: 2500 }
        );

        // báo cho header cập nhật badge + bump
        try {
          const count = getCartCount();
          window.dispatchEvent(
            new CustomEvent("cart:updated", { detail: { count } })
          );
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

  if (loading) {
    return (
      <div style={{ padding: 40, maxWidth: 1200, margin: "0 auto" }}>
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "40px 20px",
        maxWidth: "1200px",
        margin: "0 auto",
      }}
    >
      <h2
        style={{
          textAlign: "center",
          marginBottom: 40,
          color: "#1a1a1a",
          fontSize: 28,
          fontWeight: "bold",
          letterSpacing: 1,
        }}
      >
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
              data-card
              className={justAdded[it.id] ? "added" : ""}
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
                  loading={!!addingMap[it.id]}
                  disabled={!!addingMap[it.id]}
                  onClick={(e) => handleAdd(e, it)}
                >
                  {addingMap[it.id] ? "Đang thêm..." : "Thuê ngay"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        [data-card]:hover { transform: translateY(-4px); box-shadow: 0 4px 12px rgba(0,0,0,.1); }
        [data-card]:hover img { transform: scale(1.05); }
        [data-card]:focus { outline: 2px solid #1890ff; }
        @media (min-width: 1200px) {
          div[style*="grid-template-columns"] { grid-template-columns: repeat(4, 1fr); }
        }
        /* pulse khi add */
        .added { animation: card-pulse 600ms ease; }
        @keyframes card-pulse {
          0%   { box-shadow: 0 0 0 rgba(17,24,39,0.00); transform: scale(1); }
          40%  { box-shadow: 0 0 0 6px rgba(17,24,39,0.10); transform: scale(1.01); }
          100% { box-shadow: 0 0 0 rgba(17,24,39,0.00); transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
