import { Sun, Moon } from "lucide-react";

type Props = {
  theme: "dark" | "light";
  onToggle: () => void;
};

export function ThemeToggle({ theme, onToggle }: Props) {
  return (
    <button
      onClick={onToggle}
      type="button"
      role="switch"
      aria-checked={theme === "light"}
      aria-label={theme === "dark" ? "Включить светлую тему" : "Включить тёмную тему"}
      className="theme-toggle relative flex h-10 w-[130px] items-center rounded-full border border-[var(--c-border)] bg-[var(--c-surface)] px-2 transition-colors duration-300 hover:bg-[var(--c-surface-hover)]"
    >
      <span
        aria-hidden
        className={`theme-toggle-thumb absolute top-1/2 h-8 w-8 -translate-y-1/2 rounded-full bg-[var(--c-accent)] shadow-lg ${
          theme === "light" ? "left-1" : "left-[calc(100%-2.25rem)]"
        }`}
      >
        <span className="flex h-full w-full items-center justify-center">
          {theme === "light" ? (
            <Sun size={16} className="text-[var(--c-accent-fg)]" />
          ) : (
            <Moon size={16} className="text-[var(--c-accent-fg)]" />
          )}
        </span>
      </span>
      <span
        className={`absolute left-3 top-1/2 -translate-y-1/2 whitespace-nowrap text-[10px] font-semibold tracking-wide text-[var(--c-text-60)] transition-opacity duration-400 ${
          theme === "dark" ? "opacity-100" : "opacity-0"
        }`}
      >
        Тёмная тема
      </span>
      <span
        className={`absolute right-3 top-1/2 -translate-y-1/2 whitespace-nowrap text-[10px] font-semibold tracking-wide text-[var(--c-text-60)] transition-opacity duration-400 ${
          theme === "light" ? "opacity-100" : "opacity-0"
        }`}
      >
        Светлая тема
      </span>
    </button>
  );
}
