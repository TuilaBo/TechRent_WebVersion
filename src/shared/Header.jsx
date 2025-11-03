// src/components/AppHeader.jsx
import React, { useState, useEffect, useRef } from "react";
import { Layout, Row, Col, Space, Badge, Dropdown, Menu, Input } from "antd";
import {
  ShoppingCartOutlined,
  UserOutlined,
  BellOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { Link, useLocation, useNavigate } from "react-router-dom";
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
  const location = useLocation();
  const { isAuthenticated, user, logout } = useAuth();
  const [cartCount, setCartCount] = useState(0);
  const [bump, setBump] = useState(false);

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

  const userMenuItems = [
    { key: "1", icon: <UserOutlined />, label: <Link to="/profile">Tài khoản</Link> },
    { key: "2", icon: <ShoppingCartOutlined />, label: <Link to="/orders">Đơn thuê</Link> },
    { key: "4", icon: <BellOutlined />, label: <Link to="/chat">Live chat</Link> },
    { type: 'divider' },
    { key: "3", icon: <span style={{ fontSize: 14 }}>🚪</span>, label: <span onClick={handleLogout}>Đăng xuất</span>, danger: true },
  ];

  const selectedNavKey = React.useMemo(() => {
    const path = location.pathname || "/";
    if (path === "/") return "home";
    const found = navItems.find((n) => path.startsWith(n.link) && n.link !== "/");
    return found?.key || "home";
  }, [location.pathname]);

  return (
    <Header
      ref={headerRef}
      style={{
        position: "sticky",
        top: 0,
        zIndex: 1000,
        width: "100%",
        background: "rgba(255, 255, 255, 0.85)",
        backdropFilter: "blur(16px) saturate(180%)",
        WebkitBackdropFilter: "blur(16px) saturate(180%)",
        padding: "0 32px",
        boxShadow: hidden ? "none" : "0 1px 0 rgba(0,0,0,0.05), 0 2px 16px rgba(0,0,0,0.08)",
        borderBottom: "1px solid rgba(0,0,0,0.06)",
        transform: hidden ? "translateY(-100%)" : "translateY(0)",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
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
        .icon-wrap { 
          position: relative; 
          display: inline-flex; 
          align-items: center; 
          justify-content: center;
          transition: transform 0.2s ease;
        }
        .icon-wrap:hover {
          transform: scale(1.1);
        }
        .ping { 
          position: absolute; 
          width: 8px; 
          height: 8px; 
          border-radius: 9999px; 
          background: #000; 
          top: -2px; 
          right: -2px; 
          opacity: 0.65; 
          animation: ping 1.2s cubic-bezier(0, 0, 0.2, 1) 1 forwards; 
        }
        @keyframes ping { 
          0% { transform: scale(1); opacity: .8; } 
          70% { transform: scale(2.2); opacity: .28; } 
          100% { transform: scale(2.8); opacity: 0; } 
        }
        
        /* Navigation styles */
        .ant-menu-horizontal {
          border-bottom: none !important;
          background: transparent !important;
          line-height: 62px;
        }
        .ant-menu-item {
          padding: 0 20px !important;
          font-weight: 600 !important;
          color: #444 !important;
          border-bottom: 2px solid transparent !important;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
          margin: 0 4px !important;
        }
        .ant-menu-item:hover {
          color: #000 !important;
          border-bottom-color: #000 !important;
        }
        .ant-menu-item-selected {
          color: #000 !important;
          border-bottom-color: #000 !important;
          background: transparent !important;
        }
        .ant-menu-item::after {
          display: none !important;
        }
        
        /* Search input styles */
        .search-input { 
          border-radius: 24px !important; 
          border: 1.5px solid #e5e5e5 !important; 
          background: rgba(255, 255, 255, 0.9) !important; 
          font-weight: 500 !important;
          font-size: 14px !important;
          box-shadow: none !important; 
          padding: 10px 20px !important; 
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
        .search-input:hover {
          border-color: #bbb !important;
          background: #fff !important;
        }
        .search-input:focus { 
          border: 1.5px solid #000 !important; 
          box-shadow: 0 2px 12px rgba(0,0,0,0.08) !important;
          background: #fff !important;
        }
        .search-input .ant-input {
          font-weight: 500 !important;
        }
        
        /* Header icon styles */
        .header-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          border-radius: 12px;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
        }
        .header-icon:hover {
          background: rgba(0, 0, 0, 0.05);
        }
        .header-icon:active {
          transform: scale(0.95);
        }
        
        /* Badge styles */
        .ant-badge-count {
          background: #000 !important;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15) !important;
          font-weight: 600 !important;
          font-size: 11px !important;
        }
        
        /* Login button styles */
        .login-link-btn {
          background: #000;
          color: #fff;
          border-radius: 10px;
          padding: 8px 18px;
          font-weight: 700;
          font-size: 13px;
          line-height: 1.1;
          box-shadow: 0 1px 6px rgba(0,0,0,0.12);
          display: inline-block;
          transition: all 0.18s cubic-bezier(0.4, 0, 0.2, 1);
          border: 1px solid #000;
        }
        .login-link-btn:hover {
          background: #fff;
          color: #000;
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(0,0,0,0.2);
        }
        .login-link-btn:active {
          transform: translateY(0);
        }
        
        /* Logo animation */
        .logo-text {
          background: linear-gradient(135deg, #000 0%, #333 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          position: relative;
          display: inline-block;
          transition: all 0.3s ease;
        }
        .logo-text:hover {
          transform: scale(1.02);
        }
        
        /* Dropdown menu styles */
        .user-dropdown-menu {
          border-radius: 12px !important;
          padding: 6px !important;
          box-shadow: 0 6px 24px rgba(0,0,0,0.12) !important;
          border: 1px solid rgba(0,0,0,0.08) !important;
          min-width: 180px !important;
        }
        .user-dropdown-menu .ant-dropdown-menu-item {
          border-radius: 8px !important;
          padding: 10px 14px !important;
          margin: 2px 0 !important;
          font-weight: 500 !important;
          font-size: 14px !important;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
        .user-dropdown-menu .ant-dropdown-menu-item:hover {
          background: rgba(0,0,0,0.06) !important;
          transform: translateX(3px);
        }
        .user-dropdown-menu .ant-dropdown-menu-item-danger {
          color: #ff4d4f !important;
        }
        .user-dropdown-menu .ant-dropdown-menu-item-danger:hover {
          background: rgba(255,77,79,0.08) !important;
          color: #ff4d4f !important;
        }
        .user-dropdown-menu .ant-dropdown-menu-item-icon {
          font-size: 14px !important;
          margin-right: 10px !important;
        }
        .user-dropdown-menu .ant-dropdown-menu-item-divider {
          margin: 6px 0 !important;
          background: rgba(0,0,0,0.06) !important;
        }
        .user-dropdown-menu a {
          color: inherit !important;
        }
        
        /* note: use default AntD motion to avoid double-animate flicker */
      `}</style>

      <Row align="middle" justify="space-between" style={{ height: 64 }}>
        <Col flex="none">
          <Link
            to="/"
            className="logo-text"
            style={{
              fontSize: 26,
              fontWeight: 900,
              color: "#000",
              letterSpacing: 0.5,
              fontFamily: "'Inter', system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
              textDecoration: "none",
            }}
          >
            TECHRENT
          </Link>
        </Col>

        {!isAuthenticated ? (
          <Col>
            <Link to="/login" aria-label="Đăng nhập">
              <div className="login-link-btn">
                Đăng nhập
              </div>
            </Link>
          </Col>
        ) : (
          <>
            <Col flex="auto" className="hidden md:block">
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginLeft: 32 }}>
                <Menu
                  mode="horizontal"
                  selectedKeys={[selectedNavKey]}
                  items={navItems.map((n) => ({ key: n.key, label: <Link to={n.link}>{n.label}</Link> }))}
                  style={{ flex: 1, minWidth: 360, borderBottom: "none" }}
                />
                <div style={{ maxWidth: 360, width: "100%" }}>
                  <Input
                    allowClear
                    prefix={<SearchOutlined />}
                    placeholder="Tìm sản phẩm, danh mục…"
                    className="search-input"
                    onPressEnter={(e) => {
                      const q = e.currentTarget.value?.trim();
                      if (q) navigate(`/search?q=${encodeURIComponent(q)}`);
                    }}
                  />
                </div>
              </div>
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

                <Dropdown 
                  menu={{ items: userMenuItems }}
                  trigger={["click"]}
                  placement="bottomRight"
                  overlayClassName="user-dropdown-menu"
                >
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