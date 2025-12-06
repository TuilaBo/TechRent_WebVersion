/**
 * ============================================
 * ADMIN SHELL LAYOUT
 * ============================================
 * 
 * Component layout wrapper cho toàn bộ admin panel
 * Bao gồm:
 * - Sidebar menu với điều hướng
 * - Header với user info và logout
 * - Content area cho các trang con (Outlet)
 * 
 * Layout sử dụng Ant Design Layout với Sider + Header + Content
 */

// src/pages/admin/AdminShell.jsx
import React, { useState, useMemo } from "react";
import {
  Layout,
  Menu,
  Input,
  Space,
  Button,
  Badge,
  Avatar,
  Tooltip,
  Dropdown,
  Typography,
} from "antd";
import {
  AppstoreOutlined,
  ShoppingOutlined,
  ShoppingCartOutlined,
  TeamOutlined,
  SettingOutlined,
  BellOutlined,
  ReloadOutlined,
  SearchOutlined,
  DatabaseOutlined,
  LogoutOutlined,
  UserOutlined,
  HomeOutlined,
  TagsOutlined,
  MoneyCollectOutlined,
  FileTextOutlined,
  ToolOutlined,
} from "@ant-design/icons";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

/**
 * ============================================
 * MAIN COMPONENT: AdminShell
 * ============================================
 */
