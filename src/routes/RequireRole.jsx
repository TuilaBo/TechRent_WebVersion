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
    // Redirect to role-specific dashboard instead of home page
    const userRole = Array.isArray(user?.roles) ? user.roles[0] : user?.role;
    
    const roleRedirects = {
      ADMIN: "/admin",
      OPERATOR: "/operator",
      TECHNICIAN: "/technician",
      CUSTOMER_SUPPORT_STAFF: "/support",
      CUSTOMER: "/",
    };

    const redirectTo = roleRedirects[userRole] || "/";
    return <Navigate to={redirectTo} replace />;
  }

  return children;
}
