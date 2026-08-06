import { useEffect, useState } from "react";
import { Star, CheckCircle2, Trash2 } from "lucide-react";
import {
  fetchAdminReviews,
  updateReviewStatus,
  deleteReview,
  deleteAllReviews,
  type Review,
  type ReviewStatus,
} from "../api/reviews";
import { formatDateTime } from "../utils/format";

type SubTab = "new" | "published";

const subTabs: { key: SubTab; label: string; icon: React.ReactNode }[] = [
  { key: "new", label: "Новые", icon: <Star size={14} /> },
  { key: "published", label: "Опубликованные", icon: <CheckCircle2 size={14} /> },
];

const statusLabels: Record<ReviewStatus, string> = {
  new: "Новый",
  published: "Опубликован",
  hidden: "Скрыт",
};

const statusColors: Record<ReviewStatus, string> = {
  new: "bg-[var(--c-accent-bg)] text-[var(--c-accent-soft)] border-[var(--c-accent-border)]",
  published: "bg-[var(--c-success-bg)] text-[var(--c-success-soft)] border-[var(--c-success-border)]",
  hidden: "bg-[var(--c-danger-bg)] text-[var(--c-danger)] border-[var(--c-danger-border)]",
};

type ConfirmAction =
  | { type: "delete-one"; id: number }
  | { type: "delete-all-published" }
  | null;

type Props = {
  onCountChange?: (n: number) => void;
};

