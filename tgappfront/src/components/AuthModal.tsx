import { useState } from "react";
import { User, Pencil, Check, X } from "lucide-react";
import type { AuthUser } from "../types/auth";
import { PasswordInput } from "./PasswordInput";
import { PhoneInput } from "./PhoneInput";
import { useScrollLock } from "../hooks/useScrollLock";

type AuthMode = "login" | "register";

type Props = {
  user: AuthUser | null;
  onLogin: (login: string, password: string) => Promise<void>;
  onRegister: (data: {
    name: string;
    email?: string;
    username?: string;
    phone?: string;
    password: string;
  }) => Promise<void>;
  onClose: () => void;
  onUpdateProfile: (field: string, value: string) => Promise<void>;
  onShowSetPassword: () => void;
  onShowAdmin: () => void;
  onShowCourier: () => void;
};

export function AuthModal({
  user,
  onLogin,
  onRegister,
  onClose,
  onUpdateProfile,
  onShowSetPassword,
  onShowAdmin,
  onShowCourier,
}: Props) {
  useScrollLock();
  const [mode, setMode] = useState<AuthMode>("login");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const [loginValue, setLoginValue] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regPasswordConfirm, setRegPasswordConfirm] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (mode === "login") {
      if (!loginValue.trim() || !password) {
        setError("Заполните все поля");
        return;
      }
      setLoading(true);
      try {
        await onLogin(loginValue.trim(), password);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Ошибка входа");
      } finally {
        setLoading(false);
      }
    } else {
      if (!name.trim()) { setError("Введите имя"); return; }
      if (!regPassword || regPassword.length < 6) { setError("Пароль должен быть не менее 6 символов"); return; }
      if (regPassword !== regPasswordConfirm) { setError("Пароли не совпадают"); return; }
      setLoading(true);
      try {
        await onRegister({
          name: name.trim(),
          email: email.trim() || undefined,
          username: username.trim() || undefined,
          phone: phone.trim() || undefined,
          password: regPassword,
        });
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Ошибка регистрации");
      } finally {
        setLoading(false);
      }
    }
  }

  function startEdit(field: string, value: string) {
    setEditingField(field);
    setEditValue(value);
  }

  function cancelEdit() {
    setEditingField(null);
    setEditValue("");
  }

  async function saveEdit(field: string) {
    setEditSaving(true);
    try {
      await onUpdateProfile(field, editValue);
      setEditingField(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения профиля");
    } finally {
      setEditSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--c-overlay)] backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-lg rounded-t-3xl border border-[var(--c-border)] bg-[var(--c-bg)] p-6 sm:rounded-3xl max-h-[90vh] overflow-y-auto">
        {user ? (
          <>
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text-80)] overflow-hidden">
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt={user.name} className="h-full w-full object-cover" />
                ) : (
                  <User size={28} />
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold">Аккаунт</h3>
                <p className="text-sm text-[var(--c-text-50)]">{user.email || user.phone || "Пользователь"}</p>
              </div>
              <button
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text-50)] transition hover:bg-[var(--c-surface-hover)] hover:text-[var(--c-text-80)]"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-3">
              {editingField === "name" ? (
                <div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4">
                  <div className="text-xs text-[var(--c-text-50)] uppercase tracking-wider mb-1">Имя</div>
                  <div className="flex items-center gap-2">
                    <input type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)}
                      className="flex-1 rounded-xl border border-[var(--c-accent-border)] bg-[var(--c-bg)] px-3 py-2 text-sm text-[var(--c-text)] outline-none" autoFocus />
                    <button onClick={() => saveEdit("name")} disabled={editSaving} className="p-1.5 rounded-full bg-[var(--c-accent)] text-[var(--c-accent-fg)] hover:bg-[var(--c-accent-hover)]"><Check size={14} /></button>
                    <button onClick={cancelEdit} className="p-1.5 rounded-full border border-[var(--c-border)] text-[var(--c-text-50)] hover:bg-[var(--c-surface-hover)]"><X size={14} /></button>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4">
                  <div className="text-xs text-[var(--c-text-50)] uppercase tracking-wider mb-1">Имя</div>
                  <div className="flex items-center justify-between">
                    <div className="text-base font-medium text-[var(--c-text-80)]">{user.name}</div>
                    <button onClick={() => startEdit("name", user.name)} className="p-1.5 rounded-full text-[var(--c-text-40)] hover:text-[var(--c-accent)] hover:bg-[var(--c-surface-hover)]"><Pencil size={14} /></button>
                  </div>
                </div>
              )}

              {user.identities.map((id) => {
                const providerLabel: Record<string, { label: string; icon: React.ReactNode }> = {
                  local: {
                    label: id.provider_user_id.includes("@") ? id.provider_user_id : "Пароль",
                    icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>,
                  },
                  telegram: {
                    label: id.provider_user_id,
                    icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#229ED9"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>,
                  },
                  vk: {
                    label: id.provider_user_id,
                    icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#0077FF"><path d="M12.055 0C5.398 0 0 5.398 0 12.055c0 6.658 5.398 12.055 12.055 12.055 6.658 0 12.055-5.397 12.055-12.055C24.11 5.398 18.713 0 12.055 0zm6.118 16.972h-1.62c-.63 0-.826-.627-1.958-1.846-.988-1.065-1.418-.083-1.418.886v.674c0 .43-.154.564-.759.6-1.788.114-3.764-.368-5.257-2.069C5.07 12.942 4.11 10.183 4.11 9.944c0-.214.19-.4.766-.4H6.5c.47.045.646.307.776.684.591 1.738 1.508 3.12 1.886 3.12.183 0 .256-.149.256-.746v-2.22c0-1.086-.648-1.174-.648-1.564 0-.23.188-.413.406-.413h2.534c.372 0 .507.2.507.627v2.85c0 .36.194.493.322.493.26 0 .477-.251.843-.652.962-1.057 1.574-2.544 1.574-2.544.115-.238.335-.397.718-.397h1.409c.5 0 .628.298.482.631-.704 1.747-2.326 3.466-2.505 3.679-.26.33-.134.49 0 .782.118.26.533.815.533.815.13.185.266.369.397.54.53.662 1.079 1.22 1.079 1.627.01.472-.385.606-.676.606z"/></svg>,
                  },
                  google: {
                    label: id.provider_user_id,
                    icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>,
                  },
                };
                const info = providerLabel[id.provider] || { label: id.provider, icon: null };

                if (id.provider === "local" && id.provider_user_id.includes("@")) {
                  return (
                    <div key={id.provider + id.provider_user_id} className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4">
                      <div className="text-xs text-[var(--c-text-50)] uppercase tracking-wider mb-1">Почта</div>
                      {editingField === "email" ? (
                        <div className="flex items-center gap-2">
                          <input type="email" value={editValue} onChange={(e) => setEditValue(e.target.value)} placeholder="user@example.com"
                            className="flex-1 rounded-xl border border-[var(--c-accent-border)] bg-[var(--c-bg)] px-3 py-2 text-sm text-[var(--c-text)] outline-none placeholder:text-[var(--c-text-40)]" autoFocus />
                          <button onClick={() => saveEdit("email")} disabled={editSaving} className="p-1.5 rounded-full bg-[var(--c-accent)] text-[var(--c-accent-fg)] hover:bg-[var(--c-accent-hover)]"><Check size={14} /></button>
                          <button onClick={cancelEdit} className="p-1.5 rounded-full border border-[var(--c-border)] text-[var(--c-text-50)] hover:bg-[var(--c-surface-hover)]"><X size={14} /></button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {info.icon}
                            <span className="text-base font-medium text-[var(--c-text-80)]">{info.label}</span>
                          </div>
                          <button onClick={() => startEdit("email", user.email ?? "")} className="p-1.5 rounded-full text-[var(--c-text-40)] hover:text-[var(--c-accent)] hover:bg-[var(--c-surface-hover)]"><Pencil size={14} /></button>
                        </div>
                      )}
                    </div>
                  );
                }

                if (id.provider === "local") {
                  return null;
                }

                return (
                  <div key={id.provider + id.provider_user_id} className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4">
                    <div className="text-xs text-[var(--c-text-50)] uppercase tracking-wider mb-1">
                      {id.provider === "telegram" ? "Telegram" : id.provider === "vk" ? "VK" : id.provider === "google" ? "Google" : id.provider}
                    </div>
                    <div className="flex items-center gap-2">
                      {info.icon}
                      <span className="text-base font-medium text-[var(--c-text-80)]">{info.label}</span>
                    </div>
                  </div>
                );
              })}

              {user.phone !== null && (
                <div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4">
                  <div className="text-xs text-[var(--c-text-50)] uppercase tracking-wider mb-1">Телефон</div>
                  {editingField === "phone" ? (
                    <div className="flex items-center gap-2">
                      <input type="tel" value={editValue} onChange={(e) => setEditValue(e.target.value)} placeholder="+7 (999) 123-45-67"
                        className="flex-1 rounded-xl border border-[var(--c-accent-border)] bg-[var(--c-bg)] px-3 py-2 text-sm text-[var(--c-text)] outline-none placeholder:text-[var(--c-text-40)]" autoFocus />
                      <button onClick={() => saveEdit("phone")} disabled={editSaving} className="p-1.5 rounded-full bg-[var(--c-accent)] text-[var(--c-accent-fg)] hover:bg-[var(--c-accent-hover)]"><Check size={14} /></button>
                      <button onClick={cancelEdit} className="p-1.5 rounded-full border border-[var(--c-border)] text-[var(--c-text-50)] hover:bg-[var(--c-surface-hover)]"><X size={14} /></button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-[var(--c-text-40)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                        <span className="text-base font-medium text-[var(--c-text-80)]">{user.phone}</span>
                      </div>
                      <button onClick={() => startEdit("phone", user.phone ?? "")} className="p-1.5 rounded-full text-[var(--c-text-40)] hover:text-[var(--c-accent)] hover:bg-[var(--c-surface-hover)]"><Pencil size={14} /></button>
                    </div>
                  )}
                </div>
              )}

              {user.username && (
                <div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4">
                  <div className="text-xs text-[var(--c-text-50)] uppercase tracking-wider mb-1">Логин</div>
                  {editingField === "username" ? (
                    <div className="flex items-center gap-2">
                      <input type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)} placeholder="my_username"
                        className="flex-1 rounded-xl border border-[var(--c-accent-border)] bg-[var(--c-bg)] px-3 py-2 text-sm text-[var(--c-text)] outline-none placeholder:text-[var(--c-text-40)]" autoFocus />
                      <button onClick={() => saveEdit("username")} disabled={editSaving} className="p-1.5 rounded-full bg-[var(--c-accent)] text-[var(--c-accent-fg)] hover:bg-[var(--c-accent-hover)]"><Check size={14} /></button>
                      <button onClick={cancelEdit} className="p-1.5 rounded-full border border-[var(--c-border)] text-[var(--c-text-50)] hover:bg-[var(--c-surface-hover)]"><X size={14} /></button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-medium text-[var(--c-text-80)]">{user.username}</span>
                      </div>
                      <button onClick={() => startEdit("username", user.username ?? "")} className="p-1.5 rounded-full text-[var(--c-text-40)] hover:text-[var(--c-accent)] hover:bg-[var(--c-surface-hover)]"><Pencil size={14} /></button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {!user.has_password && user.providers?.includes("local") === false && (
              <button onClick={onShowSetPassword}
                className="mt-3 w-full rounded-2xl border border-[var(--c-accent-border)] bg-[var(--c-accent-bg)] py-3 text-sm font-medium text-[var(--c-accent-soft)] transition hover:bg-[var(--c-accent-border)]">
                Создать пароль
              </button>
            )}

            {user.role === "admin" && (
              <button onClick={onShowAdmin}
                className="mt-3 w-full rounded-2xl border border-[var(--c-accent-border)] bg-[var(--c-accent-bg)] py-3 text-sm font-medium text-[var(--c-accent-soft)] transition hover:bg-[var(--c-accent-border)]">
                Админ-панель
              </button>
            )}

            {user.role === "courier" && (
              <button onClick={onShowCourier}
                className="mt-3 w-full rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] py-3 text-sm font-medium text-[var(--c-text-70)] transition hover:bg-[var(--c-surface-hover)]">
                Доставка
              </button>
            )}

          </>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text-80)]">
                  <User size={28} />
                </div>
                <div>
                  <h3 className="text-xl font-semibold">{mode === "login" ? "Авторизация" : "Регистрация"}</h3>
                  <p className="text-sm text-[var(--c-text-50)]">{mode === "login" ? "Войдите в личный кабинет" : "Создайте аккаунт"}</p>
                </div>
              </div>
              <button onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text-50)] transition hover:bg-[var(--c-surface-hover)] hover:text-[var(--c-text-80)]">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {error && (
              <div className="rounded-2xl border border-[var(--c-danger-border)] bg-[var(--c-danger-bg)] px-4 py-3 text-sm text-[var(--c-danger)] mb-4 flex items-center gap-2">
                <span className="text-base">😕</span>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              {mode === "register" && (
                <div>
                  <label className="block text-xs font-medium text-[var(--c-text-50)] mb-1.5 ml-1">Имя</label>
                  <input type="text" placeholder="Имя" value={name} onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-3.5 text-sm text-[var(--c-text)] outline-none placeholder:text-[var(--c-text-40)] focus:border-[var(--c-accent-border)]" />
                </div>
              )}
              {mode === "login" ? (
                <>
                  <div>
                    <label className="block text-xs font-medium text-[var(--c-text-50)] mb-1.5 ml-1">Email или логин</label>
                    <input type="text" placeholder="Введите почту или логин" value={loginValue} onChange={(e) => setLoginValue(e.target.value)}
                      autoComplete="username"
                      className="w-full rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-3.5 text-sm text-[var(--c-text)] outline-none placeholder:text-[var(--c-text-40)] focus:border-[var(--c-accent-border)]" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--c-text-50)] mb-1.5 ml-1">Пароль</label>
                    <PasswordInput value={password} onChange={setPassword} placeholder="Введите пароль" autoComplete="current-password"
                      className="w-full rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-3.5 text-sm text-[var(--c-text)] outline-none placeholder:text-[var(--c-text-40)] focus:border-[var(--c-accent-border)]" />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-medium text-[var(--c-text-50)] mb-1.5 ml-1">Email</label>
                    <input type="email" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-3.5 text-sm text-[var(--c-text)] outline-none placeholder:text-[var(--c-text-40)] focus:border-[var(--c-accent-border)]" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--c-text-50)] mb-1.5 ml-1">Логин</label>
                    <input type="text" placeholder="username" value={username} onChange={(e) => setUsername(e.target.value)}
                      className="w-full rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-3.5 text-sm text-[var(--c-text)] outline-none placeholder:text-[var(--c-text-40)] focus:border-[var(--c-accent-border)]" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--c-text-50)] mb-1.5 ml-1">Телефон</label>
                    <PhoneInput value={phone} onChange={setPhone} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--c-text-50)] mb-1.5 ml-1">Пароль</label>
                    <PasswordInput value={regPassword} onChange={setRegPassword} placeholder="Минимум 6 символов" autoComplete="new-password"
                      className="w-full rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-3.5 text-sm text-[var(--c-text)] outline-none placeholder:text-[var(--c-text-40)] focus:border-[var(--c-accent-border)]" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--c-text-50)] mb-1.5 ml-1">Подтвердите пароль</label>
                    <PasswordInput value={regPasswordConfirm} onChange={setRegPasswordConfirm} placeholder="Повторите пароль" autoComplete="new-password"
                      className="w-full rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-3.5 text-sm text-[var(--c-text)] outline-none placeholder:text-[var(--c-text-40)] focus:border-[var(--c-accent-border)]" />
                  </div>
                </>
              )}

              <button type="submit" disabled={loading}
                className="w-full rounded-2xl bg-[var(--c-accent)] px-4 py-3.5 font-semibold text-[var(--c-accent-fg)] transition hover:bg-[var(--c-accent-hover)] disabled:opacity-50">
                {loading ? (mode === "login" ? "Вход..." : "Регистрация...") : mode === "login" ? "Войти" : "Зарегистрироваться"}
              </button>
            </form>

            <div className="text-center mt-4">
              {mode === "login" ? (
                <button onClick={() => setMode("register")} className="text-sm font-medium text-[var(--c-accent)] hover:underline">
                  Нет аккаунта? Зарегистрироваться
                </button>
              ) : (
                <button onClick={() => setMode("login")} className="text-sm font-medium text-[var(--c-accent)] hover:underline">
                  Уже есть аккаунт? Войти
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
