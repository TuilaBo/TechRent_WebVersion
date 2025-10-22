import React from "react";
import { Card, Row, Col, Typography, Space } from "antd";
import {
  CameraOutlined,
  LaptopOutlined,
  CustomerServiceOutlined,
  PlayCircleOutlined,
  RocketOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";
import { Link } from "react-router-dom";

const { Title, Text } = Typography;

const categories = [
  { id: 1, name: "Máy ảnh",        count: "45+ sản phẩm", icon: <CameraOutlined />,        path: "/category" },
  { id: 2, name: "Laptop",         count: "32+ sản phẩm", icon: <LaptopOutlined />,        path: "/category" },
  { id: 3, name: "Iphone",         count: "18+ sản phẩm", icon: <RocketOutlined />,        path: "/category" },
  { id: 4, name: "Flycam/Drone",   count: "24+ sản phẩm", icon: <VideoCameraOutlined />,   path: "/category" },
  { id: 5, name: "Âm thanh",       count: "56+ sản phẩm", icon: <CustomerServiceOutlined />, path: "/category" },
  { id: 6, name: "Gaming",         count: "38+ sản phẩm", icon: <PlayCircleOutlined />,    path: "/category" },
];

export default function BrowseCategories() {
  return (
    <div className="bg-white py-12 rounded-2xl mb-24">
      <div className="text-center mb-10">
        <Title
          level={3}
          style={{
            textAlign: "center",
            marginBottom: 40,
            color: "#1a1a1a",
            fontSize: 28,
            fontWeight: "bold",
            letterSpacing: 1,
          }}
        >
          Danh mục sản phẩm
        </Title>
      </div>

      <div className="container mx-auto px-4">
        <Row gutter={[16, 16]} justify="center">
          {categories.map((cat) => (
            <Col key={cat.id} xs={12} sm={8} md={8} lg={4} className="flex justify-center">
              {/* Dùng Link bao quanh Card để toàn bộ card là link */}
              <Link
                to={cat.path}
                aria-label={`Xem danh mục ${cat.name}`}
                style={{ width: "100%", maxWidth: 180, textDecoration: "none" }}
                className="block"
              >
                <Card
                  hoverable
                  bordered={false}
                  className="w-full rounded-xl shadow-md hover:shadow-xl transition-all text-center hover:scale-105"
                >
                  <Space direction="vertical" align="center" size="middle" className="w-full">
                    <div className="text-4xl text-[#000]">{cat.icon}</div>
                    <Text strong className="block text-gray-900 text-base">
                      {cat.name}
                    </Text>
                    <Text type="secondary" className="text-sm">
                      {cat.count}
                    </Text>
                  </Space>
                </Card>
              </Link>
            </Col>
          ))}
        </Row>
      </div>
    </div>
  );
}