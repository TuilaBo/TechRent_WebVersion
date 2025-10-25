// src/components/AppHeader.jsx
import React from "react";
import { Layout, Row, Col, Space, Badge, Dropdown, Menu, Button } from "antd";
import {
  ShoppingCartOutlined,
  UserOutlined,
  MenuOutlined,
  BellOutlined,
} from "@ant-design/icons";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

const { Header } = Layout;

const navItems = [
  { key: "home", label: "Trang chủ", link: "/" },
  { key: "products", label: "Sản phẩm", link: "/products" },
  { key: "categories", label: "Danh mục", link: "/categories" },
  { key: "about", label: "Giới thiệu", link: "/about" },
  { key: "support", label: "Hỗ trợ", link: "/support" },
];

export default function AppHeader() {
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    toast.success("Đã đăng xuất");
    navigate("/login");
  };

  const userMenu = (
    <Menu
      items={[
        { key: "1", label: <Link to="/profile">Tài khoản</Link> },
        { key: "2", label: <Link to="/orders">Đơn thuê</Link> },
        { key: "3", label: <span onClick={handleLogout}>Đăng xuất</span> },
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
        background: "#fff",
        backdropFilter: "blur(10px)",
        padding: "0 24px",
        boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
        borderBottom: "1px solid rgba(0,0,0,0.08)",
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
              color: "#000",
              letterSpacing: 1,
              fontFamily:
                "'Inter', system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
              textDecoration: "none",
            }}
          >
            TECHRENT
          </Link>
        </Col>

        {/* Nếu CHƯA đăng nhập -> chỉ hiện nút Sign In */}
        {!isAuthenticated ? (
          <Col>
            <Link to="/login" aria-label="Đăng nhập">
              <div
                style={{
                  background: "#000",
                  color: "#fff",
                  borderRadius: 12,
                  padding: "10px 20px",
                  fontWeight: 600,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                  display: "inline-block",
                  lineHeight: 1,
                }}
              >
                Đăng nhập
              </div>
            </Link>
          </Col>
        ) : (
          <>
            {/* ĐÃ đăng nhập -> hiện menu điều hướng + icon như trước */}
            <Col flex="auto" className="hidden md:block">
              <Space size="large" style={{ marginLeft: 40 }}>
                {navItems.map((item) => (
                  <Link
                    key={item.key}
                    to={item.link}
                    style={{
                      color: "rgba(0,0,0,0.85)",
                      fontWeight: 500,
                      fontSize: 15,
                      position: "relative",
                      textDecoration: "none",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = "#000";
                      e.currentTarget.style.setProperty(
                        "--underline-width",
                        "100%"
                      );
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = "rgba(0,0,0,0.85)";
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
                        backgroundColor: "rgba(0,0,0,0.6)",
                        transition: "width .25s ease",
                      }}
                    />
                  </Link>
                ))}
              </Space>
            </Col>

            <Col>
              <div className="header-icons">
                <Link to="/notifications" className="header-icon" aria-label="Notifications">
                  <Badge count={3} size="small" offset={[4, 4]} color="#000">
                    <BellOutlined style={{ fontSize: 20, color: "#000" }} />
                  </Badge>
                </Link>

                <Link to="/cart" className="header-icon" aria-label="Cart">
                  <Badge count={2} size="small" offset={[4, 4]} color="#000">
                    <ShoppingCartOutlined style={{ fontSize: 20, color: "#000" }} />
                  </Badge>
                </Link>

                <Dropdown overlay={userMenu} trigger={["click"]}>
                  <div className="header-icon" role="button" aria-label="Account menu" title={user?.username || "Tài khoản"}>
                    <UserOutlined style={{ fontSize: 20, color: "#000" }} />
                  </div>
                </Dropdown>

                
              </div>
            </Col>
          </>
        )}
      </Row>
    </Header>
  );
}
