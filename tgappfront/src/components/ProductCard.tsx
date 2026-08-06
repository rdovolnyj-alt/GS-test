import type { Product } from "../types/product";

type Props = {
  product: Product;
  onClick: () => void;
  variant?: "category" | "subcategory";
};

export function ProductCard({ product, onClick, variant = "category" }: Props) {
  if (!product) return null;
  return (
    <article
      onClick={onClick}
      className="group cursor-pointer overflow-hidden rounded-[1.8rem] border border-[var(--c-border)] bg-[var(--c-surface)] transition hover:-translate-y-1 hover:border-[var(--c-accent-border-hover)] hover:bg-[var(--c-surface-hover)]"
    >
      <div className="relative select-none">
        <img
          src={product.images[0]}
          alt={product.title}
          className="h-60 w-full object-cover transition duration-500 group-hover:scale-[1.03]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        {variant === "category" ? (
          <div className="absolute bottom-4 left-4 rounded-full border border-[var(--c-border)] bg-[var(--c-surface-alt)] px-3 py-1 text-xs tracking-[0.25em] text-[var(--c-text-75)] backdrop-blur">
            {product.category}
          </div>
        ) : (
          <div className="absolute bottom-4 left-4 right-4">
            <h3 className="text-lg font-semibold text-white drop-shadow-lg">
              {product.title}
            </h3>
          </div>
        )}
      </div>
    </article>
  );
}
