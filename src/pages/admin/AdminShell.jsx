// src/pages/admin/AdminShell.jsx
import React, { useState, useMemo } from "react";
import { Layout, Menu, Input, Space, Button, Badge, Avatar, Tooltip } from "antd";
import {
  AppstoreOutlined,
  ShoppingOutlined,
  ShoppingCartOutlined,
  TeamOutlined,
  SecurityScanOutlined,
  SettingOutlined,
  BellOutlined,
  ReloadOutlined,
  SearchOutlined,
  DatabaseOutlined,
} from "@ant-design/icons";
import { Outlet, Link, useLocation } from "react-router-dom";

const { Header, Sider, Content } = Layout;

export default function AdminShell() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  // map path -> key menu
  const selectedKey = useMemo(() => {
    if (location.pathname.startsWith("/admin/orders")) return "orders";
    if (location.pathname.startsWith("/admin/products")) return "products";
    if (location.pathname.startsWith("/admin/kyc")) return "kyc";
    if (location.pathname.startsWith("/admin/maintenance")) return "maintenance";
    if (location.pathname.startsWith("/admin/settings")) return "settings";
    return "dashboard";
  }, [location.pathname]);

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
            { key: "dashboard", icon: <AppstoreOutlined />, label: <Link to="/admin">Tổng quan</Link> },
            { key: "orders", icon: <ShoppingOutlined />, label: <Link to="/admin/orders">Đơn hàng</Link> },
            { key: "products", icon: <ShoppingCartOutlined />, label: <Link to="/admin/products">Sản phẩm</Link> },
            { key: "kyc", icon: <SecurityScanOutlined />, label: <Link to="/admin/kyc">KYC</Link> },
            { key: "maintenance", icon: <DatabaseOutlined />, label: <Link to="/admin/maintenance">Bảo trì</Link> },
            { key: "accounts", icon: <TeamOutlined />, label: <Link to="/admin/accounts">Tài khoản</Link> },
            { key: "settings", icon: <SettingOutlined />, label: <Link to="/admin/settings">Cài đặt</Link> },
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
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Tìm đơn hàng, khách hàng, sản phẩm…"
            style={{ maxWidth: 420 }}
          />
          <Space style={{ marginLeft: "auto" }}>
            <Tooltip title="Làm mới">
              <Button icon={<ReloadOutlined />} />
            </Tooltip>
            <Badge dot>
              <Button icon={<BellOutlined />} />
            </Badge>
            <Avatar src="https://i.pravatar.cc/150?img=5" />
          </Space>
        </Header>

        <Content style={{ padding: 16 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
