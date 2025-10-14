// src/pages/Home.jsx
import Hero from "../components/Hero.jsx";
import ProductCard from "../components/ProductCard.jsx";
import ProductCardfavourite from "../components/ProductCardfavourite.jsx";
export default function Home() {
  return (
    <div className="space-y-12">
      {/* Kéo banner lên bằng negative margin = - --stacked-header để loại gap */}
      <div
        className="full-bleed"
        style={{ marginTop: `calc(-1 * var(--stacked-header, 0px) - 1px)` }} // Kết hợp -mt-px gốc, + calc dynamic
      >
        <Hero />
      </div>

      {/* Các khối còn lại */}
      <section className="space-y-6">
        <ProductCardfavourite />
      </section>
      <section className="space-y-6">
        <ProductCard />
      </section>
    </div>
  );
}
