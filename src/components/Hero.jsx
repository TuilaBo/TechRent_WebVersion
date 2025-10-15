import { Button } from "antd";
import { ArrowRightOutlined } from "@ant-design/icons";

export default function Hero() {
  return (
    <div
      id="hero-banner"
      className="relative h-[520px] rounded-3xl overflow-hidden flex items-center justify-center text-center"
      style={{
        backgroundImage:
          "url(https://theme.hstatic.net/200000038580/1001314180/14/slideshow_1.jpg?v=52)",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-transparent" />

      {/* Nội dung */}
      <div className="relative z-10 max-w-2xl px-4">
        <h1
          className="text-4xl md:text-5xl font-extrabold drop-shadow-xl leading-tight animate-fade-in"
          style={{ color: "#fff", textShadow: "0 2px 10px rgba(0,0,0,.45)" }}
        >
          Thuê thiết bị công nghệ hiện đại
        </h1>
        <p
          className="mt-4 text-lg animate-fade-in-delay"
          style={{ color: "#fff", textShadow: "0 2px 8px rgba(0,0,0,.4)" }}
        >
          VR, Camera, Gaming, Laptop và hơn thế nữa — nhanh chóng & uy tín.
        </p>
      </div>

      {/* Ép trắng (nếu có rule global dùng !important) */}
      <style>{`
        #hero-banner h1, #hero-banner p { color: #fff !important; }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fadeIn 0.8s ease forwards; }
        .animate-fade-in-delay { animation: fadeIn 1s ease forwards; }
      `}</style>
    </div>
  );
}
