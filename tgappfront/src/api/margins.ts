import { api } from "./client";

export type Margin = {
  id: number;
  margin_type: "percent" | "fixed";
  value: number;
  target_category_id: number;
  target_category_name: string | null;
  products_count?: number;
  active: boolean;
  created_at?: string;
  updated_at?: string;
};

export type MarginInput = {
  margin_type: "percent" | "fixed";
  value: number;
  target_category_id: number;
  active?: boolean;
};

export type MarginApplyStats = {
  updated: number;
  skipped_no_cost: number;
};

export async function fetchMargins(): Promise<Margin[]> {
  return api.get<Margin[]>("/api/admin/margins");
}

export async function createMargin(data: MarginInput): Promise<Margin> {
  return api.post<Margin>("/api/admin/margins", data);
}

export async function updateMargin(id: number, data: Partial<MarginInput>): Promise<Margin> {
  return api.patch<Margin>(`/api/admin/margins/${id}`, data);
}

export async function deleteMargin(id: number): Promise<void> {
  return api.delete(`/api/admin/margins/${id}`);
}
