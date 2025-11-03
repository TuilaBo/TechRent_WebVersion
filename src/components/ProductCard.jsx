// src/components/ProductCard.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Skeleton, Empty, Tag } from "antd";
import { ShoppingCartOutlined } from "@ant-design/icons";
import toast from "react-hot-toast"; // <-- chỉ giữ toast API
import { useAuth } from "../context/AuthContext";
import { getDeviceModels, normalizeModel, fmtVND } from "../lib/deviceModelsApi";
import { getBrandById } from "../lib/deviceManage";
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
        const mapped = list.map(normalizeModel);
        // enrich brand name from brandId if missing
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
        setItems(enriched);
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

    // Kiểm tra số lượng còn lại
    const available = it.amountAvailable || 0;
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
        } catch {
          // ignore
        }
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
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: 20,
          }}
        >
          {([...items]
            .sort((a, b) => {
              const avA = Number(a?.amountAvailable || 0) > 0 ? 1 : 0;
              const avB = Number(b?.amountAvailable || 0) > 0 ? 1 : 0;
              return avB - avA; // còn hàng trước, hết hàng sau
            }))
            .map((it) => (
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
                borderRadius: 12,
                overflow: "hidden",
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                transition: "all .25s cubic-bezier(0.4, 0, 0.2, 1)",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                minHeight: 340,
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
                {((it.amountAvailable || 0) === 0) && (
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
                {((it.amountAvailable || 0) === 1) && (
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
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                  <span style={{ fontSize: 13, color: "#888", fontWeight: 500 }}>Còn lại:</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: (it.amountAvailable || 0) > 1 ? "#52c41a" : (it.amountAvailable || 0) > 0 ? "#faad14" : "#ff4d4f" }}>
                    {it.amountAvailable || 0}
                  </span>
                </div>
              </div>

              <div
                style={{
                  padding: "0 14px 14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
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
                    background: (it.amountAvailable || 0) > 0 ? "#000" : "#d9d9d9",
                    borderColor: (it.amountAvailable || 0) > 0 ? "#000" : "#d9d9d9",
                    color: "#fff", 
                    borderRadius: 10,
                    fontWeight: 700,
                    fontSize: 13,
                    height: 40,
                    padding: "0 16px",
                    boxShadow: (it.amountAvailable || 0) > 0 ? "0 2px 8px rgba(0,0,0,0.15)" : "none",
                  }}
                  icon={<ShoppingCartOutlined />}
                  loading={!!addingMap[it.id]}
                  disabled={!!addingMap[it.id] || (it.amountAvailable || 0) === 0}
                  title={(it.amountAvailable || 0) === 0 ? "Thiết bị không còn đủ để thuê" : ""}
                  onClick={(e) => handleAdd(e, it)}
                >
                  {addingMap[it.id] ? "Đang thêm" : "Thuê ngay"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        [data-card]:hover { 
          transform: translateY(-6px); 
          box-shadow: 0 8px 24px rgba(0,0,0,0.12); 
          border-color: rgba(0,0,0,0.1);
        }
        [data-card]:hover img { transform: scale(1.08); }
        [data-card]:focus { outline: 2px solid #000; outline-offset: 2px; }
        [data-card]:active { transform: translateY(-2px); }

        /* pulse khi add */
        .added { animation: card-pulse 700ms cubic-bezier(0.4, 0, 0.2, 1); }
        @keyframes card-pulse {
          0%   { box-shadow: 0 0 0 0 rgba(0,0,0,0); transform: scale(1); }
          50%  { box-shadow: 0 0 0 8px rgba(0,0,0,0.1); transform: scale(1.02); }
          100% { box-shadow: 0 0 0 0 rgba(0,0,0,0); transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
