// src/pages/browse/BrowseCategories.jsx
import React, { useEffect, useState } from "react";
import { Card, Row, Col, Typography, Space, Skeleton, Alert, Empty } from "antd";
import { Link } from "react-router-dom";
import {
  CameraOutlined,
  LaptopOutlined,
  AudioOutlined,
  PlayCircleOutlined,
  MobileOutlined,
  MonitorOutlined,
  DesktopOutlined,
  CustomerServiceOutlined,
  AppstoreOutlined,
} from "@ant-design/icons";
import { fetchCategories } from "../lib/categoryApi"

const { Title, Text } = Typography;

const ICONS = {
  camera: <CameraOutlined />,
  laptop: <LaptopOutlined />,
  audio: <CustomerServiceOutlined />,
  gaming: <PlayCircleOutlined />,
  monitor: <MonitorOutlined />,
  phone: <MobileOutlined />,
  pc: <DesktopOutlined />,
  default: <AppstoreOutlined />,
};

const pickIcon = (name = "") => {
  const n = name.toLowerCase();
  if (n.includes("máy ảnh") || n.includes("camera")) return "camera";
  if (n.includes("laptop") || n.includes("macbook") || n.includes("dell")) return "laptop";
  if (n.includes("âm thanh") || n.includes("audio") || n.includes("tai nghe") || n.includes("headphone")) return "audio";
  if (n.includes("game") || n.includes("xbox") || n.includes("ps") || n.includes("console")) return "gaming";
  if (n.includes("màn hình") || n.includes("monitor") || n.includes("display")) return "monitor";
  if (n.includes("iphone") || n.includes("phone") || n.includes("mobile") || n.includes("smartphone")) return "phone";
  if (n.includes("pc") || n.includes("desktop") || n.includes("máy tính")) return "pc";
  return "default";
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
    <div style={{ 
      padding: "60px 0 80px",
    }}>
      <div className="text-center mb-12">
        <Title
          level={1}
          style={{
            marginBottom: 12,
            color: "#000",
            fontSize: 32,
            fontWeight: 700,
            letterSpacing: "-1px",
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
          }}
        >
          Danh mục sản phẩm
        </Title>

      </div>

      <div className="container mx-auto px-6">
        {loading ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : err ? (
          <Alert type="error" message={err} showIcon style={{ borderRadius: 12 }} />
        ) : list.length === 0 ? (
          <Empty description="Chưa có danh mục" />
        ) : (
          <Row gutter={[24, 24]} justify="center">
            {list.map((cat) => {
              const id = cat.id;
              const name = cat.name;
              const iconType = pickIcon(name);
              const countText = cat.productCount
                ? `${cat.productCount}+ sản phẩm`
                : "Xem sản phẩm";

              return (
                <Col key={id} xs={12} sm={8} md={6} lg={4} className="flex justify-center">
                  <Link
                    to={`/category/${id}`}
                    aria-label={`Xem danh mục ${name}`}
                    style={{ width: "100%", maxWidth: 180, textDecoration: "none" }}
                  >
                    <Card
                      hoverable
                      bordered={false}
                      style={{
                        borderRadius: 16,
                        overflow: "hidden",
                        transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                        border: "2px solid #f5f5f5",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                        background: "#fff"
                      }}
                      className="category-card"
                      bodyStyle={{ padding: "24px 16px" }}
                    >
                      <Space direction="vertical" align="center" size={16} className="w-full">
                        <div
                          style={{
                            width: 64,
                            height: 64,
                            borderRadius: 16,
                            background: "#000",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 28,
                            color: "#fff",
                            transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                          }}
                          className="icon-wrapper"
                        >
                          {ICONS[iconType]}
                        </div>
                        <div style={{ textAlign: "center" }}>
                          <Text
                            strong
                            style={{
                              display: "block",
                              color: "#000",
                              fontSize: 14,
                              fontWeight: 600,
                              marginBottom: 4,
                              lineHeight: 1.4,
                              letterSpacing: "-0.2px"
                            }}
                          >
                            {name}
                          </Text>
                          <Text
                            style={{
                              fontSize: 12,
                              color: "#999",
                              fontWeight: 400,
                              letterSpacing: "0.1px"
                            }}
                          >
                            {countText}
                          </Text>
                        </div>
                      </Space>
                    </Card>
                  </Link>
                </Col>
              );
            })}
          </Row>
        )}
      </div>

      <style jsx>{`
        .category-card:hover {
          transform: translateY(-12px);
          box-shadow: 0 20px 40px rgba(0,0,0,0.12) !important;
          border-color: #000 !important;
        }
        
        .category-card:hover .icon-wrapper {
          transform: scale(1.15);
          background: #000;
          box-shadow: 0 8px 24px rgba(0,0,0,0.3);
        }
        
        .category-card:active {
          transform: translateY(-8px);
        }
        
        .icon-wrapper {
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
      `}</style>
    </div>
  );
}