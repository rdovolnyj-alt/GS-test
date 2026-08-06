import { api } from "./client";

export type Promo = {
  id: number;
  gift_name: string;
  gift_image: string | null;
  gift_price: number;
  target_type: "product" | "category" | "all";
  target_product_id: number | null;
  target_product_name: string | null;
  target_category_id: number | null;
  target_category_name: string | null;
  min_total: number | null;
  active: boolean;
  created_at?: string;
  updated_at?: string;
};

export type PromoInput = {
  gift_name: string;
  gift_image?: string | null;
  gift_price?: number;
  target_type: "product" | "category" | "all";
  target_product_id?: number | null;
  target_category_id?: number | null;
  min_total?: number | null;
  active?: boolean;
};

export type Gift = {
  name: string;
  image: string | null;
  price: number;
};

export async function fetchPromos(): Promise<Promo[]> {
  return api.get<Promo[]>("/api/promos");
}

export async function createPromo(data: PromoInput): Promise<Promo> {
  return api.post<Promo>("/api/promos", data);
}

export async function updatePromo(id: number, data: Partial<PromoInput>): Promise<Promo> {
  return api.patch<Promo>(`/api/promos/${id}`, data);
}

export async function deletePromo(id: number): Promise<void> {
  return api.delete(`/api/promos/${id}`);
}

export async function computeGifts(cart: {
  items: { product_id: number; quantity: number; price_at_purchase: number }[];
  total_price: number;
}): Promise<{ gifts: Gift[] }> {
  return api.post<{ gifts: Gift[] }>("/api/promos/compute", cart);
}
