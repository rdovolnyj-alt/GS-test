import { useEffect, useState, useCallback } from "react";
import type { ApiOrder } from "../api/orders";
import { fetchOrdersByIds, fetchOrders, updateOrderStatus } from "../api/orders";
import { formatPrice, formatDate, formatDateTime } from "../utils/format";
import { ATTR_LABELS, STATUS_COLORS, USER_STATUS_LABELS } from "../utils/labels";
import { mergeTradeInData, saveTradeInForOrder, getTradeInStatus } from "../utils/tradeIn";
import { useAuth } from "../context/useAuth";
import { Truck, Star } from "lucide-react";

function getStoredOrderIds(): number[] {
  try {
    const raw = localStorage.getItem("order_ids");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

type Props = {
  onBack: () => void;
  onOpenReviews?: () => void;
};

export function MyOrdersPage({ onBack, onOpenReviews }: Props) {
  const { user } = useAuth();
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const loadOrders = useCallback(() => {
    const promise = user
      ? fetchOrders({ limit: 100 }).then((d) => d.items)
      : (() => {
          const ids = getStoredOrderIds();
          return ids.length > 0
            ? fetchOrdersByIds(ids).catch(() => fetchOrders({ limit: 100 }).then((d) => d.items))
            : fetchOrders({ limit: 100 }).then((d) => d.items);
        })();
    promise
      .then((data) =>
        setOrders(
          mergeTradeInData(data).map((o) =>
            user && o.user_id === user.id
              ? { ...o, customer_name: user.name, phone: user.phone }
              : o,
          ),
        ),
      )
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  async function handleCancel(orderId: number) {
    if (!confirm("Отменить заказ?")) return;
    try {
      await updateOrderStatus(orderId, "cancelled");
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: "cancelled" as const } : o))
      );
    } catch (e) {
      console.error("Failed to cancel order:", e);
    }
  }

  function handleConfirmTradeInPrice(orderId: number) {
    saveTradeInForOrder(orderId, { status: "confirmed", confirmedAt: new Date().toISOString() });
    setOrders((prev) => [...prev]);
  }

  function handleRejectTradeInPrice(orderId: number) {
    saveTradeInForOrder(orderId, { status: "rejected" });
    setOrders((prev) => [...prev]);
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <div className="rounded-[2rem] border border-[var(--c-border)] bg-[var(--c-surface)] p-5 backdrop-blur-xl">
        <h3 className="mb-4 text-2xl font-semibold">Мои заказы</h3>

        {loading ? (
          <p className="text-sm text-[var(--c-text-50)] text-center py-8">Загрузка...</p>
        ) : orders.length === 0 ? (
          <div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface-alt)] p-8 text-center text-[var(--c-text-45)]">
            У вас пока нет заказов.
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => {
              const isExpanded = expandedId === order.id;
              const canCancel = order.status !== "cancelled" && order.status !== "completed" && order.status !== "shipped";
              return (
                <div
                  key={order.id}
                  className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface-alt)] p-4"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span className="font-semibold text-[var(--c-text)]">Заказ #{order.id}</span>
                      <span className={`ml-3 inline-flex items-center gap-1 rounded-full border px-3 py-0.5 text-xs font-medium ${STATUS_COLORS[order.status] ?? ""}`}>
                        {order.status === "shipped" && <Truck size={12} />}
                        {USER_STATUS_LABELS[order.status] ?? order.status}
                      </span>
                      {order.trade_in && (
                        <span className="ml-2 inline-flex items-center rounded-full border border-[var(--c-accent-border)] bg-[var(--c-accent-bg)] px-3 py-0.5 text-xs font-medium text-[var(--c-accent-soft)]">
                          Trade-In
                          {(() => {
                            const tiStatus = getTradeInStatus(order.id);
                            if (tiStatus === "pending_confirm") return <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-yellow-400" />;
                            if (tiStatus === "confirmed") return <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-green-400" />;
                            if (tiStatus === "rejected") return <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-red-400" />;
                            return <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-[var(--c-text-40)]" />;
                          })()}
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-[var(--c-text-50)]">
                      {order.status === "completed" && order.delivered_at
                        ? <>Доставлен {formatDateTime(order.delivered_at)}</>
                        : formatDate(order.created_at)}
                    </span>
                  </div>

                  <div className="grid gap-1 text-sm">
                    {order.customer_name && (
                      <div className="flex items-center gap-2 text-[var(--c-text-70)]">
                        <span className="w-20 text-[var(--c-text-50)]">ФИО:</span>
                        <span className="font-medium">{order.customer_name}</span>
                      </div>
                    )}
                    {order.delivery_info && (
                      <div className="flex items-center gap-2 text-[var(--c-text-70)]">
                        <span className="w-20 text-[var(--c-text-50)]">Адрес:</span>
                        <span className="font-medium">{order.delivery_info}</span>
                      </div>
                    )}
                    {order.phone && (
                      <div className="flex items-center gap-2 text-[var(--c-text-70)]">
                        <span className="w-20 text-[var(--c-text-50)]">Тел:</span>
                        <a href={`tel:${order.phone}`} className="font-medium text-[var(--c-accent-soft)] hover:underline">{order.phone}</a>
                      </div>
                    )}
                  </div>

                  {order.status === "completed" && onOpenReviews && (
                    <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-[var(--c-accent-border)] bg-[var(--c-accent-bg)] p-3">
                      <div className="flex items-center gap-2 text-xs font-medium text-[var(--c-accent-soft)]">
                        <Star size={16} className="fill-[var(--c-accent)] text-[var(--c-accent)]" />
                        Заказ доставлен. Оцените покупку
                      </div>
                      <button
                        onClick={onOpenReviews}
                        className="shrink-0 rounded-xl bg-[var(--c-accent)] px-3 py-1.5 text-xs font-semibold text-[var(--c-accent-fg)] transition hover:bg-[var(--c-accent-hover)] active:scale-95"
                      >
                        Оставить отзыв
                      </button>
                    </div>
                  )}

                  {order.confirmation_code && order.status === "shipped" && (
                    <div className="mt-3 rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 text-center">
                      <p className="text-[10px] text-[var(--c-text-50)] mb-1">Код подтверждения</p>
                      <p className="text-2xl font-bold tracking-[0.3em] text-blue-400">{order.confirmation_code}</p>
                    </div>
                  )}

                  {isExpanded && (
                    <div className="mt-3 space-y-2">
                      {order.items.map((item) => {
                        const name = item.product?.name ?? item.product_name ?? `Товар #${item.product_id}`;
                        const mainImg = item.product_image
                          ?? item.product?.images?.find((i) => i.is_main)?.image_url
                          ?? item.product?.images?.[0]?.image_url;
                        return (
                          <div key={item.id} className="flex gap-3 rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] p-3">
                            {mainImg && (
                              <img src={mainImg} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                            )}
                            <div className="min-w-0 flex-1 text-sm">
                              <div className="font-medium truncate">{name}</div>
                              {item.selected_attributes && Object.keys(item.selected_attributes).length > 0 && (
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {Object.entries(item.selected_attributes).map(([k, v]) => (
                                    <span key={k} className="inline-flex items-center gap-0.5 rounded-md border border-[var(--c-border)] bg-[var(--c-surface-alt)] px-1.5 py-0.5 text-[10px] text-[var(--c-text-60)]">
                                      <span className="text-[var(--c-text-40)]">{ATTR_LABELS[k] ?? k}:</span>
                                      <span className="text-[var(--c-text-80)]">{String(v)}</span>
                                    </span>
                                  ))}
                                </div>
                              )}
                              <div className="mt-1 text-xs text-[var(--c-text-50)]">
                                {item.quantity} шт. x {formatPrice(item.price_at_purchase)}
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {order.gifts && order.gifts.length > 0 && (
                        <div className="rounded-xl border border-[var(--c-accent-border)] bg-[var(--c-accent-bg)] p-3">
                          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--c-accent-strong)]">
                            {order.gifts.length === 1 ? "Подарок за покупку" : `Подарки за покупку (${order.gifts.length})`}
                          </div>
                          <div className="space-y-2">
                            {order.gifts.map((g, idx) => (
                              <div key={`${g.name}-${idx}`} className="flex items-center gap-3 rounded-xl border border-[var(--c-accent-border)] bg-[var(--c-surface)] p-2.5">
                                {g.image && <img src={g.image} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />}
                                <div className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--c-text)]">{g.name}</div>
                                <span className="whitespace-nowrap text-sm font-semibold text-[var(--c-accent-strong)]">
                                  {g.price > 0 ? formatPrice(g.price) : "Бесплатно"}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {order.trade_in && (
                        <div className="rounded-xl border border-[var(--c-accent-border)] bg-[var(--c-accent-bg)] p-3">
                          <div className="text-xs font-semibold text-[var(--c-accent-soft)] mb-2">Trade-In</div>
                          {order.trade_in_description && (
                            <p className="text-xs text-[var(--c-accent-soft)] opacity-80">{order.trade_in_description}</p>
                          )}
                          {order.trade_in_photos && order.trade_in_photos.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {order.trade_in_photos.map((url, idx) => (
                                <img key={idx} src={url} alt="" className="h-16 w-16 rounded-lg object-cover" />
                              ))}
                            </div>
                          )}
                          {order.trade_in_price != null && (
                            <div className="mt-2 text-xs font-semibold text-[var(--c-accent-soft)]">
                              Предлагаемая стоимость: {formatPrice(order.trade_in_price)}
                            </div>
                          )}
                          {(() => {
                            const tiStatus = getTradeInStatus(order.id);
                            if (tiStatus === "pending_confirm" && order.trade_in_price != null) {
                              return (
                                <div className="mt-3 flex gap-2">
                                  <button
                                    onClick={() => handleConfirmTradeInPrice(order.id)}
                                    className="flex-1 rounded-xl bg-[var(--c-success-bg)] border border-[var(--c-success-border)] py-2 text-xs font-semibold text-[var(--c-success-soft)] transition hover:opacity-80"
                                  >
                                    Подтвердить стоимость
                                  </button>
                                  <button
                                    onClick={() => handleRejectTradeInPrice(order.id)}
                                    className="flex-1 rounded-xl border border-[var(--c-danger-border)] bg-[var(--c-danger-bg)] py-2 text-xs font-semibold text-[var(--c-danger)] transition hover:opacity-80"
                                  >
                                    Отклонить
                                  </button>
                                </div>
                              );
                            }
                            if (tiStatus === "confirmed") {
                              return <div className="mt-2 text-xs text-green-400 font-medium">Стоимость подтверждена</div>;
                            }
                            if (tiStatus === "rejected") {
                              return <div className="mt-2 text-xs text-red-400 font-medium">Стоимость отклонена. Менеджер свяжется с вами.</div>;
                            }
                            return null;
                          })()}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-3 flex items-center justify-between border-t border-[var(--c-border)] pt-3">
                    {order.trade_in && order.trade_in_price != null ? (
                      <span className="font-semibold text-[var(--c-accent-strong)]">{formatPrice(order.trade_in_price)}</span>
                    ) : order.trade_in ? (
                      <span className="text-sm text-[var(--c-accent-soft)]">Стоимость будет определена</span>
                    ) : (
                      <span className="font-semibold text-[var(--c-accent-strong)]">{formatPrice(order.total_price)}</span>
                    )}
                    <div className="flex gap-2">
                      {canCancel && (
                        <button
                          onClick={() => handleCancel(order.id)}
                          className="rounded-xl border border-[var(--c-danger-border)] bg-[var(--c-danger-bg)] px-3 py-1.5 text-xs font-medium text-[var(--c-danger)] transition hover:bg-[var(--c-danger-border)]"
                        >
                          Отменить
                        </button>
                      )}
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : order.id)}
                        className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-1.5 text-xs text-[var(--c-text-70)] transition hover:bg-[var(--c-surface-hover)]"
                      >
                        {isExpanded ? "Свернуть" : "Подробнее"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <button
          onClick={onBack}
          className="mt-4 w-full rounded-2xl border border-[var(--c-border)] py-3 text-sm text-[var(--c-text-50)] transition hover:bg-[var(--c-surface)]"
        >
          Назад
        </button>
      </div>
    </div>
  );
}
