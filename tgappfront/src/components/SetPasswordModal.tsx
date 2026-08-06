import { useState } from "react";
import { setPassword, fetchMe } from "../api/auth";
import type { AuthUser } from "../types/auth";
import { useScrollLock } from "../hooks/useScrollLock";

type Props = {
  onClose: () => void;
  onSuccess: (user: AuthUser) => void;
};

export function SetPasswordModal({ onClose, onSuccess }: Props) {
  useScrollLock();
  const [password, setPasswordValue] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== passwordConfirm) {
      setError("Пароли не совпадают");
      return;
    }
    if (password.length < 6) {
      setError("Пароль должен быть не менее 6 символов");
      return;
    }

    setLoading(true);
    try {
      await setPassword(password);
      const updatedUser = await fetchMe();
      onSuccess(updatedUser);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка при сохранении пароля");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--c-overlay)] backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-lg rounded-t-3xl border border-[var(--c-border)] bg-[var(--c-bg)] p-6 sm:rounded-3xl">
        <h3 className="text-xl font-semibold mb-1">Создать пароль</h3>
        <p className="text-sm text-[var(--c-text-50)] mb-6">
          Чтобы можно было входить по email и паролю
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPasswordValue(e.target.value)}
            placeholder="Новый пароль"
            required
            className="w-full rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-3.5 text-sm text-[var(--c-text)] outline-none placeholder:text-[var(--c-text-40)] focus:border-[var(--c-accent-border)] transition"
          />
          <input
            type="password"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            placeholder="Повторите пароль"
            required
            className="w-full rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-3.5 text-sm text-[var(--c-text)] outline-none placeholder:text-[var(--c-text-40)] focus:border-[var(--c-accent-border)] transition"
          />

          {error && (
            <div className="rounded-2xl border border-[var(--c-danger-border)] bg-[var(--c-danger-bg)] px-4 py-3 text-sm text-[var(--c-danger)]">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-3.5 text-sm font-medium text-[var(--c-text-80)] transition hover:bg-[var(--c-surface-hover)]"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-2xl bg-[var(--c-accent)] px-4 py-3.5 font-semibold text-[var(--c-accent-fg)] transition hover:bg-[var(--c-accent-hover)] disabled:opacity-50"
            >
              {loading ? "Сохранение..." : "Сохранить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
