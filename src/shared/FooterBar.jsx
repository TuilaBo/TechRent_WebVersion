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
  Card,
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
  ThunderboltOutlined,
  SmileOutlined,
  CustomerServiceOutlined,
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
  borderColor: "rgba(255,255,255,0.4)",
  color: "#fff",
  borderRadius: 10,
  height: 44,
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const highlightCards = [
  {
    icon: <SafetyCertificateOutlined style={{ fontSize: 22 }} />,
    title: "Thiết bị chính hãng",
    desc: "100% kiểm định trước khi giao – chứng nhận bởi TechRent.",
  },
  {
    icon: <ThunderboltOutlined style={{ fontSize: 22 }} />,
    title: "Giao nhanh 2H",
    desc: "Có mặt tại TP.HCM trong vòng 2 giờ kể từ khi xác nhận.",
  },
  {
    icon: <CustomerServiceOutlined style={{ fontSize: 22 }} />,
    title: "Hỗ trợ đa kênh",
    desc: "Chat, hotline, email hoạt động 08:00 – 21:00 mỗi ngày.",
  },
];

const quickLinks = [
  { label: "Giới thiệu", href: "#" },
  { label: "Liên hệ", href: "#" },
  { label: "Blog", href: "#" },
  { label: "Tuyển dụng", href: "#" },
];

const supportLinks = [
  { label: "Hướng dẫn thuê", href: "#" },
  { label: "Bảo hành & đổi trả", href: "#" },
  { label: "Câu hỏi thường gặp", href: "#" },
  { label: "Chính sách & điều khoản", href: "#" },
];

const socialLinks = [
  { icon: <FacebookOutlined />, label: "Facebook", href: "#" },
  { icon: <InstagramOutlined />, label: "Instagram", href: "#" },
  { icon: <YoutubeOutlined />, label: "Youtube", href: "#" },
  { icon: <TwitterOutlined />, label: "Twitter", href: "#" },
];

