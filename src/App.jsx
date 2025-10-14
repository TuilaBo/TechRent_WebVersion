// src/App.jsx
import { Routes, Route } from "react-router-dom";
import LayoutRoot from "./layout/LayoutRoot.jsx";

import Home from "./pages/Home.jsx";
import NotFound from "./pages/NotFound.jsx";
import LoginForm from "./pages/auth/LoginForm.jsx";
import RegisterForm from "./pages/auth/RegisterForm.jsx";
import DeviceDetail from "./pages/DeviceDetail.jsx";
import MyOrders from "./pages/orders/MyOrders.jsx";
import CartPage from "./pages/cart/CartPage.jsx";
import CheckoutPage from "./pages/cart/CheckoutPage.jsx";
import KycPage from "./pages/KYC/KycPage.jsx";
import CustomerProfile from "./pages/CustomerProfile.jsx";

import AdminShell from "./pages/admin/AdminShell.jsx";
import AdminDashboard from "./pages/admin/AdminDashboard.jsx";
import AdminOrders from "./pages/admin/AdminOrders.jsx";
import AdminProducts from "./pages/admin/AdminProducts.jsx";
import AdminMaintenancePlanner from "./pages/admin/AdminMaintenancePlanner.jsx";
import AdminKyc from "./pages/admin/AdminKyc.jsx";
import AdminAccounts from "./pages/admin/AdminAccounts.jsx";

import OperatorShell from "./pages/operator/OperatorShell.jsx";
import OperatorDashboard from "./pages/operator/OperatorDashboard.jsx";
import OperatorOrders from "./pages/operator/OperatorOrders.jsx";
import OperatorTasks from "./pages/operator/OperatorTasks.jsx";
import OperatorShifts from "./pages/operator/OperatorShifts.jsx";

import TechnicianShell from "./pages/technician/TechnicianShell.jsx";
import TechnicianCalendar from "./pages/technician/TechnicianCalendar.jsx";
import TechnicianReports from "./pages/technician/TechnicianReports.jsx";
import TechnicianQcDetail from "./pages/technician/TechnicianQcDetail.jsx";

import SupportDesk from "./pages/CST/SupportDesk.jsx";
import SupportShell from "./pages/CST/SupportShell.jsx";
export default function App() {
  return (
    <Routes>
      {/* ====== PUBLIC (có LayoutRoot) ====== */}
      <Route path="/" element={<LayoutRoot />}>
        <Route index element={<Home />} />
        <Route path="login" element={<LoginForm />} />
        <Route path="register" element={<RegisterForm />} />
        <Route path="devices/:id" element={<DeviceDetail />} />
        <Route path="orders" element={<MyOrders />} />
        <Route path="cart" element={<CartPage />} />
        <Route path="checkout" element={<CheckoutPage />} />
        <Route path="kyc" element={<KycPage />} />
        <Route path="profile" element={<CustomerProfile />} />
      </Route>

      {/* ====== ADMIN (KHÔNG dùng LayoutRoot) ====== */}
      <Route path="/admin" element={<AdminShell />}>
        <Route index element={<AdminDashboard />} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="products" element={<AdminProducts />} />
        <Route path="maintenance" element={<AdminMaintenancePlanner />} />
        <Route path="kyc" element={<AdminKyc />} />
        <Route path="accounts" element={<AdminAccounts />} />
      </Route>
      {/* ====== OPERATOR (KHÔNG dùng LayoutRoot) ====== */}
      <Route path="/operator" element={<OperatorShell />}>
        <Route index element={<OperatorDashboard />} />
        <Route path="orders" element={<OperatorOrders />} />
        <Route path="tasks" element={<OperatorTasks />} />
        <Route path="shifts" element={<OperatorShifts />} />
      </Route>

        {/* ====== TECHNICIAN (KHÔNG dùng LayoutRoot) ====== */}
        <Route path="/technician" element={<TechnicianShell />}>
        <Route index element={<TechnicianCalendar />} />
        <Route path="reports" element={<TechnicianReports />} />
        <Route path="tasks/qc/:taskId" element={<TechnicianQcDetail />} />
        </Route>

        {/* ====== CUSTOMER SUPPORT (KHÔNG dùng LayoutRoot) ====== */}
        <Route path="/support" element={<SupportShell />}>
        <Route index element={<SupportDesk />} />
        <Route path="desk" element={<SupportDesk />} />
        <Route path="chats" element={<div>Live Chats (sắp có)</div>} />
        <Route path="settings" element={<div>Settings (sắp có)</div>} />
        </Route>
      {/* ====== 404 cho mọi route còn lại ====== */}

        
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
