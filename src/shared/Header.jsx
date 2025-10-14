// src/components/AppHeader.jsx
import React, { useEffect, useState } from "react";
import {
  Layout,
  Row,
  Col,
  Input,
  Space,
  Badge,
  Dropdown,
  Avatar,
  Menu,
  Button,
} from "antd";
import {
  ShoppingCartOutlined,
  UserOutlined,
  SearchOutlined,
  MenuOutlined,
} from "@ant-design/icons";
import { Link } from "react-router-dom";

const { Header } = Layout;

const navItems = [
  { key: "home", label: "Trang chủ", link: "/" },
  { key: "products", label: "Sản phẩm", link: "/products" },
  { key: "categories", label: "Danh mục", link: "/categories" },
  { key: "about", label: "Giới thiệu", link: "/about" },
  { key: "support", label: "Hỗ trợ", link: "/support" },
];

export default function AppHeader() {
  const [atTop, setAtTop] = useState(true);

  useEffect(() => {
    const onScroll = () => setAtTop(window.scrollY < 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const userMenu = (
    <Menu
      items={[
        { key: "1", label: <Link to="/profile">Tài khoản</Link> },
        { key: "2", label: <Link to="/orders">Đơn thuê</Link> },
        { key: "3", label: <Link to="/logout">Đăng xuất</Link> },
      ]}
    />
  );

  return (
    <Header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 1000,
        width: "100%",
        // 🔮 Neon purple–blue gradient + highlight cam nhẹ
        backgroundImage: `
      linear-gradient(135deg,
        #1A0B2E 0%,
        #2A1050 20%,
        #4527A0 45%,
        #3B82F6 80%,
        #2563EB 100%
      ),
      radial-gradient(900px 280px at 82% -20%,
        rgba(255,153,0,.32) 0%,
        rgba(255,153,0,0) 60%)
    `,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        padding: "0 32px",
        boxShadow: "0 10px 30px rgba(17, 12, 46, .35)",
        borderBottom: "1px solid rgba(255,255,255,.08)",
        transition: "background .25s ease, box-shadow .25s ease",
      }}
    >
      <Row align="middle" justify="space-between">
        {/* Logo */}
        {/* Logo */}
<Col>
  <Link
    to="/"
    aria-label="TechRent"
    style={{ display: "inline-flex", alignItems: "center" }}
  >
    <img
      src="/logo2.png" // hoặc .svg
      alt="TechRent"
      // Tăng kích thước logo: dùng clamp để responsive chút
      style={{
        height: "clamp(32px, 3.6vw, 44px)", // trước ~24–28px, giờ to hơn
        width: "auto",
        display: "block",
        transform: "translateY(15px)"
      }}
      draggable="false"
    />
  </Link>
</Col>


        {/* Menu desktop */}
        <Col flex="auto" className="hidden md:block">
          <Space size="large" style={{ marginLeft: 48 }}>
            {navItems.map((item) => (
              <Link
                key={item.key}
                to={item.link}
                style={{
                  color: "rgba(255,255,255,.82)",
                  fontWeight: 500,
                  fontSize: 15,
                  position: "relative",
                  transition: "color .25s ease",
                }}
                onMouseEnter={(e) => {
                  e.target.style.color = "#fff";
                  e.target.style.setProperty("--underline-width", "100%");
                }}
                onMouseLeave={(e) => {
                  e.target.style.color = "rgba(255,255,255,.82)";
                  e.target.style.setProperty("--underline-width", "0");
                }}
              >
                {item.label}
                <span
                  style={{
                    position: "absolute",
                    bottom: -4,
                    left: 0,
                    width: "var(--underline-width, 0)",
                    height: 2,
                    backgroundColor: "rgba(255,255,255,.65)",
                    transition: "width .25s ease",
                  }}
                />
              </Link>
            ))}
          </Space>
        </Col>

        {/* Search + User + Cart */}
        <Col>
          <Space size="middle">
            <Input
              placeholder="Tìm kiếm sản phẩm…"
              prefix={<SearchOutlined style={{ color: "#8c8c8c" }} />}
              style={{
                borderRadius: 999,
                width: 260,
                backgroundColor: "#fff",
                border: "1px solid #1f1f1f",
                color: "#000",
                padding: "8px 14px",
              }}
            />
            <Link to="/cart" style={{ display: "inline-block" }}>
              <Badge count={2} size="small" offset={[0, 6]} color="#bfbfbf">
                <ShoppingCartOutlined
                  style={{
                    fontSize: 22,
                    color: "#fff",
                    cursor: "pointer",
                    transition: "transform .2s ease, opacity .2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "scale(1.08)";
                    e.currentTarget.style.opacity = 0.9;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "scale(1)";
                    e.currentTarget.style.opacity = 1;
                  }}
                />
              </Badge>
            </Link>
            <Dropdown overlay={userMenu} trigger={["click"]}>
              <Avatar
                style={{
                  backgroundColor: "transparent",
                  border: "1px solid rgba(255,255,255,.22)",
                  cursor: "pointer",
                  transition: "transform .2s ease, opacity .2s ease",
                }}
                icon={<UserOutlined style={{ color: "#fff" }} />}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "scale(1.06)";
                  e.currentTarget.style.opacity = 0.9;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "scale(1)";
                  e.currentTarget.style.opacity = 1;
                }}
              />
            </Dropdown>
          </Space>
        </Col>
      </Row>
    </Header>
  );
}
