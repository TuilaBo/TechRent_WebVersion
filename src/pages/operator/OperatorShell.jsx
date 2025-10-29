// src/pages/operator/OperatorShell.jsx
import React, { useState } from "react";
import { Layout, Menu, Avatar, Dropdown } from "antd";
import {
  DashboardOutlined,
  ProfileOutlined,
  ScheduleOutlined,
  ContainerOutlined,
  FileTextOutlined,
} from "@ant-design/icons";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuthStore } from "../../store/authStore";

const { Sider, Header, Content } = Layout;

export default function OperatorShell() {
  const nav = useNavigate();
  const loc = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const logout = useAuthStore((s) => s.logout);

  const selected = (() => {
    if (loc.pathname.startsWith("/operator/orders")) return "orders";
    if (loc.pathname.startsWith("/operator/tasks")) return "tasks";
    if (loc.pathname.startsWith("/operator/shifts")) return "shifts";
    if (loc.pathname.startsWith("/operator/contracts")) return "contracts";
    if (loc.pathname === "/operator/kyc") return "kyc";
    return "dashboard";
  })();

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
            color: "#fff",
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            padding: "0 16px",
          }}
        >
          {collapsed ? "OP" : "TechRent Operator"}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selected]}
          items={[
            { key: "dashboard", icon: <DashboardOutlined />, label: "Tổng quan", onClick: () => nav("/operator") },
            { key: "orders", icon: <ProfileOutlined />, label: "Quản lý đơn", onClick: () => nav("/operator/orders") },
            { key: "contracts", icon: <FileTextOutlined />, label: "Hợp đồng", onClick: () => nav("/operator/contracts") },
            { key: "tasks", icon: <ContainerOutlined />, label: "Nhiệm vụ", onClick: () => nav("/operator/tasks") },
            { key: "kyc", icon: <ProfileOutlined />, label: "KYC", onClick: () => nav("/operator/kyc") },
          ]}
        />
      </Sider>

      <Layout>
        <Header
          style={{
            background: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            padding: "0 16px",
          }}
        >
          <Dropdown
            menu={{
              items: [
                { key: "profile", label: "Hồ sơ", onClick: () => nav("/profile") },
                { type: "divider" },
                {
                  key: "logout",
                  label: "Đăng xuất",
                  onClick: () => {
                    logout();
                    toast.success("Đã đăng xuất");
                    nav("/login");
                  },
                },
              ],
            }}
            trigger={["click"]}
          >
            <Avatar src="https://i.pravatar.cc/150?img=12" style={{ cursor: "pointer" }} />
          </Dropdown>
        </Header>
        <Content style={{ padding: 16 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
