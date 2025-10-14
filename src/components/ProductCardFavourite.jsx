import React from "react";
import { Card, Row, Col, Typography } from "antd";
import {
  HeartOutlined,
  ShareAltOutlined,
  ShoppingCartOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";

const { Title, Paragraph } = Typography;
const { Meta } = Card;

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

  const goDetail = () => {
    navigate(`/devices/:Id`);
  };

  return (
    <div style={{ padding: "24px", background: "#f0f2f5" }}>
      <Title
        level={2}
        style={{ textAlign: "center", marginBottom: "32px", color: "#1890ff" }}
      >
        Sản phẩm yêu thích
      </Title>

      <Row gutter={[16, 16]}>
        {products.map((item) => (
          <Col xs={24} sm={12} md={8} lg={6} key={item.id}>
            <Card
              hoverable
              onClick={() => goDetail(item.id)}
              style={{
                borderRadius: "12px",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
                overflow: "hidden",
                transition: "all 0.3s ease",
                cursor: "pointer",
              }}
              cover={
                <div style={{ overflow: "hidden", height: "200px" }}>
                  {/* cũng cho img clickable / accessible */}
                  <img
                    alt={item.title}
                    src={item.image}
                    style={{
                      height: "100%",
                      width: "100%",
                      objectFit: "cover",
                      transition: "transform 0.4s ease",
                    }}
                    className="card-img"
                  />
                </div>
              }
              actions={[
                <HeartOutlined key="like" style={{ color: "#eb2f96" }} />,
                <ShoppingCartOutlined key="cart" style={{ color: "#1890ff" }} />,
                <ShareAltOutlined key="share" style={{ color: "#52c41a" }} />,
              ]}
              bodyStyle={{ minHeight: "120px" }}
              className="custom-card"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && goDetail(item.id)}
            >
              <Meta
                avatar={
                  <img
                    src={item.avatar}
                    alt="avatar"
                    style={{ borderRadius: "50%" }}
                  />
                }
                title={
                  <span style={{ fontWeight: "bold", color: "#595959" }}>
                    {item.title}
                  </span>
                }
                description={
                  <Paragraph ellipsis={{ rows: 2 }} style={{ color: "#8c8c8c" }}>
                    {item.description}
                  </Paragraph>
                }
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* CSS hover effect */}
      <style jsx>{`
        .custom-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
        }
        .custom-card:hover .card-img {
          transform: scale(1.05);
        }
      `}</style>
    </div>
  );
}
