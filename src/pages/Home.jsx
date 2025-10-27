// src/pages/Home.jsx
import Hero from "../components/Hero.jsx";
import ProductCard from "../components/ProductCard.jsx";
import BrowseCategories from "../components/BrowseCategories.jsx";
export default function Home() {
  return (
    <div className="space-y-12">
      <div
        className="full-bleed"
        style={{ marginTop: `calc(-1 * var(--stacked-header, 0px) - 1px)` , marginBottom: '30px'}} // Kết hợp -mt-px gốc, + calc dynamic
      >
        <Hero />
      </div>
      <section className="space-y-6">
        <BrowseCategories />
      </section>
      <section className="space-y-4">
        <ProductCard />
      </section>
      
    </div>
  );
}
