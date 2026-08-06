import { useCallback, useEffect, useRef, useState } from "react";
import { Star, Paperclip, ChevronLeft, ChevronRight, X } from "lucide-react";
import { fetchReviews, createReview, type ReviewsData } from "../api/reviews";
import { useAuth } from "../context/useAuth";
import { uploadFiles } from "../utils/upload";
import { formatDateTime } from "../utils/format";
import { useScrollLock } from "../hooks/useScrollLock";

const MAX_PHOTOS = 5;

type Props = {
  onBack: () => void;
  onOpenAuth: () => void;
  initialOpenForm?: boolean;
};

function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={size}
          className={i < value ? "fill-[var(--c-accent)] text-[var(--c-accent)]" : "text-[var(--c-text-30)]"}
        />
      ))}
    </div>
  );
}

export function ReviewsPage({ onBack, onOpenAuth, initialOpenForm = false }: Props) {
  const { user } = useAuth();
  const [data, setData] = useState<ReviewsData | null>(null);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(initialOpenForm);
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number } | null>(null);
  useScrollLock(!!lightbox);

  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!lightbox) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightbox(null);
      if (e.key === "ArrowLeft") {
        setLightbox((lb) => (lb ? { ...lb, index: (lb.index - 1 + lb.urls.length) % lb.urls.length } : lb));
      }
      if (e.key === "ArrowRight") {
        setLightbox((lb) => (lb ? { ...lb, index: (lb.index + 1) % lb.urls.length } : lb));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  const load = useCallback(() => {
    fetchReviews()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit() {
    if (!rating) {
      setError("Поставьте оценку");
      return;
    }
    if (!text.trim()) {
      setError("Напишите текст отзыва");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await createReview({ rating, text: text.trim(), images: photos });
      setRating(0);
      setText("");
      setPhotos([]);
      setShowForm(false);
      setLoading(true);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось отправить отзыв");
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const urls = await uploadFiles(files);
      setPhotos((prev) => [...prev, ...urls].slice(0, MAX_PHOTOS));
    } catch {
      setError("Не удалось загрузить фото");
    } finally {
      setUploading(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  }

  function removePhoto(idx: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text-80)] transition hover:bg-[var(--c-surface-hover)] active:scale-95"
          aria-label="Назад"
        >
          <ChevronLeft size={20} />
        </button>
        <div>
          <h2 className="text-xl font-semibold">Отзывы</h2>
          <p className="text-sm text-[var(--c-text-50)]">
            {loading || !data ? "Загрузка..." : `${data.total} ${data.total === 1 ? "отзыв" : data.total < 5 ? "отзыва" : "отзывов"}`}
          </p>
        </div>
      </div>

      {!loading && data && data.total > 0 && (
        <div className="mb-6 flex items-center gap-4 rounded-2xl border border-[var(--c-accent-border)] bg-[var(--c-accent-bg)] p-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-[var(--c-accent-strong)]">{data.avg_rating}</div>
            <Stars value={Math.round(data.avg_rating)} size={14} />
          </div>
          <div className="text-xs text-[var(--c-text-70)]">
            Средняя оценка покупателей по {data.total} отзыв{data.total === 1 ? "" : data.total < 5 ? "ам" : "ам"}
          </div>
        </div>
      )}

      <div className="mb-8">
        {user ? (
          showForm ? (
            <div className="rounded-2xl border border-[var(--c-accent-border)] bg-[var(--c-surface)] p-5">
              <h3 className="mb-3 text-sm font-semibold">Ваш отзыв</h3>

              <div className="mb-3 flex items-center gap-2">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setRating(v)}
                      className="transition active:scale-90"
                      aria-label={`Оценка ${v}`}
                    >
                      <Star
                        size={30}
                        className={v <= rating ? "fill-[var(--c-accent)] text-[var(--c-accent)]" : "text-[var(--c-text-30)]"}
                      />
                    </button>
                  ))}
                </div>
                {rating > 0 && (
                  <span className="animate-pop-in flex h-8 w-8 items-center justify-center rounded-full border border-[var(--c-accent-border)] bg-[var(--c-accent-bg)] text-sm font-bold text-[var(--c-accent-soft)]">
                    {rating}
                  </span>
                )}
              </div>

              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Расскажите о вашем впечатлении от покупки..."
                rows={3}
                className="w-full resize-none rounded-xl border border-[var(--c-border)] bg-[var(--c-bg)] px-4 py-3 text-sm text-[var(--c-text)] outline-none placeholder:text-[var(--c-text-40)] focus:border-[var(--c-accent-border)]"
              />

              <div className="mt-3">
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
                <div className="flex flex-wrap gap-2">
                  {photos.map((url, idx) => (
                    <div key={idx} className="relative">
                      <img src={url} alt="" className="h-16 w-16 rounded-lg border border-[var(--c-border)] object-cover" />
                      <button
                        type="button"
                        onClick={() => removePhoto(idx)}
                        className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-red-500 bg-red-500 text-white opacity-40 transition-opacity hover:opacity-100"
                        title="Удалить фото"
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  {photos.length < MAX_PHOTOS && (
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      disabled={uploading}
                      className="flex h-16 w-16 items-center justify-center rounded-lg border-2 border-dashed border-[var(--c-border)] text-[var(--c-text-50)] transition hover:border-[var(--c-accent-border)] hover:text-[var(--c-accent-soft)] disabled:opacity-50"
                    >
                      {uploading ? (
                        <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <Paperclip size={20} />
                      )}
                    </button>
                  )}
                </div>
              </div>

              {error && <p className="mt-3 text-sm text-[var(--c-danger)]">{error}</p>}

              <div className="mt-4 flex gap-3">
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex-1 rounded-xl bg-[var(--c-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--c-accent-fg)] transition hover:bg-[var(--c-accent-hover)] disabled:opacity-50"
                >
                  {submitting ? "Отправка..." : "Опубликовать отзыв"}
                </button>
                <button
                  onClick={() => {
                    setShowForm(false);
                    setRating(0);
                    setText("");
                    setPhotos([]);
                    setError("");
                  }}
                  className="rounded-xl border border-[var(--c-border)] bg-[var(--c-bg)] px-4 py-2.5 text-sm font-medium text-[var(--c-text-70)] transition hover:bg-[var(--c-surface-hover)]"
                >
                  Отмена
                </button>
              </div>
              <p className="mt-3 text-xs text-[var(--c-text-40)]">
                Отзыв появится на сайте после проверки администратором.
              </p>
            </div>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--c-accent-border)] bg-[var(--c-accent-bg)] px-4 py-3.5 text-sm font-medium text-[var(--c-accent-soft)] transition hover:bg-[var(--c-accent-border)]"
            >
              <Star size={16} className="fill-[var(--c-accent)] text-[var(--c-accent)]" />
              Оставить отзыв
            </button>
          )
        ) : (
          <button
            onClick={onOpenAuth}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--c-accent-border)] bg-[var(--c-accent-bg)] px-4 py-3.5 text-sm font-medium text-[var(--c-accent-soft)] transition hover:bg-[var(--c-accent-border)]"
          >
            <Star size={16} className="fill-[var(--c-accent)] text-[var(--c-accent)]" />
            Войдите, чтобы оставить отзыв
          </button>
        )}
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-[var(--c-text-50)]">Загрузка отзывов...</p>
      ) : !data || data.reviews.length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--c-text-50)]">Отзывов пока нет. Будьте первым!</p>
      ) : (
        <div className="space-y-4">
          {data.reviews.map((review) => (
            <div key={review.id} className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-5">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--c-accent-bg)] text-sm font-bold text-[var(--c-accent-soft)]">
                    {review.user_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-[var(--c-text)]">{review.user_name}</div>
                    <div className="text-xs text-[var(--c-text-50)]">
                      {review.created_at ? formatDateTime(review.created_at) : ""}
                    </div>
                  </div>
                </div>
                <Stars value={review.rating} />
              </div>

              <p className="text-sm leading-6 text-[var(--c-text-80)]">{review.text}</p>

              {review.images.length > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {review.images.map((url, idx) => (
                    <img
                      key={idx}
                      src={url}
                      alt=""
                      onClick={() => setLightbox({ urls: review.images, index: idx })}
                      className="h-28 w-full cursor-zoom-in rounded-xl border border-[var(--c-border)] object-cover transition hover:opacity-90"
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            aria-label="Закрыть"
          >
            <X size={22} />
          </button>
          {lightbox.urls.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setLightbox((lb) => (lb ? { ...lb, index: (lb.index - 1 + lb.urls.length) % lb.urls.length } : lb));
              }}
              className="absolute left-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
              aria-label="Предыдущее фото"
            >
              <ChevronLeft size={22} />
            </button>
          )}
          <img
            src={lightbox.urls[lightbox.index]}
            alt=""
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl"
          />
          {lightbox.urls.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setLightbox((lb) => (lb ? { ...lb, index: (lb.index + 1) % lb.urls.length } : lb));
              }}
              className="absolute right-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
              aria-label="Следующее фото"
            >
              <ChevronRight size={22} />
            </button>
          )}
          {lightbox.urls.length > 1 && (
            <span className="absolute bottom-4 rounded-full bg-white/10 px-3 py-1 text-sm text-white">
              {lightbox.index + 1} / {lightbox.urls.length}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
