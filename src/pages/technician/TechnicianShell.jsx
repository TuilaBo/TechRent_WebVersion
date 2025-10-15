// src/pages/technician/TechnicianShell.jsx
import React, { useState } from "react";
import { Layout, Menu, Avatar } from "antd";
import { CalendarOutlined, FileTextOutlined } from "@ant-design/icons";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

const { Sider, Header, Content } = Layout;

export default function TechnicianShell() {
  const [collapsed, setCollapsed] = useState(false);
  const nav = useNavigate();
  const loc = useLocation();
  const sel = loc.pathname.includes("/technician/reports") ? "reports" : "calendar";

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed} width={240} theme="dark">
        <div style={{ height: 56, display: "flex", alignItems: "center", padding: "0 16px", color: "#fff", fontWeight: 700 }}>
          {collapsed ? "TK" : "TechRent Technician"}
        </div>
        <Menu theme="dark" selectedKeys={[sel]} items={[
          { key: "calendar", icon: <CalendarOutlined />, label: "Lịch công việc", onClick: () => nav("/technician") },
          { key: "reports",  icon: <FileTextOutlined />,   label: "Tạo báo cáo",   onClick: () => nav("/technician/reports") },
        ]}/>
      </Sider>

      <Layout>
        <Header style={{ background: "#fff", display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "0 16px" }}>
          <Avatar src="https://i.pravatar.cc/150?img=13" />
        </Header>
        <Content style={{ padding: 16 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
