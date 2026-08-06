import { useEffect, useState } from "react";
import type { ApiOrder } from "../api/orders";
import { fetchOrder } from "../api/orders";
import { formatPrice } from "../utils/format";
import { ATTR_LABELS, STATUS_LABELS } from "../utils/labels";
import { mergeTradeInSingle } from "../utils/tradeIn";

type Props = {
  orderId: number;
  onBack: () => void;
};

export function OrderSuccessPage({ orderId, onBack }: Props) {
  const [order, setOrder] = useState<ApiOrder | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrder(orderId)
      .then((o) => setOrder(mergeTradeInSingle(o)))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [orderId]);

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <div className="rounded-[2rem] border border-[var(--c-border)] bg-[var(--c-surface)] p-6 text-center backdrop-blur-xl">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--c-success-bg)]">
          <svg className="h-8 w-8 text-[var(--c-success-soft)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h2 className="text-2xl font-bold">Заказ оформлен!</h2>
        <p className="mt-2 text-sm text-[var(--c-text-50)]">
          Заказ <span className="font-semibold text-[var(--c-text)]">#{orderId}</span> успешно создан
        </p>

        {loading ? (
          <div className="mt-6 text-sm text-[var(--c-text-50)]">Загрузка...</div>
        ) : order ? (
          <div className="mt-6 text-left">
            {order.trade_in && (
              <div className="mb-4 rounded-2xl border border-[var(--c-accent-border)] bg-[var(--c-accent-bg)] p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--c-accent)]">
                    <svg className="h-4 w-4 text-[var(--c-accent-fg)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-[var(--c-accent-soft)]">Trade-In</h4>
                    <p className="mt-1 text-xs text-[var(--c-accent-soft)] opacity-80">
                      Финальная стоимость будет определена после оценки вашего товара. Менеджер свяжется с вами в ближайшее время для уточнения деталей.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface-alt)] p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs text-[var(--c-text-40)]">Статус</span>
                <span className="inline-flex items-center rounded-full border border-[var(--c-accent-border)] bg-[var(--c-accent-bg)] px-3 py-0.5 text-xs font-medium text-[var(--c-accent-soft)]">
                  {STATUS_LABELS[order.status] ?? order.status}
                </span>
              </div>

              <div className="space-y-3">
                {order.items.map((item) => {
                  const name = item.product?.name ?? item.product_name ?? `Товар #${item.product_id}`;
                  const mainImg = item.product_image
                    ?? item.product?.images?.find((i) => i.is_main)?.image_url
                    ?? item.product?.images?.[0]?.image_url;
                  return (
                    <div key={item.id} className="flex gap-3">
                      {mainImg && (
                        <img src={mainImg} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{name}</div>
                        {item.selected_attributes && Object.keys(item.selected_attributes).length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {Object.entries(item.selected_attributes).map(([k, v]) => (
                              <span key={k} className="inline-flex items-center gap-0.5 rounded-md border border-[var(--c-border)] bg-[var(--c-surface)] px-1.5 py-0.5 text-[10px] text-[var(--c-text-60)]">
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
              </div>

              {order.gifts && order.gifts.length > 0 && (
                <div className="mt-3 rounded-2xl border border-[var(--c-accent-border)] bg-[var(--c-accent-bg)] p-3">
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--c-accent-strong)]">
                    {order.gifts.length === 1 ? "Подарок за покупку" : `Подарки за покупку (${order.gifts.length})`}
                  </div>
                  <div className="space-y-2">
                    {order.gifts.map((g, idx) => (
                      <div key={`${g.name}-${idx}`} className="flex items-center gap-3 rounded-xl border border-[var(--c-accent-border)] bg-[var(--c-bg)] p-2.5">
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

              <div className="mt-3 border-t border-[var(--c-border)] pt-3 text-right">
                {order.trade_in && order.trade_in_price != null ? (
                  <div>
                    <div className="text-xs text-[var(--c-text-50)] mb-1">Стоимость после Trade-In</div>
                    <span className="text-lg font-bold text-[var(--c-accent-strong)]">{formatPrice(order.trade_in_price)}</span>
                  </div>
                ) : !order.trade_in ? (
                  <span className="text-lg font-bold text-[var(--c-accent-strong)]">{formatPrice(order.total_price)}</span>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        <button
          onClick={onBack}
          className="mt-6 w-full rounded-2xl bg-[var(--c-accent)] px-4 py-3 font-semibold text-[var(--c-accent-fg)] transition hover:bg-[var(--c-accent-hover)]"
        >
          На главную
        </button>
      </div>
    </div>
  );
}
