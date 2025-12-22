// src/App.jsx
import { Routes, Route } from "react-router-dom";
import { ConfigProvider, theme as antdTheme } from "antd";
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
import NotificationsPage from "./pages/notificaiton/NotificationsPage.jsx";
import OtpVerify from "./pages/auth/OtpVerify.jsx";
import RentalList from "./pages/RentalList.jsx";
import FindProduct from "./components/FindProduct.jsx";
import CustomerLiveChat from "./pages/Customer/CustomerLiveChat.jsx";
import CustomerInvoice from "./pages/Customer/CustomerInvoice.jsx";
import CustomerPolicy from "./pages/Customer/CustomerPolicy.jsx";
import ReturnPage from "./pages/payment/ReturnPage.jsx";
import CancelPage from "./pages/payment/CancelPage.jsx";

import AdminShell from "./pages/admin/AdminShell.jsx";
import AdminDashboard from "./pages/admin/AdminDashboard.jsx";
import AdminOrders from "./pages/admin/AdminOrders.jsx";
import AdminProducts from "./pages/admin/AdminProducts.jsx";
import AdminMaintenancePlanner from "./pages/admin/AdminMaintenancePlanner.jsx";
import AdminMaintenanceSchedule from "./pages/admin/AdminMaintenanceSchedule.jsx";
import AdminAccounts from "./pages/admin/AdminAccounts.jsx";
import AdminTaskCategory from "./pages/admin/AdminTaskCategory.jsx";
import AdminTaskRule from "./pages/admin/AdminTaskRule.jsx";
import AdminTransactions from "./pages/admin/AdminTransactions.jsx";
import AdminContract from "./pages/admin/AdminContract.jsx";
import AdminCondition from "./pages/admin/AdminCondition.jsx";
import AdminTerm from "./pages/admin/AdminTerm.jsx";
import AdminPolicy from "./pages/admin/AdminPolicy.jsx";

import OperatorShell from "./pages/operator/OperatorShell.jsx";
import OperatorDashboard from "./pages/operator/OperatorDashboard.jsx";
import OperatorOrders from "./pages/operator/OperatorOrders.jsx";
import OperatorTasks from "./pages/operator/OperatorTasks.jsx";
import OperatorShifts from "./pages/operator/OperatorShifts.jsx";
import OperatorKyc from "./pages/operator/OperatorKYC.jsx";
import OperatorOrderDetail from "./pages/operator/OperatorOrderDetail.jsx";
import OperatorComplaint from "./pages/operator/OperatorComplaint.jsx";

import TechnicianShell from "./pages/technician/TechnicianShell.jsx";
import TechnicianCalendar from "./pages/technician/TechnicianCalendar.jsx";
import TechnicianReports from "./pages/technician/TechnicianReports.jsx";
import TechnicianQcDetail from "./pages/technician/TechnicianQcDetail.jsx";
import TechnicianPostRentalQc from "./pages/technician/TechnicianPostRentalQc.jsx";
import TechnicianHandover from "./pages/technician/TechnicianHandover.jsx";
import TechnicianHandoverCheckin from "./pages/technician/TechnicianHandoverCheckin.jsx";
import TechnicianCondition from "./pages/technician/TechnicianCondition.jsx";

import SupportDesk from "./pages/CST/SupportDesk.jsx";
import SupportShell from "./pages/CST/SupportShell.jsx";
import SupportChat from "./pages/CST/SupportChat.jsx";
import SupportTask from "./pages/CST/SupportTask.jsx";
import SupportSettlement from "./pages/CST/SupportSettlement.jsx";
import RequireRole from "./routes/RequireRole.jsx";
import BlockStaff from "./routes/BlockStaff.jsx";

