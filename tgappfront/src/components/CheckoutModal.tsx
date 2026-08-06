import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { Gift as GiftIcon, Paperclip } from "lucide-react";
import type { CartItem, DeliveryData } from "../types/product";
import type { Gift } from "../api/promos";
import { formatPrice } from "../utils/format";
import { ATTR_LABELS } from "../utils/labels";
import { DeliveryMap } from "./DeliveryMap";
import { useAuth } from "../context/useAuth";
import { uploadFiles } from "../utils/upload";
import { COUNTRIES, formatPhoneDigits } from "../utils/phone";
import { PhoneInput } from "./PhoneInput";
import { useScrollLock } from "../hooks/useScrollLock";

type Props = {
  cart: CartItem[];
  total: number;
  gifts?: Gift[];
  onSubmit: (delivery: DeliveryData, acceptedGiftNames: string[]) => void;
  onClose: () => void;
  onOpenAuth?: () => void;
  submitting: boolean;
};

export function CheckoutModal({ cart, total, gifts = [], onSubmit, onClose, onOpenAuth, submitting }: Props) {
  useScrollLock();
  const { user } = useAuth();
  const [customerName, setCustomerName] = useState(() => user?.name ?? "");
  const [phone, setPhone] = useState(() => {
    const p = user?.phone;
    if (!p) return "";
    const digits = p.replace(/\D/g, "");
    if (digits.startsWith("7") || digits.startsWith("8")) {
      return formatPhoneDigits(digits.replace(/^7|^8/, ""), COUNTRIES[0].mask);
    }
    return "";
  });
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [countryIdx, setCountryIdx] = useState(0);
  const [tradeIn, setTradeIn] = useState(false);
  const [tradeInDescription, setTradeInDescription] = useState("");
  const [tradeInPhotos, setTradeInPhotos] = useState<string[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [agreedPersonal, setAgreedPersonal] = useState(false);
  const [agreedOffer, setAgreedOffer] = useState(false);
  const [comment, setComment] = useState("");
  const [acceptedGifts, setAcceptedGifts] = useState<boolean[]>(() => gifts.map(() => true));
  const country = COUNTRIES[countryIdx];

  const shownTotal =
    total + gifts.reduce((sum, g, idx) => sum + (acceptedGifts[idx] ? g.price || 0 : 0), 0);

  const photoInputRef = useRef<HTMLInputElement>(null);

  const maxDigits = country.mask.replace(/[^9]/g, "").length;
  const phoneDigits = phone.replace(/\D/g, "").length;
  const canSubmit = customerName.trim() && phoneDigits === maxDigits && address && !submitting && agreedPersonal && agreedOffer;

  function selectCountry(idx: number) {
    setCountryIdx(idx);
    setPhone("");
  }

  function handleSubmit() {
    if (!canSubmit) return;
    const fullPhone = country.code + " " + phone;
    const acceptedGiftNames = gifts.filter((_, idx) => acceptedGifts[idx]).map((g) => g.name);
    onSubmit({
      customerName: customerName.trim(),
      phone: fullPhone.trim(),
      address,
      lat,
      lng,
      tradeIn,
      tradeInDescription: tradeInDescription.trim(),
      tradeInPhotos,
      comment: comment.trim(),
    }, acceptedGiftNames);
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingPhoto(true);
    try {
      const urls = await uploadFiles(files);
      setTradeInPhotos((prev) => [...prev, ...urls]);
    } catch (err) {
      console.error("Failed to upload photo:", err);
    } finally {
      setUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  }

  function removePhoto(idx: number) {
    setTradeInPhotos((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleMapSelect(la: number, ln: number, addr: string) {
    setLat(la);
    setLng(ln);
    setAddress(addr);
    setShowMap(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--c-overlay)] backdrop-blur-sm sm:items-center">
      {!user ? (
        <div className="w-full max-w-lg rounded-t-3xl border border-[var(--c-border)] bg-[var(--c-bg)] p-6 sm:rounded-3xl">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold">Оформление заказа</h3>
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text-50)] transition hover:bg-[var(--c-surface-hover)] hover:text-[var(--c-text-80)]"
              aria-label="Закрыть"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="mt-6 rounded-2xl border border-[var(--c-accent-border)] bg-[var(--c-accent-bg)] p-5 text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--c-accent-bg)] border border-[var(--c-accent-border)]">
              <svg className="w-7 h-7 text-[var(--c-accent-soft)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
            <p className="text-sm text-[var(--c-text-80)] font-medium">Рекомендуем авторизоваться</p>
            <p className="text-xs text-[var(--c-text-50)]">После входа вы сможете отслеживать статус заказа, получать персональные предложения и скидки</p>
            <div className="flex flex-col gap-2 pt-1">
              <button onClick={() => { onOpenAuth?.(); }}
                className="w-full rounded-xl bg-[var(--c-accent)] py-2.5 text-sm font-semibold text-[var(--c-accent-fg)] transition hover:bg-[var(--c-accent-hover)]"
              >Войти / Зарегистрироваться</button>
            </div>
          </div>
          <p className="mt-4 text-center text-[10px] text-[var(--c-text-40)]">Ваши данные в безопасности. Мы не передаём их третьим лицам.</p>
        </div>
      ) : (
        <div key={user!.id} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-[var(--c-border)] bg-[var(--c-bg)] p-6 sm:rounded-3xl">
          <h3 className="text-xl font-semibold">Оформление заказа</h3>

          <div className="mt-4 max-h-[200px] space-y-2 overflow-y-auto pr-1">
            {cart.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] p-3"
            >
              <img
                src={item.images[0]}
                alt={item.title}
                className="h-12 w-12 rounded-lg object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.title}</p>
                {item.attributes && Object.keys(item.attributes).length > 0 && (
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {Object.entries(item.attributes).map(([key, val]) => (
                      <span
                        key={key}
                        className="text-[9px] text-[var(--c-text-50)]"
                      >
                        {ATTR_LABELS[key] ?? key}: {String(val)}
                        {Object.keys(item.attributes!).length > 1 ? " ·" : ""}
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-xs text-[var(--c-text-50)]">
                  {item.quantity} шт. × {formatPrice(item.price)}
                </p>
              </div>
              <span className="whitespace-nowrap text-sm font-semibold text-[var(--c-accent-strong)]">
                {formatPrice(item.price * item.quantity)}
              </span>
            </div>
          ))}
        </div>

        {gifts.length > 0 && (
          <div className="mt-2 rounded-2xl border border-[var(--c-accent-border)] bg-[var(--c-accent-bg)] p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--c-accent-strong)]">
                {gifts.length === 1 ? "Подарок за покупку" : `Подарки за покупку (${gifts.length})`}
              </span>
            </div>
            <div className="space-y-2">
              {gifts.map((g, idx) => (
                <label
                  key={`${g.name}-${idx}`}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border p-2.5 transition ${
                    acceptedGifts[idx]
                      ? "border-[var(--c-accent-border)] bg-[var(--c-bg)]"
                      : "border-[var(--c-border)] bg-[var(--c-surface)] opacity-60"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={acceptedGifts[idx] ?? true}
                    onChange={() =>
                      setAcceptedGifts((prev) => prev.map((v, i) => (i === idx ? !v : v)))
                    }
                    className="h-4 w-4 shrink-0 rounded border-[var(--c-border)] accent-[var(--c-accent)]"
                  />
                  {g.image ? (
                    <img src={g.image} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-[var(--c-accent-border)] bg-[var(--c-accent-bg)] text-[var(--c-accent-soft)]">
                      <GiftIcon size={20} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm font-medium ${acceptedGifts[idx] ? "" : "line-through"}`}>
                      {g.name}
                    </p>
                    {!acceptedGifts[idx] && (
                      <p className="text-xs text-[var(--c-text-50)]">Не выбран</p>
                    )}
                  </div>
                  <span className={`whitespace-nowrap text-sm font-semibold ${
                    acceptedGifts[idx] ? "text-[var(--c-accent-strong)]" : "text-[var(--c-text-40)] line-through"
                  }`}>
                    {g.price > 0 ? formatPrice(g.price) : "Бесплатно"}
                  </span>
                </label>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-[var(--c-text-50)]">
              Снимите галочку, чтобы отказаться от подарка.
            </p>
          </div>
        )}

        <div className="mt-4 border-t border-[var(--c-border)] pt-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--c-text-50)]">Итого</span>
            <span className="text-xl font-semibold text-[var(--c-accent-strong)]">
              {formatPrice(shownTotal)}
            </span>
          </div>
        </div>

        <div className="mt-4 border-t border-[var(--c-border)] pt-4">
          <h4 className="mb-3 text-sm font-medium text-[var(--c-text-70)]">
            Адрес доставки
          </h4>
          {address ? (
            <div className="space-y-2">
              <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-2.5 text-xs text-[var(--c-text-70)]">
                {address}
              </div>
              <button
                onClick={() => setShowMap(true)}
                className="w-full rounded-xl border border-[var(--c-border)] py-2.5 text-xs font-medium text-[var(--c-text-50)] transition hover:bg-[var(--c-surface)]"
              >
                Изменить адрес
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowMap(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--c-border)] bg-[var(--c-surface)] py-4 text-sm text-[var(--c-text-50)] transition hover:border-[var(--c-accent)] hover:text-[var(--c-text)]"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              Укажите адрес доставки
            </button>
          )}
        </div>

        <div className="mt-4 border-t border-[var(--c-border)] pt-4">
          <h4 className="mb-3 text-sm font-medium text-[var(--c-text-70)]">
            Данные заказчика
          </h4>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="ФИО"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-3 text-base text-[var(--c-text)] outline-none placeholder:text-[var(--c-text-40)] focus:border-[var(--c-accent-border)]"
            />

            <PhoneInput value={phone} onChange={setPhone} countryIdx={countryIdx} onCountryChange={selectCountry} />

            <textarea
              placeholder="Комментарий к заказу"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-3 text-base text-[var(--c-text)] outline-none placeholder:text-[var(--c-text-40)] focus:border-[var(--c-accent-border)]"
            />
          </div>
        </div>

        {/* Trade-In Section */}
        <div className="mt-4 border-t border-[var(--c-border)] pt-4">
          <button
            type="button"
            onClick={() => setTradeIn(!tradeIn)}
            className="flex w-full items-center gap-3 rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-3 text-left transition hover:bg-[var(--c-surface-hover)]"
          >
            <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
              tradeIn
                ? "border-[var(--c-accent)] bg-[var(--c-accent)]"
                : "border-[var(--c-text-40)] bg-transparent"
            }`}>
              {tradeIn && (
                <svg className="h-3 w-3 text-[var(--c-accent-fg)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <div>
              <span className="text-sm font-medium text-[var(--c-text)]">Trade-In</span>
              <span className="ml-2 text-xs text-[var(--c-text-50)]">Обменять старый товар и сэкономить</span>
            </div>
          </button>

          {tradeIn && (
            <div className="mt-3 space-y-3">
              <div className="rounded-xl border border-[var(--c-accent-border)] bg-[var(--c-accent-bg)] p-3 text-xs text-[var(--c-accent-soft)]">
                Опишите ваш старый товар максимально подробно. После оформления менеджер свяжется с вами для уточнения деталей и определения финальной стоимости.
              </div>
              <textarea
                placeholder="Опишите ваш товар: модель, состояние, комплектация, наличие повреждений..."
                value={tradeInDescription}
                onChange={(e) => setTradeInDescription(e.target.value)}
                rows={3}
                className="w-full resize-none rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] p-3 text-sm text-[var(--c-text)] outline-none placeholder:text-[var(--c-text-40)] focus:border-[var(--c-accent-border)]"
              />

              {/* Photo upload */}
              <div>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
                <div className="flex flex-wrap gap-2">
                  {tradeInPhotos.map((url, idx) => (
                    <div key={idx} className="relative">
                      <img src={url} alt="" className="h-16 w-16 rounded-lg object-cover border border-[var(--c-border)]" />
                      <button
                        type="button"
                        onClick={() => removePhoto(idx)}
                        className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-red-500 bg-red-500 text-white opacity-40 hover:opacity-100 transition-opacity"
                        title="Удалить фото"
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    disabled={uploadingPhoto}
                    className="flex h-16 w-16 items-center justify-center rounded-lg border-2 border-dashed border-[var(--c-border)] text-[var(--c-text-50)] transition hover:border-[var(--c-accent-border)] hover:text-[var(--c-accent-soft)] disabled:opacity-50"
                  >
                    {uploadingPhoto ? (
                      <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <Paperclip size={20} />
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-5 space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreedPersonal}
              onChange={(e) => setAgreedPersonal(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-[var(--c-border)] accent-[var(--c-accent)]"
            />
            <span className="text-sm text-[var(--c-text-70)]">
              Соглашаюсь с политикой в отношении обработки персональных данных
            </span>
          </label>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreedOffer}
              onChange={(e) => setAgreedOffer(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-[var(--c-border)] accent-[var(--c-accent)]"
            />
            <span className="text-sm text-[var(--c-text-70)]">
              Принимаю условия оферты
            </span>
          </label>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="mt-5 w-full rounded-2xl bg-[var(--c-accent)] px-4 py-3 font-semibold text-[var(--c-accent-fg)] transition hover:bg-[var(--c-accent-hover)] disabled:opacity-50"
        >
          {submitting ? "Отправка..." : "Подтвердить заказ"}
        </button>

        <button
          onClick={onClose}
          className="mt-3 w-full rounded-2xl border border-[var(--c-border)] py-3 text-sm text-[var(--c-text-50)] transition hover:bg-[var(--c-surface)]"
        >
          Отмена
        </button>
      </div>
      )}

      {showMap &&
        createPortal(
          <div className="fixed inset-0 z-[60] flex flex-col bg-[var(--c-bg)]">
            <div className="flex items-center justify-between border-b border-[var(--c-border)] px-4 py-3">
              <h4 className="text-sm font-medium">Выберите адрес на карте</h4>
              <button
                onClick={() => setShowMap(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--c-surface)] text-[var(--c-text-50)] transition hover:bg-[var(--c-surface-hover)]"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <DeliveryMap onLocationSelect={handleMapSelect} initialLat={lat ?? undefined} initialLng={lng ?? undefined} />
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
