import { Input } from "antd";
import { SearchOutlined } from "@ant-design/icons";

export default function Hero() {
  return (
    <div
      id="hero-banner"
      className="relative h-[520px] rounded-3xl overflow-hidden flex items-center justify-center text-center"
      style={{
        backgroundImage: "url('/Banner.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Overlay sáng để chữ đen nổi bật */}
      <div className="absolute inset-0 bg-gradient-to-r from-white/80 via-white/60 to-white/0" />

      {/* Nội dung */}
      <div className="relative z-10 max-w-2xl px-4">
        <h1
          className="text-4xl md:text-5xl font-extrabold drop-shadow-none leading-tight animate-fade-in text-white"
        >
          Thuê thiết bị công nghệ nhanh chóng
        </h1>
        <p
          className="mt-4 text-lg animate-fade-in-delay text-gray=-800"
        >
         Camera, Laptop và hơn thế nữa — nhanh chóng & uy tín.
        </p>

        
      </div>

      {/* Ép đen toàn bộ text trong hero (ghi đè các rule cũ) */}
      <style>{`
        #hero-banner h1, #hero-banner p { color: #000 !important; text-shadow: none !important; }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fadeIn 0.8s ease forwards; }
        .animate-fade-in-delay { animation: fadeIn 1s ease forwards; animation-delay: .15s; }
      `}</style>
    </div>
  );
}