export function ReviewsTab({ onCountChange }: Props) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<SubTab>("new");
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAdminReviews()
      .then((r) => {
        if (cancelled) return;
        setReviews(r);
        onCountChange?.(r.length);
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [onCountChange]);

  const newReviews = reviews.filter((r) => r.status === "new");
  const publishedReviews = reviews.filter((r) => r.status === "published");
  const shownReviews = active === "new" ? newReviews : publishedReviews;

  async function publish(id: number) {
    try {
      const updated = await updateReviewStatus(id, "published");
      setReviews((prev) => prev.map((r) => (r.id === id ? updated : r)));
    } catch (e) {
      console.error("Failed to publish review:", e);
    }
  }

  async function handleConfirmDelete() {
    const action = confirmAction;
    if (!action) return;
    try {
      if (action.type === "delete-one") {
        await deleteReview(action.id);
        setReviews((prev) => {
          const next = prev.filter((r) => r.id !== action.id);
          onCountChange?.(next.length);
          return next;
        });
      } else {
        await deleteAllReviews("published");
        setReviews((prev) => {
          const next = prev.filter((r) => r.status !== "published");
          onCountChange?.(next.length);
          return next;
        });
      }
    } catch (e) {
      console.error("Failed to delete review:", e);
    }
    setConfirmAction(null);
  }

  if (loading) {
    return <p className="py-8 text-center text-sm text-[var(--c-text-50)]">Загрузка отзывов...</p>;
  }

  return (
    <div>
      <div className="mb-4 flex gap-2">
        {subTabs.map((tab) => {
          const count = tab.key === "new" ? newReviews.length : publishedReviews.length;
          return (
            <button
              key={tab.key}
              onClick={() => setActive(tab.key)}
              className={`flex h-9 items-center rounded-xl border px-2.5 text-xs font-medium transition active:scale-95 ${
                active === tab.key
                  ? "border-[var(--c-accent-border)] bg-[var(--c-accent-bg)] text-[var(--c-accent-soft)]"
                  : "border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text-50)] hover:bg-[var(--c-surface-hover)]"
              }`}
            >
              <span className={`inline-flex transition-all duration-300 ${active === tab.key ? "mr-1.5" : ""}`}>
                {tab.icon}
              </span>
              <span
                className="overflow-hidden whitespace-nowrap transition-all duration-300"
                style={{
                  maxWidth: active === tab.key ? "110px" : "0px",
                  opacity: active === tab.key ? 1 : 0,
                  transform: `translateX(${active === tab.key ? "0px" : "-6px"})`,
                }}
              >
                {tab.label}
              </span>
              {active === tab.key && (
                <span className="ml-1.5 rounded-full bg-[var(--c-text-40)]/20 px-1.5 py-0.5 text-[10px]">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {active === "published" && publishedReviews.length > 0 && (
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm text-[var(--c-text-50)]">Опубликованных отзывов: {publishedReviews.length}</p>
          <button
            onClick={() => setConfirmAction({ type: "delete-all-published" })}
            className="rounded-xl border border-[var(--c-danger-border)] bg-[var(--c-danger-bg)] px-3 py-1.5 text-xs font-medium text-[var(--c-danger)] transition hover:bg-[var(--c-danger-border)]"
          >
            Удалить все
          </button>
        </div>
      )}

      {shownReviews.length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--c-text-50)]">
          {active === "new" ? "Новых отзывов нет" : "Опубликованных отзывов нет"}
        </p>
      ) : (
        <div className="space-y-3">
          {shownReviews.map((review) => (
            <div
              key={review.id}
              className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4 transition hover:bg-[var(--c-surface-hover)]"
            >
              <div className="mb-2 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center rounded-full border px-3 py-0.5 text-xs font-medium ${statusColors[review.status]}`}>
                    {statusLabels[review.status]}
                  </span>
                </div>
                <span className="text-sm text-[var(--c-text-50)]">
                  {review.created_at ? formatDateTime(review.created_at) : ""}
                </span>
              </div>

              <div className="mb-1 flex items-center gap-2">
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      size={15}
                      className={i < review.rating ? "fill-[#f59e0b] text-[#f59e0b]" : "text-[var(--c-text-30)]"}
                    />
                  ))}
                </div>
                <span className="text-xs text-[var(--c-text-50)]">{review.user_name}</span>
              </div>

              <p className="mb-2 text-sm text-[var(--c-text-70)]">{review.text}</p>

              {review.images.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {review.images.map((url, idx) => (
                    <img key={idx} src={url} alt="" className="h-14 w-14 rounded-lg border border-[var(--c-border)] object-cover" />
                  ))}
                </div>
              )}

              <div className="flex items-center justify-end border-t border-[var(--c-border)] pt-3">
                <div className="flex gap-2">
                  {review.status === "new" && (
                    <button
                      onClick={() => publish(review.id)}
                      className="rounded-xl border border-[var(--c-success-border)] bg-[var(--c-success-bg)] px-3 py-1.5 text-xs font-medium text-[var(--c-success-soft)] transition hover:bg-[var(--c-success-border)]"
                    >
                      Опубликовать
                    </button>
                  )}
                  <button
                    onClick={() => setConfirmAction({ type: "delete-one", id: review.id })}
                    className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--c-danger-border)] bg-[var(--c-danger-bg)] text-[var(--c-danger)] transition hover:bg-[var(--c-danger-border)]"
                    title="Удалить"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--c-overlay)] p-4">
          <div className="w-full max-w-sm rounded-2xl border border-[var(--c-border)] bg-[var(--c-bg)] p-5">
            <h4 className="text-base font-semibold">
              {confirmAction.type === "delete-one" ? "Удалить отзыв?" : "Удалить все опубликованные отзывы?"}
            </h4>
            <p className="mt-1 text-sm text-[var(--c-text-50)]">
              {confirmAction.type === "delete-one"
                ? "Отзыв будет удалён безвозвратно."
                : `Будут удалены все ${publishedReviews.length} опубликованных отзывов. Действие необратимо.`}
            </p>
            <div className="mt-4 flex gap-3">
              <button
                onClick={handleConfirmDelete}
                className="flex-1 rounded-xl border border-[var(--c-danger-border)] bg-[var(--c-danger-bg)] px-4 py-2.5 text-sm font-medium text-[var(--c-danger)] transition hover:bg-[var(--c-danger-border)]"
              >
                Удалить
              </button>
              <button
                onClick={() => setConfirmAction(null)}
                className="flex-1 rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-2.5 text-sm font-medium text-[var(--c-text-70)] transition hover:bg-[var(--c-surface-hover)]"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
