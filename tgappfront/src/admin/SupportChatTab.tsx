import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Send,
  MessageCircle,
  RefreshCw,
  Paperclip,
  X,
  Trash2,
} from "lucide-react";
import {
  fetchAdminConversations,
  fetchAdminConversation,
  sendAdminSupportMessage,
  deleteAdminSupportConversation,
  type SupportConversation,
  type SupportMessage,
} from "../api/support";
import { onWsEvent } from "../api/socket";
import { uploadFiles } from "../utils/upload";
import { formatDateTime } from "../utils/format";
import { isMobileKeyboard } from "../utils/platform";
import { useScrollLock } from "../hooks/useScrollLock";

const MAX_PHOTOS = 5;
const TEXTAREA_MAX = 120;

type Props = {
  onCountChange?: (n: number) => void;
};

export function SupportChatTab({ onCountChange }: Props) {
  const [conversations, setConversations] = useState<SupportConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [reply, setReply] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number } | null>(null);
  useScrollLock(activeId != null);
  const [swipedId, setSwipedId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SupportConversation | null>(null);
  useScrollLock(!!lightbox || !!deleteTarget);

  const threadEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const dialogsUnread = useCallback(
    (list: SupportConversation[]): number =>
      list.filter((c) => (c.admin_unread_count ?? 0) > 0).length,
    [],
  );

  const load = useCallback(
    (silent = false) => {
      if (!silent) setLoading(true);
      fetchAdminConversations()
        .then((c) => {
          setConversations(c);
          onCountChange?.(dialogsUnread(c));
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    },
    [onCountChange, dialogsUnread],
  );

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "auto" });
  }, [messages, activeId, photos]);

  useEffect(() => {
    const unsub = onWsEvent(
      "support_user_message",
      (data: { conversation_id: number }) => {
        load(true);
        if (activeId != null && data.conversation_id === activeId) {
          openThread({ id: data.conversation_id } as SupportConversation);
        }
      },
    );
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, load]);

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

  function resizeTextarea() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, TEXTAREA_MAX) + "px";
  }

  useEffect(() => {
    requestAnimationFrame(resizeTextarea);
  }, [reply]);

  async function openThread(conv: SupportConversation) {
    setActiveId(conv.id);
    setLoadingThread(true);
    try {
      const full = await fetchAdminConversation(conv.id);
      setMessages(full.messages ?? []);
      setConversations((prev) => {
        const next = prev.map((c) => (c.id === conv.id ? { ...c, admin_unread_count: 0 } : c));
        onCountChange?.(dialogsUnread(next));
        return next;
      });
    } catch {
      setMessages([]);
    } finally {
      setLoadingThread(false);
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
      /* ignore upload errors */
    } finally {
      setUploading(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  }

  function removePhoto(idx: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  }

  async function confirmDelete() {
    const target = deleteTarget;
    if (!target) return;
    setDeleteTarget(null);
    setSwipedId(null);
    try {
      await deleteAdminSupportConversation(target.id);
      const next = conversations.filter((c) => c.id !== target.id);
      setConversations(next);
      if (activeId === target.id) {
        setActiveId(null);
        setMessages([]);
        setReply("");
        setPhotos([]);
      }
      onCountChange?.(dialogsUnread(next));
    } catch {
      /* keep chat on error */
    }
  }

  async function handleSend() {
    const text = reply.trim();
    if ((!text && photos.length === 0) || sending || uploading || activeId == null) return;
    setSending(true);
    try {
      const msg = await sendAdminSupportMessage(activeId, text, photos);
      setMessages((prev) => [...prev, msg]);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeId
            ? { ...c, last_message: msg.text || "Фото", last_message_at: msg.created_at }
            : c,
        ),
      );
      setReply("");
      setPhotos([]);
    } catch {
      /* keep input on error */
    } finally {
      setSending(false);
    }
  }

  if (activeId != null) {
    const conv = conversations.find((c) => c.id === activeId);
    return (
      <div className="fixed inset-0 z-40 flex flex-col bg-[var(--c-bg)]">
        <header className="flex shrink-0 items-center gap-3 border-b border-[var(--c-border)] px-4 py-3">
          <button
            onClick={() => {
              setActiveId(null);
              load(true);
            }}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text-80)] transition hover:bg-[var(--c-surface-hover)] active:scale-95"
            aria-label="Назад"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="min-w-0">
            <h4 className="truncate text-sm font-semibold text-[var(--c-text)]">{conv?.user_name}</h4>
            <p className="text-xs text-[var(--c-text-50)]">
              {conv?.last_message_at ? formatDateTime(conv.last_message_at) : ""}
            </p>
          </div>
        </header>

        <div className="flex-1 space-y-2 overflow-y-auto p-4">
          {loadingThread ? (
            <p className="py-8 text-center text-sm text-[var(--c-text-50)]">Загрузка...</p>
          ) : messages.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--c-text-50)]">Сообщений пока нет</p>
          ) : (
            messages.map((m) => (
              <AdminBubble key={m.id} msg={m} user_name={conv?.user_name ?? "Пользователь"} onOpenLightbox={setLightbox} />
            ))
          )}
        <div ref={threadEndRef} />
      </div>

      <div className="shrink-0 border-t border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-3">
        {photos.length > 0 && (
          <div className="flex flex-wrap gap-2 pb-2">
              {photos.map((url, idx) => (
                <div key={idx} className="relative">
                  <img src={url} alt="" className="h-14 w-14 rounded-lg border border-[var(--c-border)] object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(idx)}
                    className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-red-500 bg-red-500 text-white opacity-40 transition-opacity hover:opacity-100"
                    title="Убрать фото"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="relative">
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              disabled={uploading || photos.length >= MAX_PHOTOS}
              className="absolute bottom-2 left-2 flex h-11 w-11 items-center justify-center rounded-full text-[var(--c-text-50)] transition hover:bg-[var(--c-surface-hover)] hover:text-[var(--c-accent-soft)] disabled:opacity-40"
              title="Прикрепить фото"
            >
              {uploading ? (
                <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <Paperclip size={22} />
              )}
            </button>

            <textarea
              ref={textareaRef}
              value={reply}
              onChange={(e) => {
                setReply(e.target.value);
                resizeTextarea();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  if (isMobileKeyboard()) return;
                  e.preventDefault();
                  handleSend();
                }
              }}
              rows={1}
              placeholder="Ответить пользователю..."
              className="w-full resize-none bg-transparent py-3.5 pl-14 pr-16 text-base text-[var(--c-text)] outline-none placeholder:text-[var(--c-text-40)]"
            />

            <button
              type="button"
              onClick={handleSend}
              disabled={sending || uploading || (reply.trim().length === 0 && photos.length === 0)}
              className="absolute bottom-2 right-2 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--c-accent)] text-[var(--c-accent-fg)] transition hover:bg-[var(--c-accent-hover)] active:scale-95 disabled:opacity-40"
              aria-label="Отправить"
            >
              <Send size={20} />
            </button>
          </div>
        </div>

        {lightbox && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
            onClick={() => setLightbox(null)}
          >
            <button
              onClick={() => setLightbox(null)}
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

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-[var(--c-text-50)]">Всего обращений: {conversations.length}</p>
        <button
          onClick={() => load()}
          className="flex items-center gap-1.5 rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-1.5 text-xs text-[var(--c-text-60)] transition hover:bg-[var(--c-surface-hover)]"
        >
          <RefreshCw size={13} />
          Обновить
        </button>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-[var(--c-text-50)]">Загрузка обращений...</p>
      ) : conversations.length === 0 ? (
        <div className="py-8 text-center text-sm text-[var(--c-text-50)]">
          <MessageCircle size={20} className="mx-auto mb-2 opacity-50" />
          Обращений пока нет
        </div>
      ) : (
        <div className="space-y-3">
          {conversations.map((c) => (
            <ConversationRow
              key={c.id}
              conv={c}
              swiped={swipedId === c.id}
              onSwipedChange={(s) => setSwipedId(s ? c.id : null)}
              onOpen={() => {
                setSwipedId(null);
                openThread(c);
              }}
              onDelete={() => {
                setSwipedId(null);
                setDeleteTarget(c);
              }}
            />
          ))}
        </div>
      )}

      {deleteTarget && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-[var(--c-border)] bg-[var(--c-bg)] p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold">Удалить чат?</h3>
            <p className="mt-1 text-sm text-[var(--c-text-60)]">
              Чат с «{deleteTarget.user_name}» и вся переписка будут удалены у всех пользователей.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-2.5 text-sm font-medium text-[var(--c-text-70)] transition hover:bg-[var(--c-surface-hover)]"
              >
                Отмена
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 rounded-xl bg-[#ef4444] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#dc2626]"
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ConversationRow({
  conv,
  swiped,
  onSwipedChange,
  onOpen,
  onDelete,
}: {
  conv: SupportConversation;
  swiped: boolean;
  onSwipedChange: (swiped: boolean) => void;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const SWIPE = 98;
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);
  const movedRef = useRef(false);

  function onPointerDown(e: React.PointerEvent) {
    startX.current = e.clientX;
    startY.current = e.clientY;
    movedRef.current = false;
    setWasOpen(swiped);
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    setDragX(swiped ? -SWIPE : 0);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (startX.current == null || startY.current == null) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;
    if (Math.abs(dx) < 10) return;
    if (Math.abs(dx) > Math.abs(dy)) movedRef.current = true;
    const target = Math.max(-SWIPE, Math.min(0, swiped ? -SWIPE + dx : dx));
    setDragX(target);
  }

  function onPointerUp() {
    if (startX.current == null) return;
    startX.current = null;
    startY.current = null;
    setDragging(false);
    onSwipedChange(dragX <= -SWIPE);
    setDragX(0);
  }

  function onClick() {
    if (movedRef.current) {
      movedRef.current = false;
      return;
    }
    if (swiped) onSwipedChange(false);
    else onOpen();
  }

  const unread = conv.admin_unread_count > 0;
  const offset = dragging ? dragX : swiped ? -SWIPE : 0;
  const reveal = dragging
    ? wasOpen
      ? Math.max(0, Math.min(1, -dragX / SWIPE))
      : 0
    : swiped
      ? 1
      : 0;

  return (
    <div className="relative overflow-hidden rounded-2xl">
      <button
        onClick={onDelete}
        style={{
          opacity: reveal,
          transform: `scale(${0.5 + 0.5 * reveal})`,
        }}
        className={`absolute inset-y-0 right-0 flex w-[88px] items-center justify-center rounded-2xl bg-[#ef4444] text-white hover:bg-[#dc2626] ${
          reveal > 0 ? "" : "pointer-events-none"
        } ${dragging ? "transition-none" : "transition-all duration-200"}`}
        aria-label="Удалить чат"
      >
        <span className="flex flex-col items-center gap-1">
          <Trash2 size={18} />
          <span className="text-[10px] font-medium">Удалить</span>
        </span>
      </button>
      <button
        onClick={onClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ touchAction: "pan-y", transform: `translateX(${offset}px)` }}
        className={`relative z-10 w-full select-none rounded-2xl border bg-[var(--c-surface)] p-4 text-left hover:bg-[var(--c-surface-hover)] ${
          dragging ? "transition-none" : "transition duration-200"
        } ${unread ? "border-[var(--c-accent-border)]" : "border-[var(--c-border)]"}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="font-semibold text-[var(--c-text)]">{conv.user_name}</span>
            <p className={`mt-1 line-clamp-2 text-sm ${unread ? "font-medium text-[var(--c-text-80)]" : "text-[var(--c-text-70)]"}`}>
              {conv.last_message ?? "..."}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <span className="text-xs text-[var(--c-text-50)]">
              {conv.last_message_at ? formatDateTime(conv.last_message_at) : ""}
            </span>
            {unread && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#fbbf24] px-1.5 text-[11px] font-bold text-black">
                {conv.admin_unread_count > 99 ? "99+" : conv.admin_unread_count}
              </span>
            )}
          </div>
        </div>
      </button>
    </div>
  );
}

function AdminBubble({
  msg,
  user_name,
  onOpenLightbox,
}: {
  msg: SupportMessage;
  user_name: string;
  onOpenLightbox: (lb: { urls: string[]; index: number }) => void;
}) {
  const isUser = msg.sender === "user";
  return (
    <div className={`flex ${isUser ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
          isUser
            ? "border border-[var(--c-border)] bg-[var(--c-surface-alt)] text-[var(--c-text-80)]"
            : "bg-[var(--c-accent)] text-[var(--c-accent-fg)]"
        }`}
      >
        <div className="mb-0.5 text-[10px] opacity-70">
          {isUser ? user_name : "Вы"}
        </div>
        {msg.text && <p className="whitespace-pre-wrap break-words leading-5">{msg.text}</p>}
        {msg.images && msg.images.length > 0 && (
          <div className={`flex flex-wrap gap-1.5 ${msg.text ? "mt-1.5" : ""}`}>
            {msg.images.map((url, idx) => (
              <img
                key={idx}
                src={url}
                alt=""
                onClick={() => onOpenLightbox({ urls: msg.images, index: idx })}
                className="h-16 w-16 cursor-zoom-in rounded-lg object-cover transition hover:opacity-90"
              />
            ))}
          </div>
        )}
        <div className="mt-1 text-right text-[10px] opacity-60">
          {msg.created_at ? formatDateTime(msg.created_at) : ""}
        </div>
      </div>
    </div>
  );
}
