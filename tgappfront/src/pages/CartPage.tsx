import { useState, useEffect } from "react";
import type { CartItem } from "../types/product";
import { formatPrice } from "../utils/format";
import { ATTR_LABELS } from "../utils/labels";

function AnimatedPrice({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let start: number | null = null;
    const duration = 1000;

    function step(timestamp: number) {
      if (!start) start = timestamp;
      const elapsed = timestamp - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.floor(value * eased));
      if (progress < 1) {
        requestAnimationFrame(step);
      }
    }

    requestAnimationFrame(step);
  }, [value]);

  return <>{formatPrice(display)}</>;
}

type Props = {
  cart: CartItem[];
  onIncrease: (id: string) => void;
  onDecrease: (id: string) => void;
  onRemove: (id: string) => void;
  onOrder: () => void;
};

export function CartPage({
  cart,
  onIncrease,
  onDecrease,
  onRemove,
  onOrder,
}: Props) {
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <div className="rounded-[2rem] border border-[var(--c-border)] bg-[var(--c-surface)] p-5 backdrop-blur-xl">
      <h3 className="mb-4 text-2xl font-semibold">Корзина</h3>

      {cart.length === 0 ? (
        <div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface-alt)] p-8 text-center text-[var(--c-text-45)]">
          Корзина пока пустая.
        </div>
      ) : (
        <div className="space-y-4">
          {cart.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface-alt)] p-4"
            >
              <div className="flex gap-3">
                <img
                  src={item.images[0]}
                  alt={item.title}
                  className="h-20 w-20 rounded-2xl object-cover"
                />
                <div className="min-w-0 flex-1">
                  <h4 className="truncate text-lg font-medium">{item.title}</h4>
                  {item.attributes && Object.keys(item.attributes).length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {Object.entries(item.attributes).map(([key, val]) => (
                        <span
                          key={key}
                          className="inline-flex items-center gap-1 rounded-lg border border-[var(--c-border)] bg-[var(--c-surface)] px-2 py-0.5 text-[10px] font-semibold text-[var(--c-text-60)]"
                        >
                          <span className="text-[var(--c-text-40)]">{ATTR_LABELS[key] ?? key}:</span>
                          <span className="text-[var(--c-text-80)]">{String(val)}</span>
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-sm text-[var(--c-text-50)]">
                    {formatPrice(item.price)} × {item.quantity}
                  </p>
                  <p className="mt-1 font-semibold text-[var(--c-accent-strong)]">
                    <AnimatedPrice value={item.price * item.quantity} />
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onDecrease(item.id)}
                    className="h-10 w-10 rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] text-lg hover:bg-[var(--c-surface-hover)]"
                  >
                    −
                  </button>
                  <span className="w-8 text-center">{item.quantity}</span>
                  <button
                    onClick={() => onIncrease(item.id)}
                    className="h-10 w-10 rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] text-lg hover:bg-[var(--c-surface-hover)]"
                  >
                    +
                  </button>
                </div>
                <button
                  onClick={() => onRemove(item.id)}
                  className="rounded-xl border border-[var(--c-danger-border)] bg-[var(--c-danger-bg)] px-3 py-2 text-sm text-[var(--c-danger)] hover:bg-[var(--c-danger-border)]"
                >
                  Удалить
                </button>
              </div>
            </div>
          ))}

          <div className="flex flex-col gap-4 border-t border-[var(--c-border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm text-[var(--c-text-50)]">Итого</div>
              <div className="text-3xl font-semibold text-[var(--c-accent-strong)]">
                <AnimatedPrice value={total} />
              </div>
            </div>
            <button
              onClick={onOrder}
              className="rounded-2xl bg-[var(--c-accent)] px-5 py-3 font-semibold text-[var(--c-accent-fg)] transition hover:bg-[var(--c-accent-hover)]"
            >
              Оформить заказ
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
