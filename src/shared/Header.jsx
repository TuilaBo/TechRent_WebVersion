import React from "react";
import {
  Layout,
  Row,
  Col,
  Input,
  Space,
  Badge,
  Dropdown,
  Menu,
  Button,
} from "antd";
import {
  ShoppingCartOutlined,
  UserOutlined,
  SearchOutlined,
  MenuOutlined,
  BellOutlined,
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
        background:
          "linear-gradient(90deg, #0f0a2b 0%, #3d23a6 45%, #2f6bf2 100%)",
        backdropFilter: "blur(10px)",
        padding: "0 24px",
        boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <Row align="middle" justify="space-between" style={{ height: 56 }}>
        {/* Logo */}
        <Col>
          <Link
            to="/"
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: "#fff",
              letterSpacing: 1,
              fontFamily:
                "'Inter', system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
              textDecoration: "none",
            }}
          >
            TECHRENT
          </Link>
        </Col>

        {/* Menu desktop */}
        <Col flex="auto" className="hidden md:block">
          <Space size="large" style={{ marginLeft: 40 }}>
            {navItems.map((item) => (
              <Link
                key={item.key}
                to={item.link}
                style={{
                  color: "rgba(255,255,255,0.85)",
                  fontWeight: 500,
                  fontSize: 15,
                  position: "relative",
                  textDecoration: "none",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "#fff";
                  e.currentTarget.style.setProperty(
                    "--underline-width",
                    "100%"
                  );
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "rgba(255,255,255,0.85)";
                  e.currentTarget.style.setProperty("--underline-width", "0");
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
                    backgroundColor: "rgba(255,255,255,0.6)",
                    transition: "width .25s ease",
                  }}
                />
              </Link>
            ))}
          </Space>
        </Col>

        {/* Search + Icons */}
        <Col>
          <div className="header-icons">
            <Input
              placeholder="Tìm kiếm sản phẩm…"
              allowClear
              prefix={<SearchOutlined style={{ color: "#8c8c8c" }} />}
              style={{
                borderRadius: 999,
                width: 280,
                backgroundColor: "#fff",
                border: "1px solid rgba(0,0,0,0.12)",
                color: "#000",
                padding: "8px 14px",
                height: 36,
              }}
            />

            {/* Notification */}
            <Link to="/notifications" className="header-icon" aria-label="Notifications">
              <Badge count={3} size="small" offset={[4, 4]} color="#bfbfbf">
                <BellOutlined style={{ fontSize: 20, color: "#fff" }} />
              </Badge>
            </Link>

            {/* Cart */}
            <Link to="/cart" className="header-icon" aria-label="Cart">
              <Badge count={2} size="small" offset={[4, 4]} color="#bfbfbf">
                <ShoppingCartOutlined style={{ fontSize: 20, color: "#fff" }} />
              </Badge>
            </Link>

            {/* Avatar / User */}
            <Dropdown overlay={userMenu} trigger={["click"]}>
              <div className="header-icon" role="button" aria-label="Account menu">
                <UserOutlined style={{ fontSize: 20, color: "#fff" }} />
              </div>
            </Dropdown>

            {/* Menu mobile */}
            <Button
              type="text"
              icon={<MenuOutlined style={{ fontSize: 20 }} />}
              className="md:hidden"
              style={{ color: "#fff" }}
            />
          </div>
        </Col>
      </Row>
    </Header>
  );
}