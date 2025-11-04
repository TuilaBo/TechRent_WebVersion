// src/layout/LayoutRoot.jsx
import { useEffect, useRef, useState, Suspense, lazy } from "react";
import { Layout, Button, Card } from "antd";
import { CustomerServiceOutlined, CloseOutlined } from "@ant-design/icons";
import { Outlet } from "react-router-dom";
import FooterBar from "../shared/FooterBar.jsx";
import Header from "../shared/Header.jsx";
import { useAuth } from "../context/AuthContext";

const ChatWidget = lazy(() => import("../components/ChatWidget.jsx"));
const { Content } = Layout;

export default function LayoutRoot() {
  const headerRef = useRef(null);
  const [chatOpen, setChatOpen] = useState(false);
  const { isAuthenticated } = useAuth();
  const [showNudge, setShowNudge] = useState(false);
  const nudgeHideTimerRef = useRef(null);

  useEffect(() => {
    let raf = null;

    const isStacked = (el) => {
      if (!el) return false;
      const root = el.firstElementChild || el;
      const pos = getComputedStyle(root).position;
      return pos === "fixed" || pos === "sticky";
    };

    const calc = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const h1 = headerRef.current?.getBoundingClientRect().height || 0;
        const total = isStacked(headerRef.current) ? h1 : 0;
        document.documentElement.style.setProperty("--header-height", `${h1}px`);
        document.documentElement.style.setProperty("--stacked-header", `${total}px`);
      });
    };

    calc();
    window.addEventListener("resize", calc);
    return () => {
      window.removeEventListener("resize", calc);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // Show nudge immediately once after login
  const prevAuthRef = useRef(false);
  useEffect(() => {
    if (isAuthenticated && !prevAuthRef.current && !chatOpen) {
      setShowNudge(true);
    }
    if (!isAuthenticated) setShowNudge(false);
    prevAuthRef.current = isAuthenticated;
  }, [isAuthenticated, chatOpen]);

  // If hidden while still logged in and widget closed, re-show after ~2.5 minutes
  useEffect(() => {
    if (!isAuthenticated || chatOpen) return;
    if (showNudge) return; // already visible
    const timer = setTimeout(() => setShowNudge(true), 150000);
    return () => clearTimeout(timer);
  }, [isAuthenticated, chatOpen, showNudge]);

  // Auto-hide nudge after 5s when shown
  useEffect(() => {
    if (!showNudge) {
      if (nudgeHideTimerRef.current) clearTimeout(nudgeHideTimerRef.current);
      return;
    }
    nudgeHideTimerRef.current = setTimeout(() => setShowNudge(false), 5000);
    return () => nudgeHideTimerRef.current && clearTimeout(nudgeHideTimerRef.current);
  }, [showNudge]);

  return (
    <Layout className="min-h-screen bg-gray-50 text-gray-900">
      <div ref={headerRef} className="header-wrapper">
        <Header />
      </div>

      <Content style={{ paddingTop: "var(--stacked-header, 0px)" }}>
        <div className="page-shell pt-0 pb-6">
          <Outlet />
        </div>
      </Content>

      <FooterBar />

      {/* Floating chat widget */}
      {isAuthenticated && (
      <div style={{ position: "fixed", right: 20, bottom: 20, zIndex: 1000 }}>
        {/* Nudge bubble */}
        {!chatOpen && showNudge && (
          <div
            style={{
              position: "absolute",
              right: 70,
              bottom: 10,
              background: "#111827",
              color: "#fff",
              padding: "8px 12px",
              borderRadius: 12,
              boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
              maxWidth: 220,
              fontSize: 13,
            }}
            role="status"
          >
            Bạn có cần trợ giúp gì không?
          </div>
        )}

        {!chatOpen && (
          <Button
            type="primary"
            shape="circle"
            size="large"
            onClick={() => { setChatOpen(true); setShowNudge(false); }}
            icon={<CustomerServiceOutlined />}
            style={{
              width: 56,
              height: 56,
              background: "#111827",
              borderColor: "#111827",
              boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
            }}
          />
        )}

        {chatOpen && (
          <Card
            // Đặt Card là flex column, body chiếm hết phần còn lại => ChatWidget luôn hiển thị đủ
            style={{
              width: 360,
              height: "min(70vh, 520px)",
              boxShadow: "0 12px 32px rgba(0,0,0,0.25)",
              display: "flex",
              flexDirection: "column",
            }}
            bodyStyle={{
              padding: 0,
              display: "flex",
              flex: 1,
              minHeight: 0, // cho phép khu vực scroll co lại
            }}
            title={
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>Hỗ trợ trực tuyến</span>
                <Button type="text" icon={<CloseOutlined />} onClick={() => setChatOpen(false)} />
              </div>
            }
          >
            <Suspense fallback={<div style={{ padding: 16 }}>Đang tải chat…</div>}>
              <ChatWidget />
            </Suspense>
          </Card>
        )}
      </div>
      )}
    </Layout>
  );
}
