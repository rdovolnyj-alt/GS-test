import type { Product } from "../types/product";
import { ProductCard } from "../components/ProductCard";

type Props = {
  categoryName: string;
  items: Product[];
  onSelectProduct: (variants: Product[]) => void;
};

function getUniqueModels(items: Product[]): Product[] {
  const seen = new Map<string, Product>();
  for (const p of items) {
    if (!seen.has(p.title)) {
      seen.set(p.title, p);
    }
  }
  return Array.from(seen.values());
}

export function SubcategoryPage({ categoryName, items, onSelectProduct }: Props) {
  const models = getUniqueModels(items);

  function handleClick(title: string) {
    const variants = items.filter((p) => p.title === title);
    onSelectProduct(variants);
  }

  return (
    <section>
      <div className="mb-6">
        <h2 className="text-2xl font-semibold">{categoryName}</h2>
        <p className="mt-1 text-sm text-[var(--c-text-50)]">Выберите модель</p>
      </div>
      <div className="grid grid-cols-2 gap-5">
        {models.map((product) => (
          <ProductCard
            key={product.title}
            product={product}
            variant="subcategory"
            onClick={() => handleClick(product.title)}
          />
        ))}
      </div>
    </section>
  );
}
