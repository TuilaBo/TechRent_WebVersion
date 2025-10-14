import React from "react";
import { useNavigate } from "react-router-dom";

const products = [
  {
    id: 1,
    title: "Meta Quest 3",
    description: "Kính VR hiện đại, trải nghiệm nhập vai chân thực.",
    image:
      "https://images.unsplash.com/photo-1588421357574-87938a86fa28?q=80&w=1200&auto=format&fit=crop",
    avatar: "https://via.placeholder.com/40?text=VR",
  },
  {
    id: 2,
    title: "MacBook Pro M3 14”",
    description: "Laptop mạnh mẽ, hiệu năng cao cho công việc sáng tạo.",
    image:
      "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?q=80&w=1200&auto=format&fit=crop",
    avatar: "https://via.placeholder.com/40?text=MB",
  },
  {
    id: 3,
    title: "Sony A7 IV",
    description: "Máy ảnh mirrorless chuyên nghiệp, chất lượng vượt trội.",
    image:
      "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?q=80&w=1200&auto=format&fit=crop",
    avatar: "https://via.placeholder.com/40?text=Cam",
  },
  {
    id: 4,
    title: "DJI Mini 4 Pro",
    description: "Flycam nhỏ gọn, quay phim 4K siêu mượt.",
    image:
      "https://images.unsplash.com/photo-1512820790803-83ca734da794?q=80&w=1200&auto=format&fit=crop",
    avatar: "https://via.placeholder.com/40?text=DJI",
  },
];

export default function ProductCard() {
  const navigate = useNavigate();

  const goDetail = (id) => {
    navigate(`/devices/${id}`);
  };

  return (
    <div style={{ padding: "40px 20px", maxWidth: "1200px", margin: "0 auto" }}>
      <h2 style={{ textAlign: "center", marginBottom: "40px", color: "#1a1a1a", fontSize: "28px", fontWeight: "700", letterSpacing: "1px" }}>
        Sản phẩm nổi bật
      </h2>

      <div className="product-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "20px" }}>
        {products.map((item) => (
          <div
            key={item.id}
            onClick={() => goDetail(item.id)}
            onKeyDown={(e) => e.key === "Enter" && goDetail(item.id)}
            role="button"
            tabIndex={0}
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              overflow: "hidden",
              boxShadow: "0 8px 16px rgba(0, 0, 0, 0.08)",
              transition: "all 0.3s ease",
              cursor: "pointer",
              position: "relative",
            }}
            className="custom-card"
          >
            <div style={{ height: "200px", overflow: "hidden", position: "relative" }}>
              <img
                alt={item.title}
                src={item.image}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  transition: "transform 0.5s ease",
                }}
                className="card-img"
              />
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: "100%",
                  background: "linear-gradient(to top, rgba(0,0,0,0.3), transparent)",
                  opacity: 0,
                  transition: "opacity 0.3s ease",
                }}
                className="overlay"
              />
            </div>
            <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "6px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <img
                  src={item.avatar}
                  alt="avatar"
                  style={{ width: "40px", height: "40px", borderRadius: "50%", border: "1px solid #f0f0f0" }}
                />
                <h3 style={{ fontSize: "16px", fontWeight: "600", color: "#333", margin: 0 }}>
                  {item.title}
                </h3>
              </div>
              <p style={{ color: "#666", fontSize: "13px", lineHeight: "1.4", margin: 0, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                {item.description}
              </p>
            </div>
            <div
              style={{
                position: "absolute",
                bottom: "16px",
                right: "16px",
                display: "flex",
                gap: "12px",
                opacity: 0,
                transition: "opacity 0.3s ease",
              }}
              className="actions"
            >
              <button style={{ background: "none", border: "none", cursor: "pointer", color: "#eb2f96", fontSize: "18px" }}>❤️</button>
              <button style={{ background: "none", border: "none", cursor: "pointer", color: "#1890ff", fontSize: "18px" }}>🛒</button>
              <button style={{ background: "none", border: "none", cursor: "pointer", color: "#52c41a", fontSize: "18px" }}>🔗</button>
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .custom-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 12px 24px rgba(0, 0, 0, 0.12);
        }
        .custom-card:hover .card-img {
          transform: scale(1.08);
        }
        .custom-card:hover .overlay {
          opacity: 1;
        }
        .custom-card:hover .actions {
          opacity: 1;
        }
        .custom-card:focus {
          outline: 2px solid #1890ff;
        }
        @media (min-width: 1200px) {
          .product-grid {
            grid-template-columns: repeat(4, 1fr);
          }
        }
      `}</style>
    </div>
  );
}