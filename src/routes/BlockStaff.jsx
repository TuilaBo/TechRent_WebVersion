// src/routes/BlockStaff.jsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Spin } from "antd";
import { useAuth } from "../context/AuthContext";

/**
 * Chặn staff (ADMIN, OPERATOR, TECHNICIAN, CUSTOMER_SUPPORT_STAFF) 
 * khỏi các trang public dành cho customer.
 * - Nếu user là staff -> redirect về dashboard của họ.
 * - Nếu user là CUSTOMER hoặc chưa đăng nhập -> cho phép truy cập.
 */

const STAFF_ROLES = ["ADMIN", "OPERATOR", "TECHNICIAN", "CUSTOMER_SUPPORT_STAFF"];

const ROLE_REDIRECTS = {
  ADMIN: "/admin",
  OPERATOR: "/operator",
  TECHNICIAN: "/technician",
  CUSTOMER_SUPPORT_STAFF: "/support",
};

export default function BlockStaff({ children }) {
  const { isAuthenticated, user, bootstrapped } = useAuth();
  const location = useLocation();

  if (!bootstrapped) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
        <Spin />
      </div>
    );
  }

  // Nếu chưa đăng nhập -> cho phép truy cập
  if (!isAuthenticated || !user) {
    return children;
  }

  // Kiểm tra xem user có phải là staff không
  const userRole = Array.isArray(user?.roles) ? user.roles[0] : user?.role;
  const isStaff = STAFF_ROLES.includes(userRole);

  if (isStaff) {
    // Redirect staff về dashboard của họ
    const redirectTo = ROLE_REDIRECTS[userRole] || "/admin";
    return <Navigate to={redirectTo} replace />;
  }

  // CUSTOMER hoặc role khác -> cho phép truy cập
  return children;
}
