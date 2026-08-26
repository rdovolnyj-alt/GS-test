import type { Product, ApiProduct } from "../types/product";

export type Category = {
  id: number;
  name: string;
  image: string;
  items: Product[];
  featured: Product;
};

export function mapApiProduct(p: ApiProduct): Product {
  // Цена с маржой, либо (если не задана) цена закупки — по умолчанию для покупателя
  const effectivePrice = p.price != null && p.price > 0 ? p.price : (p.purchase_price ?? 0);
  return {
    id: String(p.id),
    title: p.name,
    category: p.category?.name ?? "",
    price: effectivePrice,
    images: p.images.length > 0
      ? p.images.map((img) => img.image_url)
      : ["/placeholder.png"],
    attributes: p.attributes,
  };
}

// Для некоторых моделей (например, Яндекс Станции) вариант «С Часами» указан
// в прайсе без явной пометки, а «Без Часов» — с пометкой. Если в рамках одной
// модели есть товары с атрибутом clock, то у остальных вариантов этой модели
// отсутствующий clock трактуем как «С Часами», чтобы в карточке можно было
// выбирать «с часами» / «без часов».
function normalizeClockAttributes(items: Product[]): Product[] {
  const groups = new Map<string, Product[]>();
  for (const p of items) {
    const list = groups.get(p.title) ?? [];
    list.push(p);
    groups.set(p.title, list);
  }

  const result: Product[] = [];
  for (const group of groups.values()) {
    const hasClock = group.some((p) => {
      const c = p.attributes?.clock;
      return c !== undefined && c !== null && String(c).trim() !== "";
    });
    if (!hasClock) {
      result.push(...group);
      continue;
    }
    for (const p of group) {
      const c = p.attributes?.clock;
      if (c === undefined || c === null || String(c).trim() === "") {
        result.push({ ...p, attributes: { ...p.attributes, clock: "С Часами" } });
      } else {
        result.push(p);
      }
    }
  }
  return result;
}

export function buildCategories(
  apiCategories: { id: number; name: string; product_count?: number }[],
  apiProducts: ApiProduct[],
): Category[] {
  const productsByCategory = new Map<number, Product[]>();
  for (const p of apiProducts) {
    if (!productsByCategory.has(p.category_id)) {
      productsByCategory.set(p.category_id, []);
    }
    productsByCategory.get(p.category_id)!.push(mapApiProduct(p));
  }

  return apiCategories
    .filter((cat) => (cat.product_count ?? 0) > 0)
    .map((cat) => {
      const items = normalizeClockAttributes(productsByCategory.get(cat.id) ?? []);
      const withImage = items.find((p) => p.images[0] && p.images[0] !== "/placeholder.png");
      const featured = items.find((p) => /pro\s*16/i.test(p.title))
        ?? items.find((p) => /pro/i.test(p.title))
        ?? withImage
        ?? items[0];
      return {
        id: cat.id,
        name: cat.name,
        image: featured?.images[0] ?? "/placeholder.png",
        items,
        featured,
      };
    })
    .filter((cat) => cat.featured);
}
