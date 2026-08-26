import type { ApiProduct, Category } from "../types/product";
import { api, getAuthHeaders } from "./client";

type ImageInput = { image_url: string; is_main: boolean };

export type ProductInput = {
  name: string;
  price?: number | null;
  purchase_price?: number | null;
  is_available?: boolean;
  quantity?: number;
  category_id: number;
  attributes?: Record<string, string | number>;
  images?: ImageInput[];
};

export async function fetchProducts(params?: {
  category_ids?: string;
  search?: string;
  offset?: number;
  limit?: number;
}): Promise<{ items: ApiProduct[]; total: number }> {
  const q = new URLSearchParams();
  if (params?.category_ids) q.set("category_ids", params.category_ids);
  if (params?.search) q.set("search", params.search);
  if (params?.offset) q.set("offset", String(params.offset));
  if (params?.limit) q.set("limit", String(params.limit));
  const qs = q.toString();
  return api.get<{ items: ApiProduct[]; total: number }>(`/api/products${qs ? `?${qs}` : ""}`);
}

export async function createProduct(data: ProductInput): Promise<ApiProduct> {
  return api.post<ApiProduct>("/api/products", data);
}

export async function updateProduct(id: number, data: Partial<ProductInput>): Promise<ApiProduct> {
  return api.put<ApiProduct>(`/api/products/${id}`, data);
}

export async function deleteProduct(id: number): Promise<void> {
  return api.delete(`/api/products/${id}`);
}

export async function fetchCategories(): Promise<Category[]> {
  return api.get<Category[]>("/api/categories");
}

export async function addProductImage(productId: number, imageUrl: string, isMain = false): Promise<void> {
  await api.post(`/api/products/${productId}/images`, { image_url: imageUrl, is_main: isMain });
}

export async function findSimilarProducts(name: string, color: string, excludeId: number): Promise<number[]> {
  return api.post<number[]>("/api/products/similar", { name, color, exclude_id: excludeId });
}

export type PhotoGroup = {
  id: number;
  name: string;
  color: string;
  images: string[];
  product_count: number;
  category_ids: number[];
  categories: string[];
  created_at?: string;
  updated_at?: string;
};

export async function fetchPhotoGroups(): Promise<PhotoGroup[]> {
  return api.get<PhotoGroup[]>("/api/products/photo-groups");
}

export async function addPhotoGroupImages(groupId: number, urls: string[]): Promise<PhotoGroup> {
  return api.post<PhotoGroup>(`/api/products/photo-groups/${groupId}/images`, { images: urls });
}

export async function removePhotoGroupImage(groupId: number, imageUrl: string): Promise<PhotoGroup> {
  return api.delete<PhotoGroup>(`/api/products/photo-groups/${groupId}/images?image_url=${encodeURIComponent(imageUrl)}`);
}

export async function deletePhotoGroup(groupId: number): Promise<{ ok: boolean }> {
  return api.delete<{ ok: boolean }>(`/api/products/photo-groups/${groupId}`);
}

export async function deleteAllPhotoGroups(): Promise<{ ok: boolean }> {
  return api.delete<{ ok: boolean }>("/api/products/photo-groups");
}

export type ExcelSheet = {
  name: string;
  can_parse: boolean;
};

export async function previewExcelSheets(file: File): Promise<{ sheets: ExcelSheet[] }> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/products/excel-preview", { method: "POST", headers: getAuthHeaders(), body: formData });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json();
}

export async function importProductsExcel(file: File, sheets: string[]): Promise<{ imported: number; details: { category: string; created: number; updated: number; unchanged: number; removed: number; hidden: number; total: number; category_id: number }[] }> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("sheets", sheets.join(","));
  const res = await fetch("/api/products/import-excel", { method: "POST", headers: getAuthHeaders(), body: formData });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
    return res.json();
}

