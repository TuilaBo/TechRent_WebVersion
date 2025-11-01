// src/components/AppHeader.jsx
import React, { useState, useEffect, useRef } from "react";
import { Layout, Row, Col, Space, Badge, Dropdown, Menu, Input } from "antd";
import {
  ShoppingCartOutlined,
  UserOutlined,
  BellOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import { getCartCount } from "../lib/cartUtils";

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
  const [cartCount, setCartCount] = useState(0);
  const [bump, setBump] = useState(false); // <-- NEW

  const [hidden, setHidden] = useState(false);
  const lastYRef = useRef(typeof window !== 'undefined' ? window.scrollY : 0);
  const headerRef = useRef(null);

  useEffect(() => {
    const update = (count) => {
      setCartCount(count ?? getCartCount());
      setBump(true);
      const t = setTimeout(() => setBump(false), 500);
      return () => clearTimeout(t);
    };

    update(getCartCount());

    const onStorage = (e) => {
      if (e.key === "techrent-cart") update(getCartCount());
    };

    const onCartUpdated = (e) => {
      update(e?.detail?.count);
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("cart:updated", onCartUpdated);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("cart:updated", onCartUpdated);
    };
  }, []);

  // Auto hide/show header on scroll
  useEffect(() => {
    const onScroll = () => {
      const currentY = window.scrollY || 0;
      const lastY = lastYRef.current || 0;
      const headerH = headerRef.current?.offsetHeight || 0;

      // cập nhật biến chiều cao để phần hero bù trừ đúng
      document.documentElement.style.setProperty("--stacked-header", `${headerH}px`);

      const delta = currentY - lastY;
      if (Math.abs(delta) < 4) return;

      if (currentY > headerH && delta > 0) {
        setHidden(true);
      } else {
        setHidden(false);
      }

      lastYRef.current = currentY;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    const headerH = headerRef.current?.offsetHeight || 0;
    document.documentElement.style.setProperty("--stacked-header", `${headerH}px`);

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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

  const searchInputMobileStyle = {
    borderRadius: 50,
    background: "#fff",
    border: "2px solid rgba(0,0,0,0.25)",
    padding: "6px 12px",
    width: 200,
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    transition: "all 0.3s ease",
    fontWeight: 600,
  };

  return (
    <Header
      ref={headerRef}
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
        transform: hidden ? "translateY(-100%)" : "translateY(0)",
        transition: "transform .25s ease",
      }}
    >
      {/* CSS animation cho badge/cart */}
      <style>{`
        @keyframes cart-bump {
          0%   { transform: scale(1); }
          10%  { transform: scale(1.15); }
          30%  { transform: scale(0.95); }
          50%  { transform: scale(1.08); }
          100% { transform: scale(1); }
        }
        .cart-badge-bump { animation: cart-bump .5s ease; }
        .icon-wrap { position: relative; display: inline-flex; align-items: center; justify-content: center; }
        .ping { position: absolute; width: 8px; height: 8px; border-radius: 9999px; background: #000; top: -2px; right: -2px; opacity: 0.65; animation: ping 1.2s cubic-bezier(0, 0, 0.2, 1) 1 forwards; }
        @keyframes ping { 0% { transform: scale(1); opacity: .8; } 70% { transform: scale(2.2); opacity: .28; } 100% { transform: scale(2.8); opacity: 0; } }
        .nav-link { color: #141414 !important; font-weight: 600; background: none !important; transition: color .16s linear; }
        .nav-link .nav-underline { position: absolute; bottom: -4px; left: 0; width: var(--underline-width, 0); height: 2px; background: #000; border-radius: 8px; transition: width 0.27s cubic-bezier(.82,-0.01,.43,.98); }
        .nav-link:hover, .nav-link:focus { color: #000 !important; }
        .nav-link:focus .nav-underline, .nav-link:hover .nav-underline { width: 100% !important; }
        .login-btn { background: #000 !important; color: #fff !important; border-radius: 999px; padding: 11px 26px !important; font-weight: 700; font-size: 17px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); border: none; min-width: 120px; transition: all .18s cubic-bezier(.6,-0.04,.43,.99); }
        .login-btn:hover, .login-btn:focus { background: #fff !important; color: #000 !important; border: 2px solid #000; }
        .search-input { border-radius: 33px !important; border: 2px solid #e3e3e3 !important; background: #fff !important; font-weight: 600; box-shadow: none !important; padding: 8px 18px !important; transition: border-color .18s; }
        .search-input:focus { border: 2.2px solid #000 !important; box-shadow: 0px 1px 7px rgba(20,20,20,.09); }
      `}</style>

      <Row align="middle" justify="space-between" style={{ height: 56 }}>
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
                      e.currentTarget.style.setProperty("--underline-width", "100%");
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
              <div className="header-icons" style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div className="md:hidden">
                </div>

                <Link to="/notifications" className="header-icon" aria-label="Notifications">
                  <Badge count={3} size="small" offset={[4, 4]} color="#000">
                    <BellOutlined style={{ fontSize: 20, color: "#000" }} />
                  </Badge>
                </Link>

                {/* Cart icon + bump + ping */}
                <Link to="/cart" className="header-icon" aria-label="Cart">
                  <span className={`icon-wrap ${bump ? "cart-badge-bump" : ""}`}>
                    <Badge count={cartCount} size="small" offset={[4, 4]} color="#000">
                      <ShoppingCartOutlined style={{ fontSize: 20, color: "#000" }} />
                    </Badge>
                    {bump && <span className="ping" />}
                  </span>
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
