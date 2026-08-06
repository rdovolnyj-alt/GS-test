import { useState, useEffect } from "react";
import type { ApiOrder } from "../api/orders";
import { fetchCourierMyOrders, completeDelivery, verifyConfirmationCode } from "../api/orders";
import { formatPrice, formatDate } from "../utils/format";
import { mergeTradeInData } from "../utils/tradeIn";
import { LogOut, Camera, Package, ArrowLeft, CheckCircle, X } from "lucide-react";
import { uploadFiles } from "../utils/upload";
import { Logo } from "../components/Logo";
import { ThemeToggle } from "../components/ThemeToggle";

type Props = {
  onClose: () => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
};

export function CourierPage({ onClose, theme, onToggleTheme }: Props) {
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);

  useEffect(() => {
    fetchCourierMyOrders()
      .then((data) => {
        setOrders(mergeTradeInData(data));
      })
      .finally(() => setLoading(false));
  }, []);

  const selectedOrder = orders.find((o) => o.id === selectedOrderId);

  if (selectedOrder) {
    return (
      <CourierOrderDetail
        order={selectedOrder}
        onBack={() => setSelectedOrderId(null)}
        theme={theme}
        onToggleTheme={onToggleTheme}
        onDeliveryComplete={() => {
          setOrders((prev) =>
            prev.map((o) =>
              o.id === selectedOrder.id ? { ...o, status: "completed", delivered_at: new Date().toISOString() } : o
            )
          );
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[var(--c-bg)] text-[var(--c-text)]">
      <header className="sticky top-0 z-20 border-b border-[var(--c-border)] bg-[var(--c-bg-header)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <Logo />
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-[var(--c-accent-border)] bg-[var(--c-accent-bg)] px-3 py-1 text-xs font-medium text-[var(--c-accent-soft)]">
              Курьер-панель
            </span>
            <ThemeToggle theme={theme} onToggle={onToggleTheme} />
            <button
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text-80)] transition hover:bg-[var(--c-surface-hover)] active:scale-95"
              aria-label="Выйти из курьер-панели"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6">
        {loading ? (
          <p className="text-sm text-[var(--c-text-50)] text-center py-8">Загрузка...</p>
        ) : orders.length === 0 ? (
          <p className="text-sm text-[var(--c-text-50)] text-center py-8">Нет заказов для доставки</p>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => {
  const isDelivered = order.status === "completed";
              return (
                <button
                  key={order.id}
                  onClick={() => setSelectedOrderId(order.id)}
                  className={`w-full rounded-2xl border p-4 text-left transition active:scale-[0.98] ${
                    isDelivered
                      ? "border-[var(--c-success-border)] bg-[var(--c-success-bg)]/40 opacity-70"
                      : "border-[var(--c-border)] bg-[var(--c-surface)] hover:bg-[var(--c-surface-hover)]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Package size={16} className={isDelivered ? "text-[var(--c-success-soft)]" : "text-[var(--c-accent-soft)]"} />
                      <span className="font-semibold text-sm">Заказ #{order.id}</span>
                      {isDelivered && <span className="text-[10px] text-[var(--c-success-soft)] font-medium">Доставлен</span>}
                    </div>
                  </div>
                  <div className="mt-2 space-y-1">
                    {order.customer_name && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="w-12 shrink-0 text-[var(--c-text-40)]">ФИО:</span>
                        <span className="text-[var(--c-text-80)]">{order.customer_name}</span>
                      </div>
                    )}
                    {order.phone && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="w-12 shrink-0 text-[var(--c-text-40)]">Тел:</span>
                        <span className="text-[var(--c-text-70)]">{order.phone}</span>
                      </div>
                    )}
                    {order.delivery_info && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="w-12 shrink-0 text-[var(--c-text-40)]">Адрес:</span>
                        <span className="text-[var(--c-text-70)]">{order.delivery_info}</span>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function CourierOrderDetail({
  order,
  onBack,
  onDeliveryComplete,
  theme,
  onToggleTheme,
}: {
  order: ApiOrder;
  onBack: () => void;
  onDeliveryComplete: () => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
}) {
  const [imei, setImei] = useState(order.delivery_imei ?? "");
  const [photos, setPhotos] = useState<string[]>(order.delivery_photo_urls ?? []);
  const [codeDigits, setCodeDigits] = useState<string[]>(["", "", "", "", ""]);
  const [codeStatus, setCodeStatus] = useState<"idle" | "validating" | "valid" | "invalid">("idle");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const isDelivered = order.status === "completed";
  const canSubmit = codeStatus === "valid" && imei.trim().length > 0 && !submitting;

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const urls = await uploadFiles(files);
      setPhotos((prev) => [...prev, ...urls]);
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploading(false);
    }
  }

  function removePhoto(idx: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  }

  async function verifyCode(code: string) {
    setCodeStatus("validating");
    try {
      await verifyConfirmationCode(order.id, code);
      setCodeStatus("valid");
    } catch {
      setCodeStatus("invalid");
    }
  }

  function handleCodeDigitChange(idx: number, value: string) {
    if (!/^\d?$/.test(value)) return;
    if (codeStatus === "invalid") setCodeStatus("idle");
    const next = [...codeDigits];
    next[idx] = value;
    setCodeDigits(next);
    if (value && idx < 4) {
      const nextInput = document.getElementById(`code-${idx + 1}`);
      nextInput?.focus();
    }
    if (next.every((d) => d !== "") && codeStatus !== "valid") {
      verifyCode(next.join(""));
    }
  }

  function handleCodeKeyDown(idx: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !codeDigits[idx] && idx > 0) {
      const prevInput = document.getElementById(`code-${idx - 1}`);
      prevInput?.focus();
    }
  }

  function resetCode() {
    setCodeDigits(["", "", "", "", ""]);
    setCodeStatus("idle");
    document.getElementById("code-0")?.focus();
  }

  async function handleComplete() {
    setError("");
    const code = codeDigits.join("");
    setSubmitting(true);
    try {
      await completeDelivery(order.id, {
        confirmation_code: code,
        imei: imei.trim(),
        photo_urls: photos,
      });
      onDeliveryComplete();
    } catch (err) {
      const msg =
        (typeof err === "object" && err !== null && "response" in err && err.response
          && typeof err.response === "object" && err.response !== null && "data" in err.response
          && err.response.data
          && typeof err.response.data === "object" && err.response.data !== null && "detail" in err.response.data
            ? String(err.response.data.detail)
            : err instanceof Error ? err.message : "Ошибка при завершении доставки");
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const statusLabel: Record<string, { label: string; color: string }> = {
    created: { label: "Новый", color: "text-yellow-400" },
    shipped: { label: "В пути", color: "text-blue-400" },
    completed: { label: "Доставлен", color: "text-[var(--c-success-soft)]" },
    cancelled: { label: "Отменён", color: "text-red-400" },
  };

  return (
    <div className="min-h-screen bg-[var(--c-bg)] text-[var(--c-text)]">
      <header className="sticky top-0 z-20 border-b border-[var(--c-border)] bg-[var(--c-bg-header)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text-80)] transition hover:bg-[var(--c-surface-hover)] active:scale-95"
              aria-label="Назад"
            >
              <ArrowLeft size={20} />
            </button>
            <Logo />
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-[var(--c-accent-border)] bg-[var(--c-accent-bg)] px-3 py-1 text-xs font-medium text-[var(--c-accent-soft)]">
              Курьер-панель
            </span>
            <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Заказ #{order.id}</h2>
          <span className={`text-xs font-medium ${statusLabel[order.status]?.color || "text-[var(--c-text-50)]"}`}>
            {statusLabel[order.status]?.label || order.status}
          </span>
        </div>
        <div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4 space-y-2">
          <h3 className="text-xs font-semibold text-[var(--c-text-50)] uppercase">Информация о заказе</h3>
          {order.customer_name && (
            <div className="flex gap-2 text-sm">
              <span className="text-[var(--c-text-50)] w-16">ФИО:</span>
              <span className="font-medium">{order.customer_name}</span>
            </div>
          )}
          {order.delivery_info && (
            <div className="flex gap-2 text-sm">
              <span className="text-[var(--c-text-50)] w-16">Адрес:</span>
              <span className="font-medium">{order.delivery_info}</span>
            </div>
          )}
          {order.phone && (
            <div className="flex gap-2 text-sm">
              <span className="text-[var(--c-text-50)] w-16">Тел:</span>
              <a href={`tel:${order.phone}`} className="font-medium text-[var(--c-accent-soft)] hover:underline">{order.phone}</a>
            </div>
          )}
          <div className="border-t border-[var(--c-border)] pt-2 mt-2">
            <span className="text-[var(--c-text-50)] text-xs">Товары:</span>
            {order.items.map((item) => {
              const name = item.product?.name ?? item.product_name ?? `Товар #${item.product_id}`;
              const mainImg = item.product_image
                ?? item.product?.images?.find((i) => i.is_main)?.image_url
                ?? item.product?.images?.[0]?.image_url;
              return (
                <div key={item.id} className="flex gap-3 mt-2 rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-alt)] p-2">
                  {mainImg && (
                    <img src={mainImg} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{name}</div>
                    <div className="text-xs text-[var(--c-text-50)] mt-0.5">
                      x{item.quantity} • {formatPrice(item.price_at_purchase)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="border-t border-[var(--c-border)] pt-2 mt-2">
            <span className="font-semibold text-[var(--c-accent-soft)]">{formatPrice(order.total_price)}</span>
          </div>
        </div>

        {!isDelivered && (
          <>
            <div className={`rounded-2xl border p-4 space-y-3 transition ${
              codeStatus === "valid"
                ? "border-[var(--c-success-border)] bg-[var(--c-success-bg)]"
                : codeStatus === "invalid"
                ? "border-red-500/40 bg-red-500/5"
                : "border-[var(--c-border)] bg-[var(--c-surface)]"
            }`}>
              <h3 className="text-xs font-semibold text-[var(--c-text-50)] uppercase">Этап 1 — Код подтверждения покупателя</h3>
              <p className="text-[10px] text-[var(--c-text-50)]">Попросите покупателя назвать код из его заказа</p>
              <div className="flex justify-center gap-2">
                {codeDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    id={`code-${idx}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleCodeDigitChange(idx, e.target.value)}
                    onKeyDown={(e) => handleCodeKeyDown(idx, e)}
                    className={`h-12 w-10 rounded-xl border-2 text-center text-lg font-bold outline-none transition ${
                      codeStatus === "valid"
                        ? "border-[var(--c-success)] bg-[var(--c-success-bg)] text-[var(--c-success)]"
                        : codeStatus === "invalid"
                        ? "border-red-500 bg-red-500/10 text-[var(--c-danger)]"
                        : codeStatus === "validating"
                        ? "border-yellow-500 bg-yellow-500/10 text-yellow-400"
                        : "border-[var(--c-border)] bg-[var(--c-surface-alt)] text-[var(--c-text)] focus:border-[var(--c-accent-border)]"
                    }`}
                  />
                ))}
              </div>
              {codeStatus === "valid" && (
                <p className="text-center text-xs font-medium text-[var(--c-success)]">Код верный ✓</p>
              )}
              {codeStatus === "invalid" && (
                <div className="text-center">
                  <p className="text-xs font-medium text-[var(--c-danger)]">Неверный код подтверждения</p>
                  <button
                    onClick={resetCode}
                    className="mt-2 rounded-xl border border-[var(--c-danger-border)] bg-[var(--c-danger-bg)] px-3 py-1 text-[10px] font-medium text-[var(--c-danger)] transition hover:opacity-80"
                  >
                    Ввести заново
                  </button>
                </div>
              )}
            </div>

            {codeStatus === "valid" && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4 space-y-3">
                  <h3 className="text-xs font-semibold text-[var(--c-text-50)] uppercase">Этап 2 — IMEI / Уникальный код товара</h3>
                  <input
                    type="text"
                    value={imei}
                    onChange={(e) => setImei(e.target.value)}
                    className="w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-alt)] px-3 py-2 text-sm text-[var(--c-text)] outline-none focus:border-[var(--c-accent-border)]"
                    placeholder="Введите IMEI или код"
                  />
                </div>

                <div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4 space-y-3">
                  <h3 className="text-xs font-semibold text-[var(--c-text-50)] uppercase">Этап 2 — Фото передачи</h3>
                  <div className="flex flex-wrap gap-2">
                    {photos.map((url, idx) => (
                      <div key={idx} className="relative">
                        <img src={url} alt="" className="h-20 w-20 rounded-lg object-cover" />
                        <button
                          onClick={() => removePhoto(idx)}
                          className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white shadow transition hover:bg-red-500"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                    <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-[var(--c-border)] text-[var(--c-text-40)] transition hover:border-[var(--c-accent-border)] hover:text-[var(--c-accent-soft)]">
                      <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} disabled={uploading} />
                      {uploading ? (
                        <span className="text-[10px]">...</span>
                      ) : (
                        <Camera size={20} />
                      )}
                    </label>
                  </div>
                </div>

                {error && (
                  <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-center">
                    <p className="text-sm font-medium text-[var(--c-danger)]">{error}</p>
                  </div>
                )}

                <button
                  onClick={handleComplete}
                  disabled={!canSubmit}
                  className="w-full rounded-xl bg-green-500 py-3 text-sm font-semibold text-white transition hover:bg-green-600 disabled:opacity-40"
                >
                  {submitting ? "Отправка..." : "Завершить доставку"}
                </button>
              </div>
            )}
          </>
        )}

        {isDelivered && (
          <div className="rounded-2xl border border-[var(--c-success-border)] bg-[var(--c-success-bg)] p-6 text-center space-y-2">
            <CheckCircle size={40} className="mx-auto text-[var(--c-success)]" />
            <p className="text-lg font-semibold text-[var(--c-success)]">Заказ доставлен</p>
            {order.delivered_at && (
              <p className="text-xs text-[var(--c-success-soft)] opacity-80">{formatDate(order.delivered_at)}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}