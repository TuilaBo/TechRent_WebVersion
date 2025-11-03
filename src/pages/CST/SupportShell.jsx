import React, { useMemo, useState } from "react";
import { Layout, Menu, Input, Space, Badge, Button, Avatar, Tooltip, Dropdown } from "antd";
import {
  CustomerServiceOutlined,
  MessageOutlined,
  FileTextOutlined,
  SettingOutlined,
  DashboardOutlined,
  SearchOutlined,
  BellOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";

const { Header, Sider, Content } = Layout;

export default function SupportShell() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);

  // map URL -> key menu
  const selectedKey = useMemo(() => {
    if (location.pathname.startsWith("/support/desk")) return "desk";
    if (location.pathname.startsWith("/support/chats")) return "chats";
    if (location.pathname.startsWith("/support/kb")) return "kb";
    if (location.pathname.startsWith("/support/settings")) return "settings";
    return "dashboard";
  }, [location.pathname]);

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        width={220}
        style={{ background: "#0d1117" }}
      >
        <div
          style={{
            height: 56,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "0 16px",
            color: "#fff",
            fontWeight: 700,
          }}
        >
          <CustomerServiceOutlined style={{ fontSize: 20 }} />
          {!collapsed && "Support Center"}
        </div>

        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={[
            {
              key: "desk",
              icon: <FileTextOutlined />,
              label: <Link to="/support/desk">Tickets & Chat</Link>,
            },
            {
              key: "chats",
              icon: <MessageOutlined />,
              label: <Link to="/support/chats">Live Chats</Link>,
            },
            {
              key: "settings",
              icon: <SettingOutlined />,
              label: <Link to="/support/settings">Cài đặt</Link>,
            },
          ]}
          style={{ background: "#0d1117" }}
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
            borderBottom: "1px solid #f0f0f0",
          }}
        >
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Tìm ticket, phiên chat, khách hàng…"
            style={{ maxWidth: 420 }}
          />
          <Space style={{ marginLeft: "auto" }}>
            <Tooltip title="Làm mới">
              <Button icon={<ReloadOutlined />} />
            </Tooltip>
            <Badge dot>
              <Button icon={<BellOutlined />} />
            </Badge>
            <Dropdown
              overlay={
                <Menu
                  items={[
                    { key: "profile", label: <Link to="/profile">Tài khoản</Link> },
                    { key: "logout", label: <span onClick={() => { logout(); navigate("/login"); }}>Đăng xuất</span> },
                  ]}
                />
              }
              trigger={["click"]}
            >
              <Avatar src="https://i.pravatar.cc/120?img=13" style={{ cursor: "pointer" }} />
            </Dropdown>
          </Space>
        </Header>

        <Content style={{ padding: 16, background: "#f7f9fb" }}>
          {/* Nhúng trang con ở đây */}
          <div className="page-shell">
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