export default function AdminShell() {
  // ==================== STATE ====================

  /**
   * collapsed: Trạng thái thu gọn sidebar
   * false = sidebar mở rộng, true = sidebar thu gọn
   */
  const [collapsed, setCollapsed] = useState(false);

  // ==================== HOOKS ====================

  /**
   * location: Lấy đường dẫn hiện tại từ React Router
   * Dùng để highlight menu item tương ứng
   */
  const location = useLocation();

  /**
   * navigate: Function để điều hướng sau khi logout
   */
  const navigate = useNavigate();

  /**
   * user, logout: Lấy từ AuthContext
   * - user: Thông tin user đang đăng nhập
   * - logout: Function để đăng xuất
   */
  const { user, logout } = useAuth();

  // ==================== MENU SELECTION LOGIC ====================

  /**
   * selectedKey: Xác định menu item nào đang được chọn
   * 
   * LOGIC:
   * - Dựa vào location.pathname để map ra key tương ứng
   * - useMemo để tránh tính toán lại mỗi render
   * 
   * Mapping:
   * /admin/orders -> "orders"
   * /admin/products -> "products"
   * /admin/maintenance -> "maintenance"
   * ... và các path khác
   * Mặc định: "dashboard"
   */
  const selectedKey = useMemo(() => {
    if (location.pathname.startsWith("/admin/orders")) return "orders";
    if (location.pathname.startsWith("/admin/products")) return "products";
    if (location.pathname.startsWith("/admin/maintenance"))
      return "maintenance";
    if (location.pathname.startsWith("/admin/contracts")) return "contracts";
    if (location.pathname.startsWith("/admin/accounts")) return "accounts";
    if (location.pathname.startsWith("/admin/transactions")) return "transactions";
    if (location.pathname.startsWith("/admin/task-categories")) return "task-categories";
    if (location.pathname.startsWith("/admin/task-rules")) return "task-rules";
    if (location.pathname.startsWith("/admin/conditions")) return "conditions";
    if (location.pathname.startsWith("/admin/device-terms")) return "device-terms";
    if (location.pathname.startsWith("/admin/policies")) return "policies";
    if (location.pathname.startsWith("/admin/settings")) return "settings";
    return "dashboard";
  }, [location.pathname]);

  // ==================== LOGOUT HANDLER ====================

  /**
   * onLogout: Xử lý đăng xuất
   * 
   * FLOW:
   * 1. Gọi logout() từ AuthContext
   * 2. Hiển thị thông báo thành công
   * 3. Chuyển hướng về /login
   * 4. Nếu lỗi, hiển thị thông báo lỗi
   * 
   * @async
   */
  const onLogout = async () => {
    try {
      await logout();
      toast.success("Đã đăng xuất quản trị");
      navigate("/login");
    } catch {
      toast.error("Không thể đăng xuất, thử lại!");
    }
  };

  // ==================== DROPDOWN MENU CONFIG ====================

  /**
   * accountMenu: Cấu hình dropdown menu cho avatar
   * 
   * Menu items:
   * 1. "Về trang khách" - Link về trang home customer
   * 2. Divider
   * 3. "Đăng xuất" - Gọi onLogout
   */
  const accountMenu = {
    items: [
      {
        key: "home",
        icon: <HomeOutlined />,
        label: <Link to="/">Về trang khách</Link>,
      },

      {
        type: "divider",
      },
      {
        key: "logout",
        icon: <LogoutOutlined />,
        label: <span onClick={onLogout}>Đăng xuất</span>,
      },
    ],
  };

  // ==================== RENDER UI ====================

  return (
    <Layout style={{ minHeight: "100vh" }}>
      {/* ========== SIDEBAR ========== */}
      <Sider
        breakpoint="lg"           // Responsive breakpoint
        collapsible               // Cho phép thu gọn
        collapsed={collapsed}     // Trạng thái thu gọn
        onCollapse={setCollapsed} // Handler khi toggle
        width={240}               // Chiều rộng khi mở
        style={{ background: "#001529" }} // Màu nền tối
      >
        {/* Logo/Title */}
        <div
          style={{
            height: 56,
            display: "flex",
            alignItems: "center",
            padding: "0 16px",
            color: "#fff",
            fontWeight: 700,
          }}
        >
          {collapsed ? "TR" : "TechRent Admin"}
        </div>

        {/* Menu Items - 11 items */}
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]} // Highlight menu item đang active
          items={[
            {
              key: "dashboard",
              icon: <AppstoreOutlined />,
              label: <Link to="/admin">Tổng quan</Link>,
            },
            {
              key: "orders",
              icon: <ShoppingOutlined />,
              label: <Link to="/admin/orders">Đơn hàng</Link>,
            },
            {
              key: "products",
              icon: <ShoppingCartOutlined />,
              label: <Link to="/admin/products">Sản phẩm</Link>,
            },
            {
              key: "transactions",
              icon: <MoneyCollectOutlined />,
              label: <Link to="/admin/transactions">Giao dịch</Link>,
            },
            {
              key: "maintenance",
              icon: <ToolOutlined />,
              label: <Link to="/admin/maintenance-schedule">Lịch bảo trì</Link>,
            },

            {
              key: "contracts",
              icon: <DatabaseOutlined />,
              label: <Link to="/admin/contracts">Hợp đồng</Link>,
            },
            {
              key: "accounts",
              icon: <TeamOutlined />,
              label: <Link to="/admin/accounts">Tài khoản</Link>,
            },
            {
              key: "task-categories",
              icon: <TagsOutlined />,
              label: <Link to="/admin/task-categories">Loại công việc</Link>,
            },
            {
              key: "task-rules",
              icon: <SettingOutlined />,
              label: <Link to="/admin/task-rules">Quy tắc công việc</Link>,
            },
            {
              key: "conditions",
              icon: <FileTextOutlined />,
              label: <Link to="/admin/conditions">Tình trạng thiết bị</Link>,
            },
            {
              key: "device-terms",
              icon: <FileTextOutlined />,
              label: <Link to="/admin/device-terms">Điều khoản thiết bị</Link>,
            },
            {
              key: "policies",
              icon: <FileTextOutlined />,
              label: <Link to="/admin/policies">Policy</Link>,
            },
          ]}
        />
      </Sider>

      {/* ========== MAIN CONTENT AREA ========== */}
      <Layout>
        {/* ========== HEADER ========== */}
        <Header
          style={{
            background: "#fff",
            padding: "0 16px",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          {/* Right side: Refresh button + Avatar dropdown */}
          <Space style={{ marginLeft: "auto" }} align="center" size={12}>
            <Tooltip title="Làm mới">
              <Button icon={<ReloadOutlined />} />
            </Tooltip>

            {/* Avatar + dropdown menu */}
            <Dropdown menu={accountMenu} trigger={["click"]}>
              <Space style={{ cursor: "pointer" }}>
                <Avatar src="https://i.pravatar.cc/150?img=5" />
                <Text strong style={{ display: collapsed ? "none" : "inline" }}>
                  {user?.username || "Admin"}
                </Text>
              </Space>
            </Dropdown>
          </Space>
        </Header>

        {/* ========== CONTENT (Outlet for child routes) ========== */}
        <Content style={{ padding: 16 }}>
          {/* React Router Outlet - render các trang con */}
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
