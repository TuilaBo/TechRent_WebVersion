// src/pages/browse/BrowseCategories.jsx
import React, { useEffect, useState } from "react";
import { Card, Row, Col, Typography, Space, Skeleton, Alert } from "antd";
import { Link } from "react-router-dom";
import {
  CameraOutlined,
  LaptopOutlined,
  CustomerServiceOutlined,
  PlayCircleOutlined,
  RocketOutlined,
  VideoCameraOutlined,
  AppstoreOutlined,
} from "@ant-design/icons";
import { fetchCategories } from "../lib/categoryApi";

const { Title, Text } = Typography;

const ICONS = {
  camera: <CameraOutlined />,
  laptop: <LaptopOutlined />,
  audio: <CustomerServiceOutlined />,
  gaming: <PlayCircleOutlined />,
  drone: <VideoCameraOutlined />,
  phone: <RocketOutlined />,
  default: <AppstoreOutlined />,
};

const pickIcon = (name = "") => {
  const n = name.toLowerCase();
  if (n.includes("máy ảnh") || n.includes("camera")) return ICONS.camera;
  if (n.includes("laptop") || n.includes("macbook")) return ICONS.laptop;
  if (n.includes("âm thanh") || n.includes("audio")) return ICONS.audio;
  if (n.includes("game")) return ICONS.gaming;
  if (n.includes("flycam") || n.includes("drone")) return ICONS.drone;
  if (n.includes("iphone") || n.includes("phone")) return ICONS.phone;
  return ICONS.default;
};

export default function BrowseCategories() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const cats = await fetchCategories();
        setList(Array.isArray(cats) ? cats : []);
      } catch (e) {
        setErr(e?.response?.data?.message || e?.message || "Không tải được danh mục.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="bg-white py-12 rounded-2xl mb-24">
      <div className="text-center mb-10">
        <Title level={3} style={{ marginBottom: 40, color: "#1a1a1a", fontSize: 28, fontWeight: "bold" }}>
          Danh mục sản phẩm
        </Title>
      </div>

      <div className="container mx-auto px-4">
        {loading ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : err ? (
          <Alert type="error" message={err} showIcon />
        ) : (
          <Row gutter={[16, 16]} justify="center">
            {list.map((cat) => {
              const id = cat?.deviceCategoryId ?? cat?.id;
              const name = cat?.name ?? cat?.categoryName ?? "Danh mục";
              const countText = cat?.productCount ? `${cat.productCount}+ sản phẩm` : "Xem sản phẩm";
              return (
                <Col key={id} xs={12} sm={8} md={8} lg={4} className="flex justify-center">
                  <Link
                    to={`/category/${id}`}
                    aria-label={`Xem danh mục ${name}`}
                    style={{ width: "100%", maxWidth: 180, textDecoration: "none" }}
                    className="block"
                  >
                    <Card
                      hoverable
                      bordered={false}
                      className="w-full rounded-xl shadow-md hover:shadow-xl transition-all text-center hover:scale-105"
                    >
                      <Space direction="vertical" align="center" size="middle" className="w-full">
                        <div className="text-4xl text-[#000]">{pickIcon(name)}</div>
                        <Text strong className="block text-gray-900 text-base">
                          {name}
                        </Text>
                        <Text type="secondary" className="text-sm">
                          {countText}
                        </Text>
                      </Space>
                    </Card>
                  </Link>
                </Col>
              );
            })}
          </Row>
        )}
      </div>
    </div>
  );
}