export default function App() {
  return (
    <>
      <ConfigProvider
        theme={{
          algorithm: antdTheme.defaultAlgorithm,
          token: {
            colorPrimary: "#1677ff",
            borderRadius: 10,
            colorBgLayout: "#f7f9fb",
            fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
          },
          components: {
            Button: { borderRadius: 8 },
            Card: { borderRadiusLG: 12 },
            Modal: { borderRadiusLG: 12 },
            Table: { borderRadius: 8 },
            Input: { borderRadius: 8 },
            Select: { borderRadius: 8 },
          },
        }}
      >
        <Routes>
          {/* ✅ Chỉ chứa <Route> hoặc <React.Fragment> */}
          {/* Public routes - accessible to CUSTOMER and guests only, staff will be redirected */}
          <Route 
            path="/" 
            element={
              <BlockStaff>
                <LayoutRoot />
              </BlockStaff>
            }
          >
            <Route index element={<Home />} />
            <Route path="login" element={<LoginForm />} />
            <Route path="register" element={<RegisterForm />} />
            <Route path="devices/:id" element={<DeviceDetail />} />
            <Route path="category/:id" element={<RentalList />} />
            <Route path="search" element={<FindProduct />} />
            <Route path="verify-otp" element={<OtpVerify />} />
            {/* Payment callback routes - accessible to all for payment processing */}
            <Route path="payment/return" element={<ReturnPage />} />
            <Route path="payment/cancel" element={<CancelPage />} />
            {/* Route cho PayOS redirect về /cancel thay vì /payment/cancel */}
            <Route path="cancel" element={<CancelPage />} />
            <Route path="return" element={<ReturnPage />} />
            {/* Route cho VNPay redirect về /success và /failure */}
            <Route path="success" element={<ReturnPage />} />
            <Route path="failure" element={<CancelPage />} />
          </Route>

          {/* Customer-only routes - protected from staff access */}
          <Route
            path="/"
            element={
              <RequireRole role="CUSTOMER">
                <LayoutRoot />
              </RequireRole>
            }
          >
            <Route path="orders" element={<MyOrders />} />
            <Route path="cart" element={<CartPage />} />
            <Route path="checkout" element={<CheckoutPage />} />
            <Route path="kyc" element={<KycPage />} />
            <Route path="profile" element={<CustomerProfile />} />
            <Route path="invoices" element={<CustomerInvoice />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="chat" element={<CustomerLiveChat />} />
            {/* Alias để tránh 404 khi truy cập /customer/chat */}
            <Route path="customer/chat" element={<CustomerLiveChat />} />
            <Route path="policies" element={<CustomerPolicy />} />
          </Route>

          <Route
            path="/admin"
            element={
              <RequireRole role="ADMIN">
                <AdminShell />
              </RequireRole>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="maintenance" element={<AdminMaintenancePlanner />} />
            <Route path="maintenance-schedule" element={<AdminMaintenanceSchedule />} />
            <Route path="contracts" element={<AdminContract />} />
            <Route path="accounts" element={<AdminAccounts />} />
            <Route path="transactions" element={<AdminTransactions />} />
            <Route path="task-categories" element={<AdminTaskCategory />} />
            <Route path="task-rules" element={<AdminTaskRule />} />
            <Route path="conditions" element={<AdminCondition />} />
            <Route path="device-terms" element={<AdminTerm />} />
            <Route path="policies" element={<AdminPolicy />} />
          </Route>

          <Route
            path="/operator"
            element={
              <RequireRole role="OPERATOR">
                <OperatorShell />
              </RequireRole>
            }
          >
            <Route index element={<OperatorOrders />} />
            <Route path="orders" element={<OperatorOrders />} />
            <Route path="tasks" element={<OperatorTasks />} />
            <Route path="shifts" element={<OperatorShifts />} />
            <Route path="kyc" element={<OperatorKyc />} />
            <Route path="ordersdetail" element={<OperatorOrderDetail />} />
            <Route path="complaints" element={<OperatorComplaint />} />
          </Route>

          <Route
            path="/technician"
            element={
              <RequireRole role="TECHNICIAN">
                <TechnicianShell />
              </RequireRole>
            }
          >
            <Route index element={<TechnicianCalendar />} />
            <Route path="reports" element={<TechnicianReports />} />
            <Route path="conditions" element={<TechnicianCondition />} />
            <Route path="tasks/qc/:taskId" element={<TechnicianQcDetail />} />
            <Route path="tasks/post-rental-qc/:taskId" element={<TechnicianPostRentalQc />} />
            <Route path="tasks/handover/:taskId" element={<TechnicianHandover />} />
            <Route path="tasks/handover-checkin/:taskId" element={<TechnicianHandoverCheckin />} />
          </Route>

          <Route
            path="/support"
            element={
              <RequireRole role="CUSTOMER_SUPPORT_STAFF">
                <SupportShell />
              </RequireRole>
            }
          >
            <Route index element={<SupportTask />} />
            {/* <Route path="desk" element={<SupportDesk />} /> */}
            <Route path="tasks" element={<SupportTask />} />
            <Route path="settlements" element={<SupportSettlement />} />
            <Route path="chats" element={<SupportChat />} />
            <Route path="settings" element={<div>Settings (sắp có)</div>} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </ConfigProvider>
    </>
  );
}
