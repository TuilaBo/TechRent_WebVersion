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
  const [searchQuery, setSearchQuery] = useState("");

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

  // Initialize header height CSS variable on mount
  useEffect(() => {
    const updateHeaderHeight = () => {
      const headerH = headerRef.current?.offsetHeight || 72;
      document.documentElement.style.setProperty("--stacked-header", `${headerH}px`);
    };
    
    // Set initial value
    updateHeaderHeight();
    
    // Update on resize
    window.addEventListener("resize", updateHeaderHeight);
    
    return () => window.removeEventListener("resize", updateHeaderHeight);
  }, []);

  // Auto hide/show header on scroll - hide when scrolling down, show when scrolling up
  useEffect(() => {
    let ticking = false;
    
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentY = window.scrollY || 0;
          const lastY = lastYRef.current || 0;
          const headerH = headerRef.current?.offsetHeight || 72;

          // Update CSS variable for header height
          document.documentElement.style.setProperty("--stacked-header", `${headerH}px`);

          // Always show header when at the top of the page (within 100px)
          if (currentY < 100) {
            setHidden(false);
            lastYRef.current = currentY;
            ticking = false;
            return;
          }

          const delta = currentY - lastY;
          
          // Only react to significant scroll movements (threshold: 5px)
          if (Math.abs(delta) >= 5) {
            // Hide when scrolling down, show when scrolling up
            if (delta > 0) {
              // Scrolling down - hide header
              setHidden(true);
            } else {
              // Scrolling up - show header
              setHidden(false);
            }
            lastYRef.current = currentY;
          }

          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleLogout = () => {
    logout();
    toast.success("Đã đăng xuất");
    navigate("/login");
  };

  const doSearch = () => {
    const q = (searchQuery || "").trim();
    if (!q) {
      toast("Nhập từ khoá để tìm kiếm");
      return;
    }
    navigate(`/search?q=${encodeURIComponent(q)}`);
  };

  const userMenuItems = [
    { key: "1", icon: <UserOutlined />, label: <Link to="/profile">Tài khoản</Link> },
    { key: "2", icon: <ShoppingCartOutlined />, label: <Link to="/orders">Đơn thuê</Link> },
    { type: 'divider' },
    { key: "3", label: <span onClick={handleLogout}>Đăng xuất</span>, danger: true },
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
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        width: "100%",
        background: "rgba(255, 255, 255, 0.95)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        padding: "0 40px",
        boxShadow: hidden ? "none" : "0 1px 0 rgba(0,0,0,0.06), 0 4px 24px rgba(0,0,0,0.1)",
        borderBottom: "1px solid rgba(0,0,0,0.08)",
        transform: hidden ? "translateY(-100%)" : "translateY(0)",
        transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s ease",
        height: 72,
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
          line-height: 70px;
        }
        .ant-menu-item {
          padding: 0 24px !important;
          font-weight: 600 !important;
          font-size: 15px !important;
          color: #555 !important;
          border-bottom: 3px solid transparent !important;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
          margin: 0 6px !important;
          border-radius: 8px 8px 0 0 !important;
        }
        .ant-menu-item:hover {
          color: #000 !important;
          background: rgba(0, 0, 0, 0.03) !important;
          border-bottom-color: #000 !important;
          transform: translateY(-1px);
        }
        .ant-menu-item-selected {
          color: #000 !important;
          border-bottom-color: #000 !important;
          background: rgba(0, 0, 0, 0.02) !important;
          font-weight: 700 !important;
        }
        .ant-menu-item::after {
          display: none !important;
        }
        
        /* Search input styles */
        .search-input { 
          border-radius: 20px !important; 
          border: 1.5px solid #e8e8e8 !important; 
          background: rgba(255, 255, 255, 0.95) !important; 
          font-weight: 500 !important;
          font-size: 13px !important;
          box-shadow: 0 1px 4px rgba(0,0,0,0.04) !important; 
          padding: 6px 16px !important; 
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
        .search-input:hover {
          border-color: #d0d0d0 !important;
          background: #fff !important;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08) !important;
        }
        .search-input:focus, .search-input-focused { 
          border: 1.5px solid #000 !important; 
          box-shadow: 0 2px 12px rgba(0,0,0,0.12) !important;
          background: #fff !important;
        }
        .search-input .ant-input {
          font-weight: 500 !important;
          font-size: 13px !important;
          padding: 0 !important;
        }
        .search-input .ant-input::placeholder {
          color: #999 !important;
        }
        
        /* Header icon styles */
        .header-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 44px;
          height: 44px;
          border-radius: 14px;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
          position: relative;
        }
        .header-icon:hover {
          background: rgba(0, 0, 0, 0.08);
          transform: translateY(-2px);
        }
        .header-icon:active {
          transform: translateY(0) scale(0.96);
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
          background: linear-gradient(135deg, #000 0%, #1a1a1a 100%);
          color: #fff;
          border-radius: 12px;
          padding: 10px 24px;
          font-weight: 700;
          font-size: 14px;
          line-height: 1.2;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.1);
          display: inline-block;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          border: none;
          letter-spacing: 0.3px;
        }
        .login-link-btn:hover {
          background: linear-gradient(135deg, #1a1a1a 0%, #000 100%);
          color: #fff;
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0,0,0,0.25), 0 2px 6px rgba(0,0,0,0.15);
        }
        .login-link-btn:active {
          transform: translateY(0);
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }
        
        /* Logo animation */
        .logo-text {
          background: linear-gradient(135deg, #000 0%, #1a1a1a 50%, #000 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          position: relative;
          display: inline-block;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          filter: drop-shadow(0 1px 2px rgba(0,0,0,0.1));
        }
        .logo-text:hover {
          transform: scale(1.03) translateY(-1px);
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.15));
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

      <Row align="middle" justify="space-between" style={{ height: 72 }}>
        <Col flex="none">
          <Link
            to="/"
            className="logo-text"
            style={{
              fontSize: 28,
              fontWeight: 900,
              color: "#000",
              letterSpacing: 0.8,
              fontFamily: "'Inter', system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
              textDecoration: "none",
            }}
          >
            TECHRENT
          </Link>
        </Col>

        {!isAuthenticated ? (
          <Col flex="none" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Search bar - compact */}
            <Input
              allowClear
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              prefix={<SearchOutlined style={{ color: "#999", fontSize: 14 }} />}
              placeholder="Tìm kiếm..."
              className="search-input"
              onPressEnter={doSearch}
              onFocus={(e) => e.currentTarget.parentElement?.classList.add("search-input-focused")}
              onBlur={(e) => e.currentTarget.parentElement?.classList.remove("search-input-focused")}
              style={{ width: 200, height: 36 }}
            />
            <Link to="/login" aria-label="Đăng nhập">
              <div className="login-link-btn">
                Đăng nhập
              </div>
            </Link>
          </Col>
        ) : (
          <Col flex="none" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Navigation menu - only when authenticated */}
            <div className="hidden lg:block">
              <Menu
                mode="horizontal"
                selectedKeys={[selectedNavKey]}
                items={navItems.map((n) => ({ key: n.key, label: <Link to={n.link}>{n.label}</Link> }))}
                style={{ borderBottom: "none", background: "transparent" }}
              />
            </div>

            {/* Search bar - compact */}
            <Input
              allowClear
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              prefix={<SearchOutlined style={{ color: "#999", fontSize: 14 }} />}
              placeholder="Tìm kiếm..."
              className="search-input"
              onPressEnter={doSearch}
              onFocus={(e) => e.currentTarget.parentElement?.classList.add("search-input-focused")}
              onBlur={(e) => e.currentTarget.parentElement?.classList.remove("search-input-focused")}
              style={{ width: 200, height: 36 }}
            />

            {/* Icons */}
            <div className="header-icons" style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Link to="/notifications" className="header-icon" aria-label="Notifications">
                <Badge count={3} size="small" offset={[6, 6]} color="#000">
                  <BellOutlined style={{ fontSize: 22, color: "#000" }} />
                </Badge>
              </Link>

              {/* Cart icon + bump + ping */}
              <Link to="/cart" className="header-icon" aria-label="Cart">
                <span className={`icon-wrap ${bump ? "cart-badge-bump" : ""}`}>
                  <Badge count={cartCount} size="small" offset={[6, 6]} color="#000">
                    <ShoppingCartOutlined style={{ fontSize: 22, color: "#000" }} />
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
                  <UserOutlined style={{ fontSize: 22, color: "#000" }} />
                </div>
              </Dropdown>
            </div>
          </Col>
        )}
      </Row>
    </Header>
  );
}