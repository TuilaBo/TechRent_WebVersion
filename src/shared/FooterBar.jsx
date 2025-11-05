import React from "react";
import {
  Layout,
  Row,
  Col,
  Typography,
  Space,
  Button,
  Divider,
  Tag,
  Input,
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
  AndroidOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";

const { Footer } = Layout;
const { Title, Text, Link, Paragraph } = Typography;

const pmBadgeStyle = {
  padding: "6px 10px",
  borderRadius: 8,
  background: "rgba(255,255,255,0.06)", // dịu trên nền #0B1220
  border: "1px solid rgba(255,255,255,0.12)",
  color: "#fff",
  fontWeight: 600,
  letterSpacing: 0.5,
};

const storeBtnStyle = {
  borderColor: "rgba(255,255,255,0.45)",
  color: "#fff",
  borderRadius: 10,
};

export default function FooterBar() {
  return (
    <Footer
      style={{
        padding: 0,
        background: "#0B1220", // ✅ navy rất đậm
        color: "rgba(255,255,255,0.85)",
        marginTop: 40,
      }}
    >
      {/* Thanh gradient mảnh trên cùng (nhận diện thương hiệu) */}
      <div
        style={{
          height: 2,
          width: "100%",
          background: "linear-gradient(90deg,#6D28D9,#2F6BF2)",
        }}
      />

      {/* Nội dung chính */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 16px" }}>
        <Row gutter={[24, 32]}>
          {/* Brand & Social */}
          <Col xs={24} md={8}>
            <Space direction="vertical" size={12} style={{ display: "flex" }}>
              <Space align="center">
                <Title
                  level={3}
                  style={{ color: "#fff", margin: 0, letterSpacing: 0.2 }}
                >
                  TechRent
                </Title>
              </Space>

              <Paragraph style={{ color: "rgba(255,255,255,0.75)", margin: 0 }}>
                Thuê thiết bị công nghệ nhanh – gọn – uy tín. Laptop, camera,
                ... giao nhanh tại TP.HCM.
              </Paragraph>

              <Space size="middle" wrap>
                <Tag color="blue" style={{ marginInlineEnd: 0 }}>
                  <SafetyCertificateOutlined /> Đối tác uy tín
                </Tag>
              </Space>

              <Space size="large">
                <a aria-label="Facebook" href="#" style={{ color: "#8ab4ff", fontSize: 20 }}>
                  <FacebookOutlined />
                </a>
                <a aria-label="Instagram" href="#" style={{ color: "#ff9bd6", fontSize: 20 }}>
                  <InstagramOutlined />
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
              <Link href="#" style={{ color: "rgba(255,255,255,0.75)" }}>
                Chính sách
              </Link>
            </Space>
          </Col>

          {/* Contact */}
          <Col xs={24} md={6}>
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
                <Link href="mailto:support@techrent.vn">support@techrent.vn</Link>
              </Space>
              <Space align="start">
                <EnvironmentOutlined />
                <Text style={{ color: "rgba(255,255,255,0.8)" }}>
                  Lô E2a-7, Đường D1, Khu Công nghệ cao, Phường Tăng Nhơn Phú A,
                  TP. Thủ Đức, TP. Hồ Chí Minh
                </Text>
              </Space>
              <Space>
              </Space>
            </Space>
          </Col>

          {/* Newsletter */}
          <Col xs={24} md={6}>
            <Title level={5} style={{ color: "#fff" }}>Nhận tin khuyến mãi</Title>
            <Text style={{ color: "rgba(255,255,255,0.75)" }}>
              Nhập email để nhận ưu đãi và cập nhật sản phẩm mới.
            </Text>
            <Space style={{ marginTop: 12 }}>
              <Input placeholder="Email của bạn" style={{ width: 220, background: "#0f172a", borderColor: "#1f2937", color: "#fff" }} />
              <Button type="primary" style={{ background: "#2F6BF2", borderColor: "#2F6BF2" }}>Đăng ký</Button>
            </Space>
          </Col>
        </Row>

        <Divider style={{ borderColor: "rgba(255,255,255,0.10)" }} />

        {/* Payments & Apps */}
        <Row gutter={[16, 16]} align="middle" justify="space-between">
          <Col xs={24} md={12}>
            <Space direction="vertical" size={6}>
              <Text style={{ color: "rgba(255,255,255,0.7)" }}>
                Chấp nhận thanh toán
              </Text>
              <Space size="middle" wrap>
                <div style={pmBadgeStyle}>PayOs</div>
                <div style={pmBadgeStyle}>Momo</div>
                <div style={pmBadgeStyle}>VNPAY</div>
              </Space>
            </Space>
          </Col>

          <Col xs={24} md={12}>
            <Space direction="vertical" size={6} style={{ float: "right" }}>
              <Text style={{ color: "rgba(255,255,255,0.7)" }}>Ứng dụng di động</Text>
              <Space>
                <Button ghost icon={<AndroidOutlined />} style={storeBtnStyle} size="large">
                  Google Play
                </Button>
              </Space>
            </Space>
          </Col>
        </Row>

        {/* Bottom bar */}
        <Divider style={{ borderColor: "rgba(255,255,255,0.08)", marginTop: 24 }} />
        <Row align="middle" justify="space-between">
          <Col>
            <Text style={{ color: "rgba(255,255,255,0.6)" }}>
              © {new Date().getFullYear()} TechRent. All rights reserved.
            </Text>
          </Col>
          <Col>
            <Space size={16}>
              <Link href="#" style={{ color: "rgba(255,255,255,0.65)" }}>Điều khoản</Link>
              <Link href="#" style={{ color: "rgba(255,255,255,0.65)" }}>Bảo mật</Link>
              <Link href="#" style={{ color: "rgba(255,255,255,0.65)" }}>Cookies</Link>
            </Space>
          </Col>
        </Row>
      </div>
    </Footer>
  );
}
