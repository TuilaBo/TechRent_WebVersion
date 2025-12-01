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
} from "@ant-design/icons";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

export default function AdminShell() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth(); // <-- dùng context để đăng xuất

  // map path -> key menu
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
    if (location.pathname.startsWith("/admin/settings")) return "settings";
    return "dashboard";
  }, [location.pathname]);

  const onLogout = async () => {
    try {
      await logout();
      toast.success("Đã đăng xuất quản trị");
      navigate("/login");
    } catch {
      toast.error("Không thể đăng xuất, thử lại!");
    }
  };

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

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        breakpoint="lg"
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        width={240}
        style={{ background: "#001529" }}
      >
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

        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
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
          ]}
        />
      </Sider>

      <Layout>
        <Header
          style={{
            background: "#fff",
            padding: "0 16px",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
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

        <Content style={{ padding: 16 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
