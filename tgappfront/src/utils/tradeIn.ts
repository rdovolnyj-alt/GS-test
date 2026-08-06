import type { ApiOrder } from "../api/orders";

export type TradeInStatus = "pending_price" | "pending_confirm" | "confirmed" | "rejected";

export type TradeInLocal = {
  description: string;
  photos: string[];
  price: number | null;
  status: TradeInStatus;
  priceSetAt: string | null;
  confirmedAt: string | null;
};

const STORAGE_KEY = "trade_in_data";

function getTradeInMap(): Record<number, TradeInLocal> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveTradeInMap(map: Record<number, TradeInLocal>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function saveTradeInForOrder(orderId: number, data: Partial<TradeInLocal>) {
  const map = getTradeInMap();
  const existing = map[orderId] || { description: "", photos: [], price: null, status: "pending_price" as TradeInStatus, priceSetAt: null, confirmedAt: null };
  map[orderId] = { ...existing, ...data };
  saveTradeInMap(map);
}

function applyLocalTradeIn(order: ApiOrder, local: TradeInLocal): ApiOrder {
  return {
    ...order,
    trade_in: true,
    trade_in_description: order.trade_in_description || local.description || null,
    trade_in_photos: (order.trade_in_photos && order.trade_in_photos.length > 0)
      ? order.trade_in_photos
      : local.photos || [],
    trade_in_price: order.trade_in_price ?? local.price,
  };
}

export function mergeTradeInData(orders: ApiOrder[]): ApiOrder[] {
  const map = getTradeInMap();
  return orders.map((order) => {
    const local = map[order.id];
    return local ? applyLocalTradeIn(order, local) : order;
  });
}

export function mergeTradeInSingle(order: ApiOrder): ApiOrder {
  const map = getTradeInMap();
  const local = map[order.id];
  return local ? applyLocalTradeIn(order, local) : order;
}

export function hasPendingTradeInConfirm(): boolean {
  const map = getTradeInMap();
  return Object.values(map).some((t) => t.status === "pending_confirm");
}

export function getTradeInStatus(orderId: number): TradeInStatus | null {
  const map = getTradeInMap();
  return map[orderId]?.status ?? null;
}
