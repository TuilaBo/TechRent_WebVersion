import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "antd";

const products = [
  {
    id: 1,
    title: "Iphone 17 pro Max",
    description: "Điện thoại thông minh cao cấp",
    image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSGX5_nAiWtKQQi5VHbZEIrYLaaW3TiPmACjPYrR84b9Er418SGn44O8PA3cYWle0YakzE&usqp=CAU",
    price: "1.185.300đ/ngày",
  },
  {
    id: 2,
    title: "MacBook Pro M3",
    description: "Laptop hiệu suất cao",
    image: "https://cdn.tgdd.vn/Products/Images/44/318232/apple-macbook-pro-14-inch-m3-max-2023-14-core-acv-3.jpg",
    price: "1.712.100đ/ngày",
  },
  {
    id: 3,
    title: "Canon EOS R5",
    description: "Máy ảnh không gương lật chuyên nghiệp",
    image: "https://legacy-photolab.com/cdn/shop/files/IMG_7927_4b780e65-9b6c-4ede-a5b7-285e5903fe37_525x700.jpg?v=1728587942",
    price: "2.238.900đ/ngày",
  },
  {
    id: 4,
    title: "MacBook Air M1",
    description: "Laptop nhẹ và mạnh mẽ",
    image: "https://store.storeimages.cdn-apple.com/1/as-images.apple.com/is/refurb-macbook-air-space-gray-m1-202010?wid=1144&hei=1144&fmt=jpeg&qlt=90&.v=QkJpMElmU3Z2QTUxaWlZMkpyNUtsajJlUGc5WVpDMG1aRjJJVUhBeHVCSDdnbkFtTmt3K2tyekExa1pvMEU3QVlsNGdDd3FRbHFCcnpRZnZlZVVZRkxRUEREajRYYzZXa3RBN2paL1ZDMng5LzVJdWdVYnR2S2krc25NZlhjcHE",
    price: "1.975.500đ/ngày",
  },
  {
    id: 5,
    title: "MacBook Air M1",
    description: "Laptop nhẹ và mạnh mẽ",
    image: "https://store.storeimages.cdn-apple.com/1/as-images.apple.com/is/refurb-macbook-air-space-gray-m1-202010?wid=1144&hei=1144&fmt=jpeg&qlt=90&.v=QkJpMElmU3Z2QTUxaWlZMkpyNUtsajJlUGc5WVpDMG1aRjJJVUhBeHVCSDdnbkFtTmt3K2tyekExa1pvMEU3QVlsNGdDd3FRbHFCcnpRZnZlZVVZRkxRUEREajRYYzZXa3RBN2paL1ZDMng5LzVJdWdVYnR2S2krc25NZlhjcHE",
    price: "1.975.500đ/ngày",
  },
  {
    id: 6,
    title: "Canon EOS R5",
    description: "Máy ảnh không gương lật chuyên nghiệp",
    image: "https://legacy-photolab.com/cdn/shop/files/IMG_7927_4b780e65-9b6c-4ede-a5b7-285e5903fe37_525x700.jpg?v=1728587942",
    price: "2.238.900đ/ngày",
  },
  {
    id: 7,
    title: "Iphone 17 pro Max",
    description: "Điện thoại thông minh cao cấp",
    image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSGX5_nAiWtKQQi5VHbZEIrYLaaW3TiPmACjPYrR84b9Er418SGn44O8PA3cYWle0YakzE&usqp=CAU",
    price: "1.185.300đ/ngày",
  },
  {
    id: 8,
    title: "Iphone 17 pro Max",
    description: "Điện thoại thông minh cao cấp",
    image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSGX5_nAiWtKQQi5VHbZEIrYLaaW3TiPmACjPYrR84b9Er418SGn44O8PA3cYWle0YakzE&usqp=CAU",
    price: "1.185.300đ/ngày",
  },
];

export default function ProductCard() {
  const navigate = useNavigate();

  const goDetail = (id) => {
    navigate(`/devices/${id}`);
  };

  return (
    <div style={{ padding: "40px 20px", maxWidth: "1200px", margin: "0 auto" }}>
      <h2
        style={{
          textAlign: "center",
          marginBottom: "40px",
          color: "#1a1a1a",
          fontSize: "28px",
          fontWeight: "bold",
          letterSpacing: "1px",
        }}
      >
        Sản phẩm
      </h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          columnGap: "20px",
          rowGap: "40px", // Tăng khoảng cách giữa các hàng lên 40px
        }}
      >
        {products.map((item) => (
          <div
            key={item.id}
            onClick={() => goDetail(item.id)}
            onKeyDown={(e) => e.key === "Enter" && goDetail(item.id)}
            role="button"
            tabIndex={0}
            style={{
              background: "#ffffff",
              borderRadius: "8px",
              overflow: "hidden",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.05)",
              transition: "all 0.3s ease",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              minHeight: "350px", // Tăng chiều cao tối thiểu của card lên 350px
            }}
          >
            <div style={{ height: "200px", overflow: "hidden" }}> {/* Tăng chiều cao hình ảnh lên 200px */}
              <img
                alt={item.title}
                src={item.image}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  transition: "transform 0.3s ease",
                }}
              />
            </div>
            <div
              style={{
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                flex: 1,
              }}
            >
              <h3
                style={{
                  fontSize: "16px",
                  fontWeight: "600",
                  color: "#333",
                  margin: 0,
                }}
              >
                {item.title}
              </h3>
              <p
                style={{
                  color: "#666",
                  fontSize: "14px",
                  margin: 0,
                }}
              >
                {item.description}
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
                style={{
                  fontSize: "16px",
                  fontWeight: "bold",
                  color: "#333",
                }}
              >
                {item.price}
              </span>
              <Button
                style={{
                  background: "#000",
                  color: "#fff",
                  border: "none",
                  borderRadius: "4px",
                  padding: "8px 16px",
                  fontSize: "14px",
                  fontWeight: "500",
                  transition: "background 0.3s ease",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  navigate('/cart');
                }}
              >
                Thuê Ngay
              </Button>
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        div[role="button"]:hover {
          transform: translateY(-4px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
        div[role="button"]:hover img {
          transform: scale(1.05);
        }
        div[role="button"]:focus {
          outline: 2px solid #1890ff;
        }
        @media (min-width: 1200px) {
          div[style*="grid-template-columns"] {
            grid-template-columns: repeat(4, 1fr);
          }
        }
      `}</style>
    </div>
  );
}