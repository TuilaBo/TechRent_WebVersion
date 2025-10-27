// src/routes/RequireRole.jsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Spin } from "antd";
import { useAuth } from "../context/AuthContext";

/**
 * Bảo vệ route theo role.
 * - Nếu chưa bootstrap xong Auth -> hiển thị loading.
 * - Nếu chưa đăng nhập -> chuyển tới /login.
 * - Nếu không có role phù hợp -> đưa về trang chủ (hoặc trang 403 tuỳ bạn).
 */
export default function RequireRole({ role, children }) {
  const { isAuthenticated, user, bootstrapped } = useAuth();
  const location = useLocation();

  if (!bootstrapped) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
        <Spin />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // user.role: "ADMIN" | "OPERATOR" | ...
  // hoặc user.roles: ["ADMIN", ...]
  const hasRole =
    Array.isArray(user?.roles)
      ? user.roles.includes(role)
      : user?.role === role;

  if (!hasRole) {
    return <Navigate to="/" replace />;
  }

  return children;
}
