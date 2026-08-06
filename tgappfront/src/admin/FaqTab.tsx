import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Plus, Pencil, Trash2, HelpCircle, GripVertical } from "lucide-react";
import {
  fetchFaq,
  createFaq,
  updateFaq,
  deleteFaq,
  deleteAllFaq,
  reorderFaq,
  type Faq,
} from "../api/support";

type FaqForm = {
  question: string;
  answer: string;
};

type ConfirmAction = { type: "delete-one"; id: number } | { type: "delete-all" } | null;

function scrollListToward(y: number, start: HTMLElement | null) {
  let node: HTMLElement | null = start;
  while (node && node.scrollHeight <= node.clientHeight + 1) {
    node = node.parentElement;
  }
  if (!node) return;
  const r = node.getBoundingClientRect();
  if (y < r.top + 56) node.scrollTop -= 16;
  else if (y > r.bottom - 56) node.scrollTop += 16;
}

export function FaqTab() {
  const [faq, setFaq] = useState<Faq[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Faq | null>(null);
  const [form, setForm] = useState<FaqForm>({ question: "", answer: "" });
  const [saving, setSaving] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);

  const [dragId, setDragId] = useState<number | null>(null);
  const [dragTranslate, setDragTranslate] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const dragIdRef = useRef<number | null>(null);
  const dragStartOrder = useRef<number[]>([]);
  const liveOrder = useRef<Faq[]>([]);
  const prevPositions = useRef<Map<number, number>>(new Map());
  const dragTranslateRef = useRef(0);
  const grabOffsetRef = useRef(0);
  const slotTopRef = useRef(0);
  const pointerYRef = useRef(0);

  const load = useCallback(() => {
    fetchFaq()
      .then((data) => {
        liveOrder.current = data;
        setFaq(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function applyTranslate(v: number) {
    dragTranslateRef.current = v;
    setDragTranslate(v);
  }

  useLayoutEffect(() => {
    if (dragId == null) return;
    const els = listRef.current ? Array.from(listRef.current.querySelectorAll("[data-faq-id]")) as HTMLElement[] : [];
    if (els.length === 0) return;
    els.forEach((el) => {
      const id = Number(el.dataset.faqId);
      if (id === dragId) return;
      const first = prevPositions.current.get(id);
      const last = el.offsetTop;
      if (first !== undefined && first !== last) {
        el.animate(
          [{ transform: `translateY(${first - last}px)` }, { transform: "translateY(0px)" }],
          { duration: 160, easing: "ease-out" },
        );
      }
    });
    prevPositions.current = new Map(els.map((el) => [Number(el.dataset.faqId), el.offsetTop]));

    const draggedEl = els.find((el) => Number(el.dataset.faqId) === dragId);
    if (draggedEl) {
      const flowTop = draggedEl.getBoundingClientRect().top - dragTranslateRef.current;
      slotTopRef.current = flowTop;
      const glued = pointerYRef.current - grabOffsetRef.current - flowTop;
      if (Math.abs(glued - dragTranslateRef.current) > 1) {
        applyTranslate(glued);
      }
    }
  }, [faq, dragId]);

  function openCreate() {
    setEditing(null);
    setForm({ question: "", answer: "" });
    setFormOpen(true);
  }

  function openEdit(f: Faq) {
    setEditing(f);
    setForm({ question: f.question, answer: f.answer });
    setFormOpen(true);
  }

  async function handleSave() {
    if (!form.question.trim() || !form.answer.trim() || saving) return;
    setSaving(true);
    try {
      if (editing) {
        await updateFaq(editing.id, { question: form.question.trim(), answer: form.answer.trim() });
      } else {
        await createFaq({ question: form.question.trim(), answer: form.answer.trim() });
      }
      setFormOpen(false);
      load();
    } catch {
      /* keep form open on error */
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirm() {
    const action = confirmAction;
    if (!action) return;
    try {
      if (action.type === "delete-one") {
        await deleteFaq(action.id);
      } else {
        await deleteAllFaq();
      }
      load();
    } catch (e) {
      console.error("Failed to delete faq:", e);
    }
    setConfirmAction(null);
  }

  function onDragMove(e: PointerEvent) {
    const id = dragIdRef.current;
    if (id == null) return;
    pointerYRef.current = e.clientY;
    const els = listRef.current ? (Array.from(listRef.current.querySelectorAll("[data-faq-id]")) as HTMLElement[]) : [];
    const selfEl = els.find((el) => Number(el.dataset.faqId) === id);
    if (!selfEl) return;
    const selfRect = selfEl.getBoundingClientRect();
    const selfMid = selfRect.top + selfRect.height / 2;

    let target = 0;
    for (const el of els) {
      if (el === selfEl) continue;
      const r = el.getBoundingClientRect();
      if (selfMid > r.top + r.height / 2) target++;
    }

    const prev = liveOrder.current;
    const from = prev.findIndex((f) => f.id === id);
    if (from !== -1 && from !== target) {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(target, 0, moved);
      liveOrder.current = next;
      setFaq(next);
      const targetEl = els[target];
      if (targetEl) slotTopRef.current = targetEl.getBoundingClientRect().top;
    }

    applyTranslate(e.clientY - grabOffsetRef.current - slotTopRef.current);
    scrollListToward(e.clientY, listRef.current);
  }

  function onDragEnd(e: PointerEvent) {
    const handle = e.currentTarget as HTMLElement;
    handle.removeEventListener("pointermove", onDragMove);
    handle.removeEventListener("pointerup", onDragEnd);
    handle.removeEventListener("pointercancel", onDragEnd);
    try {
      handle.releasePointerCapture(e.pointerId);
    } catch {
      /* capture already released */
    }
    const id = dragIdRef.current;
    dragIdRef.current = null;
    setDragId(null);
    applyTranslate(0);
    if (id == null) return;
    const currentIds = liveOrder.current.map((f) => f.id);
    const changed =
      currentIds.length !== dragStartOrder.current.length ||
      currentIds.some((fid, i) => fid !== dragStartOrder.current[i]);
    if (changed) {
      reorderFaq(currentIds).catch(load);
    }
  }

  function onDragStart(e: React.PointerEvent, id: number) {
    if (dragId !== null) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const card = (e.currentTarget as HTMLElement).closest("[data-faq-id]") as HTMLElement | null;
    const list = listRef.current;
    if (!card || !list) return;
    grabOffsetRef.current = e.clientY - card.getBoundingClientRect().top;
    slotTopRef.current = card.getBoundingClientRect().top;
    pointerYRef.current = e.clientY;
    dragStartOrder.current = faq.map((f) => f.id);
    liveOrder.current = [...faq];
    dragIdRef.current = id;
    applyTranslate(0);
    setDragId(id);
    try {
      list.setPointerCapture(e.pointerId);
    } catch {
      /* ignore capture errors */
    }
    list.addEventListener("pointermove", onDragMove);
    list.addEventListener("pointerup", onDragEnd);
    list.addEventListener("pointercancel", onDragEnd);
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-[var(--c-text-50)]">Всего вопросов: {faq.length}</p>
        <div className="flex gap-2">
          {faq.length > 0 && (
            <button
              onClick={() => setConfirmAction({ type: "delete-all" })}
              className="rounded-xl border border-[var(--c-danger-border)] bg-[var(--c-danger-bg)] px-3 py-1.5 text-xs font-medium text-[var(--c-danger)] transition hover:bg-[var(--c-danger-border)]"
            >
              Удалить все
            </button>
          )}
          <button
            onClick={openCreate}
            className="flex items-center gap-1 rounded-xl bg-[var(--c-accent)] px-3 py-1.5 text-xs font-semibold text-[var(--c-accent-fg)] transition hover:bg-[var(--c-accent-hover)]"
          >
            <Plus size={14} />
            Добавить
          </button>
        </div>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-[var(--c-text-50)]">Загрузка вопросов...</p>
      ) : faq.length === 0 ? (
        <div className="py-8 text-center text-sm text-[var(--c-text-50)]">
          <HelpCircle size={20} className="mx-auto mb-2 opacity-50" />
          Вопросов пока нет. Добавьте первый!
        </div>
      ) : (
        <div ref={listRef} className="space-y-3">
          {faq.map((f) => (
            <div
              key={f.id}
              data-faq-id={f.id}
              className={`flex gap-3 rounded-2xl border p-4 ${
                dragId === f.id
                  ? "relative z-10 border-[var(--c-accent-border)] bg-[var(--c-accent-bg)] opacity-80 shadow-xl"
                  : "border-[var(--c-border)] bg-[var(--c-surface)] transition hover:bg-[var(--c-surface-hover)]"
              } ${dragId !== null ? "select-none" : ""}`}
              style={
                dragId === f.id
                  ? { transform: `translateY(${dragTranslate}px)`, cursor: "grabbing" }
                  : undefined
              }
            >
              <div className="flex flex-col items-center justify-center">
                <button
                  type="button"
                  onPointerDown={(e) => onDragStart(e, f.id)}
                  className={`flex h-8 w-8 items-center justify-center rounded-xl text-[var(--c-text-40)] transition hover:bg-[var(--c-surface-hover)] hover:text-[var(--c-text-70)] active:scale-90 ${
                    dragId !== null && dragId !== f.id ? "opacity-40" : ""
                  }`}
                  style={{ touchAction: "none", cursor: dragId === f.id ? "grabbing" : "grab" }}
                  title="Перетащите, чтобы изменить порядок вопросов"
                >
                  <GripVertical size={18} />
                </button>
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-start justify-between gap-3">
                  <h4 className="font-medium text-[var(--c-text)]">{f.question}</h4>
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => openEdit(f)}
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text-60)] transition hover:bg-[var(--c-surface-hover)]"
                      title="Изменить"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setConfirmAction({ type: "delete-one", id: f.id })}
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--c-danger-border)] bg-[var(--c-danger-bg)] text-[var(--c-danger)] transition hover:bg-[var(--c-danger-border)]"
                      title="Удалить"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <p className="text-sm leading-6 text-[var(--c-text-70)]">{f.answer}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--c-overlay)] p-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--c-border)] bg-[var(--c-bg)] p-5">
            <h4 className="text-base font-semibold">{editing ? "Изменить вопрос" : "Новый вопрос"}</h4>

            <label className="mt-4 block text-xs font-medium text-[var(--c-text-50)]">Вопрос</label>
            <textarea
              value={form.question}
              onChange={(e) => setForm((p) => ({ ...p, question: e.target.value }))}
              rows={2}
              placeholder="Сформулируйте вопрос..."
              className="mt-1 w-full resize-none rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-3 text-sm text-[var(--c-text)] outline-none placeholder:text-[var(--c-text-40)] focus:border-[var(--c-accent-border)]"
            />

            <label className="mt-3 block text-xs font-medium text-[var(--c-text-50)]">Ответ</label>
            <textarea
              value={form.answer}
              onChange={(e) => setForm((p) => ({ ...p, answer: e.target.value }))}
              rows={4}
              placeholder="Напишите ответ..."
              className="mt-1 w-full resize-none rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-3 text-sm text-[var(--c-text)] outline-none placeholder:text-[var(--c-text-40)] focus:border-[var(--c-accent-border)]"
            />

            <div className="mt-4 flex gap-3">
              <button
                onClick={handleSave}
                disabled={saving || !form.question.trim() || !form.answer.trim()}
                className="flex-1 rounded-xl bg-[var(--c-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--c-accent-fg)] transition hover:bg-[var(--c-accent-hover)] disabled:opacity-50"
              >
                {saving ? "Сохранение..." : editing ? "Сохранить" : "Добавить"}
              </button>
              <button
                onClick={() => setFormOpen(false)}
                className="flex-1 rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-2.5 text-sm font-medium text-[var(--c-text-70)] transition hover:bg-[var(--c-surface-hover)]"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--c-overlay)] p-4">
          <div className="w-full max-w-sm rounded-2xl border border-[var(--c-border)] bg-[var(--c-bg)] p-5">
            <h4 className="text-base font-semibold">
              {confirmAction.type === "delete-one" ? "Удалить вопрос?" : "Удалить все вопросы?"}
            </h4>
            <p className="mt-1 text-sm text-[var(--c-text-50)]">
              {confirmAction.type === "delete-one"
                ? "Вопрос будет удалён безвозвратно."
                : `Будут удалены все ${faq.length} вопросов. Действие необратимо.`}
            </p>
            <div className="mt-4 flex gap-3">
              <button
                onClick={handleConfirm}
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
