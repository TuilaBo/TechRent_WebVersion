import { Button } from "antd";
import React from "react";
import { useNavigate } from "react-router-dom";

export default function Hero() {
  const navigate = useNavigate();

  const scrollToProducts = () => {
    try {
      const el = document.getElementById("home-products");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        // fallback: về home rồi scroll
        navigate("/");
        setTimeout(() => {
          const el2 = document.getElementById("home-products");
          if (el2) el2.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 50);
      }
    } catch {}
  };

  return (
    <div
      id="hero-banner"
      className="relative min-h-[460px] h-[56vw] max-h-[520px] rounded-3xl overflow-hidden flex items-center justify-center text-center"
      style={{
        backgroundImage: "url('/Banner.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Overlay gradient trắng/xám (giữ mạnh hơn để text nổi rõ) */}
      <div className="absolute inset-0" style={{background: "linear-gradient(120deg, rgba(255,255,255,0.94) 60%, rgba(255,255,255,0.79) 100%)"}} />

      {/* Nội dung nằm trực tiếp trên banner */}
      <div
        className="relative z-10 max-w-2xl w-full px-4 flex flex-col items-center justify-center"
        style={{ marginTop: 36, marginBottom: 40 }}
      >
        <h1
          style={{
            fontSize: '2.5rem',
            fontWeight: 800,
            lineHeight: 1.25,
            marginBottom: 18,
            color: '#101012',
            letterSpacing: -1,
            textShadow: 'none',
            animation: 'fadeIn 0.9s ease',
          }}
        >
          Thuê thiết bị công nghệ nhanh chóng
        </h1>
        <div
          style={{
            fontSize: 19,
            color: '#333',
            marginBottom: 10,
            fontWeight: 500,
            animation: 'fadeIn 1.15s',
          }}
        >
          Camera, Laptop và hơn thế nữa — nhanh chóng & uy tín.
        </div>

        {/* CTA Button */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8, marginBottom: 8 }}>
          <Button
            type="primary"
            size="large"
            onClick={scrollToProducts}
            style={{
              borderRadius: 50,
              background: '#000',
              border: 'none',
              fontWeight: 600,
              padding: '0 30px',
              height: 46,
              transition: 'background .2s, color .2s',
            }}
            onMouseOver={e => { e.target.style.background='#fff'; e.target.style.color='#000'; }}
            onMouseOut={e => { e.target.style.background='#000'; e.target.style.color='#fff'; }}
          >
            Khám phá sản phẩm
          </Button>
        </div>
      </div>

      <style>{`
        @media (max-width: 600px){
          #hero-banner h1 { font-size: 1.6rem !important; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
