// src/pages/CST/SupportShell.jsx
import React, { useMemo, useState } from "react";
import {
  Layout,
  Menu,
  Space,
  Badge,
  Button,
  Avatar,
  Tooltip,
  Dropdown,
  Typography,
} from "antd";
import {
  CustomerServiceOutlined,
  MessageOutlined,
  FileTextOutlined,
  SettingOutlined,
  BellOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

export default function SupportShell() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);

  // map URL -> key menu
  const selectedKey = useMemo(() => {
    if (location.pathname.startsWith("/support/desk")) return "desk";
    if (location.pathname.startsWith("/support/tasks")) return "tasks";
    if (location.pathname.startsWith("/support/settlements")) return "settlements";
    if (location.pathname.startsWith("/support/chats")) return "chats";
    if (location.pathname.startsWith("/support/settings")) return "settings";
    return "desk";
  }, [location.pathname]);

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        width={240}
        theme="dark"
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
          {!collapsed && "TechRent Support"}
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
              key: "tasks",
              icon: <CheckCircleOutlined />,
              label: <Link to="/support/tasks">Công việc</Link>,
            },
            {
              key: "settlements",
              icon: <FileTextOutlined />,
              label: <Link to="/support/settlements">Giải quyết quyết toán</Link>,
            },
            {
              key: "chats",
              icon: <MessageOutlined />,
              label: <Link to="/support/chats">Live Chats</Link>,
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
            borderBottom: "1px solid #f0f0f0",
          }}
        >
          <Space style={{ marginLeft: "auto" }} align="center" size={12}>
            <Tooltip title="Làm mới">
              <Button icon={<ReloadOutlined />} />
            </Tooltip>
            <Badge dot>
              <Button icon={<BellOutlined />} />
            </Badge>
            <Dropdown
              menu={{
                items: [
                  {
                    key: "profile",
                    label: <Link to="/profile">Tài khoản</Link>,
                  },
                  {
                    type: "divider",
                  },
                  {
                    key: "logout",
                    label: (
                      <span
                        onClick={() => {
                          logout();
                          navigate("/login");
                        }}
                      >
                        Đăng xuất
                      </span>
                    ),
                  },
                ],
              }}
              trigger={["click"]}
            >
              <Space style={{ cursor: "pointer" }}>
                <Avatar src="https://i.pravatar.cc/120?img=13" />
                <Text strong style={{ display: collapsed ? "none" : "inline" }}>
                  Support
                </Text>
              </Space>
            </Dropdown>
          </Space>
        </Header>

        <Content style={{ padding: 16, background: "#f7f9fb" }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
