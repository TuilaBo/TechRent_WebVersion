import React from "react";
import {
  Layout,
  Row,
  Col,
  Typography,
  Space,
  Input,
  Button,
  Divider,
  Tag,
} from "antd";
import {
  FacebookOutlined,
  YoutubeOutlined,
  InstagramOutlined,
  TwitterOutlined,
  PhoneOutlined,
  MailOutlined,
  EnvironmentOutlined,
  ClockCircleOutlined,
  SendOutlined,
  AppleOutlined,
  AndroidOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";

const { Footer } = Layout;
const { Title, Text, Link, Paragraph } = Typography;

export default function FooterBar() {
  return (
    <Footer
      style={{
        padding: 0,
        background: "#0f172a", // slate-900
        color: "rgba(255,255,255,0.85)",
      }}
    >
      {/* Newsletter */}
      <div
        style={{
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          background:
            "linear-gradient(90deg, rgba(24,144,255,0.15), rgba(99,102,241,0.15))",
        }}
      ></div>

      {/* Main */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 16px" }}>
        <Row gutter={[24, 32]}>
          {/* Brand & Social */}
          <Col xs={24} md={8}>
            <Space direction="vertical" size={12} style={{ display: "flex" }}>
              <Space align="center">
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background:
                      "conic-gradient(from 220deg, #1677ff, #22d3ee, #6366f1)",
                  }}
                />
                <Title
                  level={3}
                  style={{ color: "#fff", margin: 0, letterSpacing: 0.2 }}
                >
                  TechRent
                </Title>
              </Space>
              <Paragraph style={{ color: "rgba(255,255,255,0.7)", margin: 0 }}>
                Thuê thiết bị công nghệ nhanh – gọn – uy tín. Laptop, camera,
                drone, VR… giao nhanh tại TP.HCM.
              </Paragraph>

              <Space size="middle" wrap>
                <Tag color="blue" style={{ marginInlineEnd: 0 }}>
                  <SafetyCertificateOutlined /> Đối tác uy tín
                </Tag>
                <Tag color="green" style={{ marginInlineEnd: 0 }}>
                  Bảo hiểm thiết bị
                </Tag>
                <Tag color="geekblue" style={{ marginInlineEnd: 0 }}>
                  Hỗ trợ 24/7
                </Tag>
              </Space>

              <Space size="large">
                <a
                  aria-label="Facebook"
                  href="#"
                  style={{ color: "#8ab4ff", fontSize: 20 }}
                >
                  <FacebookOutlined />
                </a>
                <a
                  aria-label="YouTube"
                  href="#"
                  style={{ color: "#ff6a6a", fontSize: 20 }}
                >
                  <YoutubeOutlined />
                </a>
                <a
                  aria-label="Instagram"
                  href="#"
                  style={{ color: "#ff9bd6", fontSize: 20 }}
                >
                  <InstagramOutlined />
                </a>
                <a
                  aria-label="Twitter"
                  href="#"
                  style={{ color: "#7dd3fc", fontSize: 20 }}
                >
                  <TwitterOutlined />
                </a>
              </Space>
            </Space>
          </Col>

          {/* Links */}
          <Col xs={12} md={4}>
            <Title level={5} style={{ color: "#fff" }}>
              Về TechRent
            </Title>
            <Space direction="vertical" size={8}>
              <Link href="#" style={{ color: "rgba(255,255,255,0.75)" }}>
                Giới thiệu
              </Link>
              <Link href="#" style={{ color: "rgba(255,255,255,0.75)" }}>
                Tuyển dụng
              </Link>
              <Link href="#" style={{ color: "rgba(255,255,255,0.75)" }}>
                Blog & tin tức
              </Link>
              <Link href="#" style={{ color: "rgba(255,255,255,0.75)" }}>
                Liên hệ
              </Link>
            </Space>
          </Col>

          <Col xs={12} md={4}>
            <Title level={5} style={{ color: "#fff" }}>
              Hỗ trợ
            </Title>
            <Space direction="vertical" size={8}>
              <Link href="#" style={{ color: "rgba(255,255,255,0.75)" }}>
                Hướng dẫn thuê
              </Link>
              <Link href="#" style={{ color: "rgba(255,255,255,0.75)" }}>
                Bảo hành & đổi trả
              </Link>
              <Link href="#" style={{ color: "rgba(255,255,255,0.75)" }}>
                Câu hỏi thường gặp
              </Link>
              <Link href="https://docs.google.com/document/d/1GtAaYcQcSuvX8f-al_v_Q0mYYOWZMj-To8zHAKa0OnA/edit?tab=t.0" style={{ color: "rgba(255,255,255,0.75)" }}>
                Chính sách 
              </Link>
            </Space>
          </Col>

          {/* Contact */}
          <Col xs={24} md={8}>
            <Title level={5} style={{ color: "#fff" }}>
              Liên hệ
            </Title>
            <Space direction="vertical" size={10} style={{ display: "flex" }}>
              <Space>
                <PhoneOutlined />
                <Text style={{ color: "#fff" }}>0937 466 461</Text>
                <Tag color="processing" style={{ marginInlineStart: 8 }}>
                  08:00–21:00
                </Tag>
              </Space>
              <Space>
                <MailOutlined />
                <Link href="mailto:support@techrent.vn">
                  support@techrent.vn
                </Link>
              </Space>
              <Space align="start">
                <EnvironmentOutlined />
                <Text style={{ color: "rgba(255,255,255,0.8)" }}>
                Lô E2a-7, Đường D1, Khu Công nghệ cao, Phường Tăng Nhơn Phú A, TP. Thủ Đức, TP. Hồ Chí Minh
                </Text>
              </Space>
              <Space>
                <ClockCircleOutlined />
                <Text style={{ color: "rgba(255,255,255,0.8)" }}>
                  Giao & nhận: T2–CN (kể cả lễ)
                </Text>
              </Space>
            </Space>
          </Col>
        </Row>

        <Divider style={{ borderColor: "rgba(255,255,255,0.12)" }} />

        {/* Payments & Apps */}
        <Row gutter={[16, 16]} align="middle" justify="space-between">
          <Col xs={24} md={12}>
            <Space direction="vertical" size={6}>
              <Text style={{ color: "rgba(255,255,255,0.7)" }}>
                Chấp nhận thanh toán
              </Text>
              <Space size="middle" wrap>
                {/* Placeholder payment badges */}
                <div style={pmBadgeStyle}>PayOs</div>

                <div style={pmBadgeStyle}>Momo</div>
              </Space>
            </Space>
          </Col>

          <Col xs={24} md={12}>
            <Space direction="vertical" size={6} style={{ float: "right" }}>
              <Text style={{ color: "rgba(255,255,255,0.7)" }}>
                Ứng dụng di động
              </Text>
              <Space>
                <Button
                  ghost
                  icon={<AppleOutlined />}
                  style={storeBtnStyle}
                  size="large"
                >
                  App Store
                </Button>
                <Button
                  ghost
                  icon={<AndroidOutlined />}
                  style={storeBtnStyle}
                  size="large"
                >
                  Google Play
                </Button>
              </Space>
            </Space>
          </Col>
        </Row>
      </div>

      {/* Bottom bar */}
      <div
        style={{
          borderTop: "1px solid rgba(255,255,255,0.08)",
          background: "#0b1220",
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "14px 16px",
          }}
        >
          <Row justify="space-between" align="middle">
            <Col>
              <Text style={{ color: "rgba(255,255,255,0.6)" }}>
                © {new Date().getFullYear()} TechRent. All rights reserved.
              </Text>
            </Col>
            <Col>
              <Space size="large">
                <Link href="#" style={{ color: "rgba(255,255,255,0.65)" }}>
                  Điều khoản
                </Link>
                <Link href="#" style={{ color: "rgba(255,255,255,0.65)" }}>
                  Quy chế hoạt động
                </Link>
                <Link href="#" style={{ color: "rgba(255,255,255,0.65)" }}>
                  Sitemap
                </Link>
              </Space>
            </Col>
          </Row>
        </div>
      </div>
    </Footer>
  );
}

const pmBadgeStyle = {
  padding: "6px 10px",
  borderRadius: 8,
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "#fff",
  fontWeight: 600,
  letterSpacing: 0.5,
};

const storeBtnStyle = {
  borderColor: "rgba(255,255,255,0.5)",
  color: "#fff",
  borderRadius: 10,
};
