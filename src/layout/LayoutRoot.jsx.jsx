import { useEffect, useRef } from "react";
import { Layout } from "antd";
import { Outlet } from "react-router-dom";
import FooterBar from "../shared/FooterBar.jsx";
import CategoryGrid from "../components/CategoryGrid.jsx";
import Header from "../shared/Header.jsx";

const { Content } = Layout;

export default function LayoutRoot() {
  const headerRef = useRef(null);
  const categoriesRef = useRef(null);

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
        // Category hiện để static, không cộng vào biến stacked
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

  return (
    <Layout className="min-h-screen bg-gray-50 text-gray-900">
      <div ref={headerRef} className="header-wrapper">
        <Header />
      </div>

      <div ref={categoriesRef} className="category-wrapper category-grid-wrap category-no-seam">
        <CategoryGrid />
      </div>

      {/* Nội dung dưới sẽ bắt đầu ngay dưới header (nếu header sticky) */}
      <Content style={{ paddingTop: "var(--stacked-header, 0px)" }}>
        <div className="page-shell pt-0 pb-6">
          <Outlet />
        </div>
      </Content>

      <FooterBar />
    </Layout>
  );
}
