import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

type Props = {
  /** Поднимает кнопку выше всплывающих панелей выделения */
  raised?: boolean;
};

export function ScrollToTopButton({ raised = false }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 300);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={`fixed right-4 z-30 flex h-11 items-center gap-2 rounded-full border border-[var(--c-accent-border)] bg-[var(--c-accent-bg)] px-4 text-sm font-semibold text-[var(--c-accent-soft)] shadow-2xl backdrop-blur-xl transition hover:bg-[var(--c-accent-border)] active:scale-95 ${
        raised ? "bottom-24" : "bottom-5"
      }`}
      aria-label="Наверх"
      title="Наверх"
    >
      <ArrowUp size={18} />
      Наверх
    </button>
  );
}
