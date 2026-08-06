import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  X,
  HelpCircle,
  Send,
  MessageCircle,
  Paperclip,
  Bell,
} from "lucide-react";
import {
  fetchFaq,
  fetchMyConversations,
  createSupportConversation,
  sendSupportMessage,
  markSupportConversationRead,
  fetchSupportUnread,
  type Faq,
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
  onClose: () => void;
  onOpenAuth: () => void;
  isAuthed: boolean;
};

type View = "faq" | "thread";

export function QuestionsModal({ onClose, onOpenAuth, isAuthed }: Props) {
  useScrollLock();
  const [faq, setFaq] = useState<Faq[]>([]);
  const [openFaqId, setOpenFaqId] = useState<number | null>(null);

  const [view, setView] = useState<View>("faq");
  const [conversation, setConversation] = useState<SupportConversation | null>(null);
  const [composing, setComposing] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const [message, setMessage] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number } | null>(null);
  const [hasUnread, setHasUnread] = useState(false);

  const threadEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchFaq().then(setFaq).catch(console.error);
  }, []);

  useEffect(() => {
    if (!isAuthed) return;
    fetchSupportUnread().then((r) => setHasUnread(r.unread)).catch(() => {});
    const unsub = onWsEvent("support_reply", () => setHasUnread(true));
    return unsub;
  }, [isAuthed]);

  useEffect(() => {
    if (!isAuthed) return;
    const unsub = onWsEvent(
      "support_conversation_deleted",
      (data: { conversation_id: number }) => {
        setConversation((prev) => {
          if (prev && prev.id === data.conversation_id) {
            setComposing(true);
            setHasUnread(false);
            return null;
          }
          return prev;
        });
      },
    );
    return unsub;
  }, [isAuthed]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "auto" });
  }, [conversation, view, composing, photos]);

  useEffect(() => {
    if (view === "thread") resizeTextarea();
  }, [view]);

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
  }, [message]);

  const openChat = useCallback(() => {
    setLoadingChat(true);
    fetchMyConversations()
      .then((c) => {
        const conv = c.length > 0 ? c[0] : null;
        setConversation(conv);
        setComposing(!conv);
        setHasUnread(false);
        setView("thread");
        if (conv) markSupportConversationRead(conv.id).catch(() => {});
      })
      .catch(console.error)
      .finally(() => setLoadingChat(false));
  }, []);

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

  async function handleSend() {
    const text = message.trim();
    if ((!text && photos.length === 0) || sending || uploading) return;
    setSending(true);
    try {
      if (conversation) {
        const msg = await sendSupportMessage(conversation.id, text, photos);
        setConversation((prev) => {
          if (!prev) return prev;
          const messages = [...(prev.messages ?? []), msg];
          return { ...prev, messages, last_message: msg.text || "Фото", last_message_at: msg.created_at };
        });
      } else {
        const conv = await createSupportConversation(text, photos);
        setConversation(conv);
        setComposing(false);
      }
      setMessage("");
      setPhotos([]);
      setHasUnread(false);
    } catch {
      /* keep input on error */
    } finally {
      setSending(false);
    }
  }

  function handleAskQuestion() {
    if (!isAuthed) {
      onOpenAuth();
      return;
    }
    openChat();
  }

  const messages = conversation?.messages ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--c-overlay)] backdrop-blur-sm sm:items-center">
      <div className="flex h-[85vh] max-h-[720px] w-full max-w-lg flex-col rounded-t-3xl border border-[var(--c-border)] bg-[var(--c-bg)] sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-[var(--c-border)] p-4 sm:p-5">
          <div className="flex items-center gap-2">
            {view === "thread" && (
              <button
                onClick={() => {
                  setView("faq");
                  if (isAuthed) {
                    fetchSupportUnread().then((r) => setHasUnread(r.unread)).catch(() => {});
                  }
                }}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text-80)] transition hover:bg-[var(--c-surface-hover)] active:scale-95"
                aria-label="Назад"
              >
                <ChevronLeft size={18} />
              </button>
            )}
            <h3 className="text-lg font-semibold">
              {view === "thread" ? "Чат с Grand Store" : "Вопросы"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text-80)] transition hover:bg-[var(--c-surface-hover)] active:scale-95"
            aria-label="Закрыть"
          >
            <X size={18} />
          </button>
        </div>

        {view === "faq" && (
          <div className="flex flex-1 flex-col overflow-y-auto p-4 sm:p-5">
            <div className="mb-4 flex items-center gap-2 text-[var(--c-text-50)]">
              <HelpCircle size={16} />
              <span className="text-sm">Часто задаваемые вопросы</span>
            </div>

            {faq.length === 0 ? (
              <p className="py-8 text-center text-sm text-[var(--c-text-50)]">Вопросов пока нет</p>
            ) : (
              <div className="space-y-2">
                {faq.map((f) => {
                  const open = openFaqId === f.id;
                  return (
                    <div
                      key={f.id}
                      className="overflow-hidden rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)]"
                    >
                      <button
                        onClick={() => setOpenFaqId(open ? null : f.id)}
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-[var(--c-text)] transition hover:bg-[var(--c-surface-hover)]"
                      >
                        <span>{f.question}</span>
                        <ChevronDown
                          size={16}
                          className={`shrink-0 text-[var(--c-text-50)] transition-transform duration-300 ${open ? "rotate-180" : ""}`}
                        />
                      </button>
                      {open && (
                        <div className="border-t border-[var(--c-border)] px-4 py-3 text-sm leading-6 text-[var(--c-text-70)]">
                          {f.answer}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-auto pt-5">
              <div className="relative">
                <button
                  onClick={handleAskQuestion}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--c-accent)] px-4 py-3.5 text-sm font-semibold text-[var(--c-accent-fg)] transition hover:bg-[var(--c-accent-hover)] active:scale-95"
                >
                  <MessageCircle size={16} />
                  Чат с Grand Store
                </button>
                {hasUnread && (
                  <span
                    className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-[#fbbf24] text-black shadow-md"
                    aria-label="Есть ответ от магазина"
                  >
                    <Bell size={10} />
                  </span>
                )}
              </div>
              {!isAuthed && (
                <p className="mt-2 text-center text-xs text-[var(--c-text-40)]">
                  Чтобы задать вопрос, нужно войти в аккаунт
                </p>
              )}
            </div>
          </div>
        )}

        {view === "thread" && (
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto space-y-2 p-4 sm:p-5">
              {loadingChat ? (
                <p className="py-8 text-center text-sm text-[var(--c-text-50)]">Загрузка...</p>
              ) : messages.length > 0 ? (
                messages.map((m) => (
                  <MessageBubble key={m.id} msg={m} onOpenLightbox={setLightbox} />
                ))
              ) : (
                <p className="py-8 text-center text-sm text-[var(--c-text-50)]">
                  {composing
                    ? "Напишите ваш первый вопрос"
                    : "В этом диалоге пока нет сообщений"}
                </p>
              )}
              <div ref={threadEndRef} />
            </div>

            <div className="border-t border-[var(--c-border)] p-3 sm:p-4">
              <div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] transition focus-within:border-[var(--c-accent-border)]">
                {photos.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-2.5 pb-0">
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
                    value={message}
                    onChange={(e) => {
                      setMessage(e.target.value);
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
                    placeholder="Напишите сообщение..."
                    className="w-full resize-none bg-transparent py-3.5 pl-14 pr-16 text-base text-[var(--c-text)] outline-none placeholder:text-[var(--c-text-40)]"
                  />

                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={sending || uploading || (message.trim().length === 0 && photos.length === 0)}
                    className="absolute bottom-2 right-2 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--c-accent)] text-[var(--c-accent-fg)] transition hover:bg-[var(--c-accent-hover)] active:scale-95 disabled:opacity-40"
                    aria-label="Отправить"
                  >
                    <Send size={20} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
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

function MessageBubble({
  msg,
  onOpenLightbox,
}: {
  msg: SupportMessage;
  onOpenLightbox: (lb: { urls: string[]; index: number }) => void;
}) {
  const isUser = msg.sender === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
          isUser
            ? "bg-[var(--c-accent)] text-[var(--c-accent-fg)]"
            : "border border-[var(--c-border)] bg-[var(--c-surface-alt)] text-[var(--c-text-80)]"
        }`}
      >
        <div className="mb-0.5 text-[10px] opacity-70">
          {isUser ? "Вы" : "Grand Store"}
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
