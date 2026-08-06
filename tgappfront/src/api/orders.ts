import { api } from "./client";
import type { ApiProduct } from "../types/product";

export type OrderItemData = {
  product_id: number;
  quantity: number;
  price_at_purchase: number;
  selected_attributes?: Record<string, string | number> | null;
};

export type CreateOrderPayload = {
  items: OrderItemData[];
  total_price: number;
  customer_name?: string | null;
  delivery_info?: string | null;
  delivery_lat?: number | null;
  delivery_lng?: number | null;
  phone?: string | null;
  trade_in?: boolean;
  trade_in_description?: string | null;
  trade_in_photos?: string[];
  accepted_gift_names?: string[] | null;
};

export type ApiOrderItem = {
  id: number;
  order_id: number;
  product_id: number | null;
  quantity: number;
  price_at_purchase: number;
  purchase_price: number | null;
  selected_attributes: Record<string, string | number> | null;
  product_name: string | null;
  product_image: string | null;
  product: ApiProduct | null;
};

export type ApiOrder = {
  id: number;
  user_id: number | null;
  courier_id: number | null;
  courier_name: string | null;
  courier_phone: string | null;
  courier_login: string | null;
  status: "created" | "shipped" | "completed" | "cancelled";
  total_price: number;
  delivery_info: string | null;
  customer_name: string | null;
  phone: string | null;
  confirmation_code: string | null;
  delivery_imei: string | null;
  delivery_photo_urls: string[];
  delivered_at: string | null;
  archived_at: string | null;
  trade_in: boolean;
  trade_in_description: string | null;
  trade_in_photos: string[];
  trade_in_price: number | null;
  gifts: { name: string; image: string | null; price: number }[];
  created_at: string;
  updated_at: string;
  items: ApiOrderItem[];
  user_email: string | null;
  user_username: string | null;
};

export type CourierInfo = {
  id: number;
  name: string;
  phone: string | null;
  login: string;
  password: string | null;
  created_at: string | null;
};

export type CourierCreated = CourierInfo & {
  password: string;
};

export async function createCourier(data: { name: string; phone?: string }): Promise<CourierCreated> {
  return api.post<CourierCreated>("/api/couriers", data);
}

export async function fetchCouriers(): Promise<CourierInfo[]> {
  return api.get<CourierInfo[]>("/api/couriers");
}

export async function deleteCourier(id: number): Promise<void> {
  await api.delete(`/api/couriers/${id}`);
}

export async function updateCourier(id: number, data: { name?: string; phone?: string }): Promise<CourierInfo> {
  return api.patch<CourierInfo>(`/api/couriers/${id}`, data);
}

export async function assignCourier(orderId: number, courierId: number): Promise<void> {
  await api.patch(`/api/orders/${orderId}/courier`, { courier_id: courierId });
}

export async function createOrder(data: CreateOrderPayload): Promise<ApiOrder> {
  return api.post<ApiOrder>("/api/orders", data);
}

export async function fetchOrders(params?: {
  status?: string;
  offset?: number;
  limit?: number;
}): Promise<{ items: ApiOrder[]; total: number }> {
  const q = new URLSearchParams();
  if (params?.status) q.set("status", params.status);
  if (params?.offset) q.set("offset", String(params.offset));
  if (params?.limit) q.set("limit", String(params.limit));
  const qs = q.toString();
  return api.get<{ items: ApiOrder[]; total: number }>(`/api/orders${qs ? `?${qs}` : ""}`);
}

export async function fetchOrder(id: number): Promise<ApiOrder> {
  return api.get<ApiOrder>(`/api/orders/${id}`);
}

export async function updateOrderStatus(id: number, status: string): Promise<ApiOrder> {
  return api.patch<ApiOrder>(`/api/orders/${id}`, { status });
}

export async function fetchOrdersByIds(ids: number[]): Promise<ApiOrder[]> {
  if (ids.length === 0) return [];
  return api.get<ApiOrder[]>(`/api/orders/bulk?ids=${ids.join(",")}`);
}

export async function deleteOrder(id: number): Promise<void> {
  await api.delete(`/api/orders/${id}`);
}

export async function fetchOrdersUnread(): Promise<{ unread: boolean }> {
  return api.get<{ unread: boolean }>("/api/orders/unread");
}

export async function markOrdersRead(): Promise<{ ok: boolean }> {
  return api.post<{ ok: boolean }>("/api/orders/read", {});
}

export async function updateOrderTradeInPrice(id: number, tradeInPrice: number): Promise<ApiOrder> {
  return api.patch<ApiOrder>(`/api/orders/${id}`, { trade_in_price: tradeInPrice });
}

export async function fetchCourierMyOrders(): Promise<ApiOrder[]> {
  return api.get<ApiOrder[]>("/api/couriers/me/orders");
}

export async function verifyConfirmationCode(
  orderId: number,
  code: string
): Promise<{ ok: boolean; order_id: number }> {
  return api.post<{ ok: boolean; order_id: number }>(`/api/orders/${orderId}/verify-code`, { confirmation_code: code });
}

export async function completeDelivery(
  orderId: number,
  data: { confirmation_code: string; imei: string; photo_urls: string[] }
): Promise<{ ok: boolean; order_id: number; delivered_at: string }> {
  return api.post<{ ok: boolean; order_id: number; delivered_at: string }>(
    `/api/orders/${orderId}/complete-delivery`,
    data
  );
}
