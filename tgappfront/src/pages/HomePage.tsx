import { ProductCard } from "../components/ProductCard";
import type { Category } from "../data/categories";

type Props = {
  categories: Category[];
  loading: boolean;
  onOpenCategory: (category: Category) => void;
};

export function HomePage({ categories, loading, onOpenCategory }: Props) {
  if (loading) {
    return (
      <section className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--c-border)] border-t-[var(--c-accent)]" />
      </section>
    );
  }

  if (categories.length === 0) {
    return (
      <section className="py-20 text-center">
        <p className="text-[var(--c-text-50)]">Каталог пока пуст</p>
      </section>
    );
  }

  return (
    <section>
      <div className="grid grid-cols-2 gap-5">
        {categories.map((cat) => (
          <ProductCard
            key={cat.id}
            product={cat.featured}
            variant="category"
            onClick={() => onOpenCategory(cat)}
          />
        ))}
      </div>
    </section>
  );
}
