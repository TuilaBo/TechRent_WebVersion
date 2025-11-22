// src/components/ScrollToTop.jsx
import { useEffect, useLayoutEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

export default function ScrollToTop({ smooth = false }) {
  const { pathname, hash } = useLocation();
  const navType = useNavigationType();

  // Tắt khôi phục cuộn mặc định của trình duyệt
  useLayoutEffect(() => {
    if ("scrollRestoration" in window.history) {
      const prev = window.history.scrollRestoration;
      window.history.scrollRestoration = "manual";
      return () => {
        window.history.scrollRestoration = prev;
      };
    }
  }, []);

  useEffect(() => {
    // Nếu có hash (#id) thì cuộn tới phần tử tương ứng
    if (hash) {
      const el = document.querySelector(hash);
      if (el) {
        el.scrollIntoView({
          behavior: smooth ? "smooth" : "auto",
          block: "start",
        });
        return;
      }
    }

    // Với mọi lần chuyển trang, luôn kéo lên đầu
    const doScrollTop = () => {
      // ép cả 3 “điểm” cuộn
      window.scrollTo({ top: 0, left: 0, behavior: smooth ? "smooth" : "auto" });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };

    // Chờ tới frame tiếp theo để đảm bảo DOM đã render xong
    const id = requestAnimationFrame(() => {
      // thêm 1 frame nữa cho chắc (antd Layout đôi khi tính lại height trễ)
      const id2 = requestAnimationFrame(doScrollTop);
      return () => cancelAnimationFrame(id2);
    });

    return () => cancelAnimationFrame(id);
  }, [pathname, hash, navType, smooth]);

  return null;
}