export default function FooterBar() {
  return (
    <Footer
      style={{
        padding: 0,
        background: "#050917",
        color: "rgba(255,255,255,0.85)",
        marginTop: 40,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(circle at top, rgba(111,98,255,0.2), transparent 50%)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          height: 2,
          width: "100%",
          background: "linear-gradient(90deg,#6D28D9,#2F6BF2)",
        }}
      />

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 16px" }}>
        <Row gutter={[24, 24]}>
          {highlightCards.map((item) => (
            <Col xs={24} md={8} key={item.title}>
              <Card
                bordered={false}
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <Space align="start" size="large">
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "50%",
                      background: "rgba(255,255,255,0.1)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                    }}
                  >
                    {item.icon}
                  </div>
                  <Space direction="vertical" size={4}>
                    <Text style={{ color: "#fff", fontWeight: 600 }}>{item.title}</Text>
                    <Text style={{ color: "rgba(255,255,255,0.75)" }}>{item.desc}</Text>
                  </Space>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>

        <Divider style={{ borderColor: "rgba(255,255,255,0.08)", margin: "36px 0" }} />

        <Row gutter={[32, 32]}>
          <Col xs={24} md={8}>
            <Space direction="vertical" size={16} style={{ display: "flex" }}>
              <div>
                <Title level={3} style={{ color: "#fff", margin: 0, letterSpacing: 0.3 }}>
                  TechRent
                </Title>
                <Text style={{ color: "rgba(255,255,255,0.75)" }}>
                  Thuê thiết bị công nghệ nhanh – gọn – uy tín. Laptop, camera, thiết bị livestream và audio
                  dành cho team sản xuất nội dung.
                </Text>
              </div>
              <Space wrap size="large">
                {socialLinks.map((social) => (
                  <a
                    key={social.label}
                    aria-label={social.label}
                    href={social.href}
                    style={{
                      color: "#fff",
                      fontSize: 18,
                      opacity: 0.8,
                      transition: "opacity .2s",
                    }}
                  >
                    {social.icon}
                  </a>
                ))}
              </Space>
            </Space>
          </Col>

          <Col xs={12} md={4}>
            <Title level={5} style={{ color: "#fff" }}>
              Về TechRent
            </Title>
            <Space direction="vertical" size={8}>
              {quickLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  style={{ color: "rgba(255,255,255,0.75)" }}
                >
                  {link.label}
                </Link>
              ))}
            </Space>
          </Col>

          <Col xs={12} md={4}>
            <Title level={5} style={{ color: "#fff" }}>
              Hỗ trợ
            </Title>
            <Space direction="vertical" size={8}>
              {supportLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  style={{ color: "rgba(255,255,255,0.75)" }}
                >
                  {link.label}
                </Link>
              ))}
            </Space>
          </Col>

          <Col xs={24} md={8}>
            <Title level={5} style={{ color: "#fff" }}>
              Liên hệ
            </Title>
            <Space direction="vertical" size={10} style={{ display: "flex" }}>
              <Space>
                <PhoneOutlined />
                <Text style={{ color: "#fff", fontWeight: 600 }}>0937 466 461</Text>
                <Tag color="purple" style={{ marginLeft: 8 }}>
                  08:00 – 21:00
                </Tag>
              </Space>
              <Space>
                <MailOutlined />
                <Link href="mailto:support@techrent.vn">support@techrent.vn</Link>
              </Space>
              <Space align="start">
                <EnvironmentOutlined />
                <Text style={{ color: "rgba(255,255,255,0.8)" }}>
                  Lô E2a-7, Đường D1, Khu Công nghệ cao, P. Tăng Nhơn Phú A, TP. Thủ Đức
                </Text>
              </Space>
              <Space>
                <ClockCircleOutlined />
                <Text style={{ color: "rgba(255,255,255,0.8)" }}>Giao nhanh nội thành chỉ từ 2 giờ</Text>
              </Space>
            </Space>
          </Col>
        </Row>

        <Divider style={{ borderColor: "rgba(255,255,255,0.08)", margin: "32px 0" }} />

        <Row gutter={[24, 16]} align="middle">
          <Col xs={24} md={12}>
            <Space direction="vertical" size={6}>
              <Text style={{ color: "rgba(255,255,255,0.75)" }}>Chấp nhận thanh toán</Text>
              <Space size="middle" wrap>
                <div style={pmBadgeStyle}>PayOs</div>
                <div style={pmBadgeStyle}>Momo</div>
                <div style={pmBadgeStyle}>VNPAY</div>
                <div style={pmBadgeStyle}>VNPay QR</div>
              </Space>
            </Space>
          </Col>

          <Col xs={24} md={12}>
            <Space direction="vertical" size={6} style={{ width: "100%", alignItems: "flex-start" }}>
              <Text style={{ color: "rgba(255,255,255,0.75)" }}>Ứng dụng di động (coming soon)</Text>
              <Button ghost icon={<AndroidOutlined />} style={storeBtnStyle}>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>Tải trên</div>
                  <div style={{ fontWeight: 600 }}>Google Play</div>
                </div>
              </Button>
            </Space>
          </Col>
        </Row>

        <Divider style={{ borderColor: "rgba(255,255,255,0.08)", marginTop: 32 }} />
        <Row align="middle" justify="space-between">
          <Col>
            <Text style={{ color: "rgba(255,255,255,0.6)" }}>
              © {new Date().getFullYear()} TechRent. All rights reserved.
            </Text>
          </Col>
          <Col>
            <Space size={16}>
              <Link href="#" style={{ color: "rgba(255,255,255,0.65)" }}>
                Điều khoản
              </Link>
              <Link href="#" style={{ color: "rgba(255,255,255,0.65)" }}>
                Bảo mật
              </Link>
              <Link href="#" style={{ color: "rgba(255,255,255,0.65)" }}>
                Cookies
              </Link>
            </Space>
          </Col>
        </Row>
      </div>
    </Footer>
  );
}
