import { useRef, useState, useEffect, type ReactNode } from "react";
import type { Product } from "../types/product";
import { formatPrice } from "../utils/format";
import { ATTR_LABELS as LABELS } from "../utils/labels";
import { useScrollLock } from "../hooks/useScrollLock";

type Props = {
  variants: Product[];
  onAddToCart: (product: Product) => void;
  onFlyProgress?: (src: string, fromEl: HTMLElement, progress: number) => void;
  onFlyComplete?: (src: string, fromEl: HTMLElement) => void;
  onFlyCancel?: () => void;
};

function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  const result: T[][] = [];
  for (let i = 0; i <= arr.length - k; i++) {
    for (const rest of combinations(arr.slice(i + 1), k - 1)) {
      result.push([arr[i], ...rest]);
    }
  }
  return result;
}

export function ProductPage({ variants, onAddToCart, onFlyProgress, onFlyComplete, onFlyCancel }: Props) {
  const allAttrKeys = unique(
    variants.flatMap((v) => Object.keys(v.attributes ?? {})),
  );

  const colorKeys = allAttrKeys.filter((k) => k === "color");
  const countryKeys = allAttrKeys.filter((k) => k === "country");

  // У iMac (и подобных ему линеек) свой порядок параметров в строчке:
  // ОЗУ, Память, CPU, затем ядра и код модели. У остальных — по умолчанию.
  const isImacLike = ["cpu_cores", "gpu_cores", "part_number"].some((k) => allAttrKeys.includes(k));
  const sideKeys = allAttrKeys.filter((k) => k !== "color" && k !== "country").sort((a, b) => {
    const order = isImacLike
      ? ["memory", "storage", "processor", "cpu_cores", "gpu_cores", "part_number", "year", "type", "connection", "case_size", "material", "display"]
      : ["processor", "memory", "storage", "year", "type", "connection", "case_size", "material", "display"];
    return order.indexOf(a) - order.indexOf(b);
  });

  const multiMode = sideKeys.length > 1;

  // Только значения, выбранные пользователем. Остальные параметры выводятся
  // из "якорного" варианта, поэтому выбранная комбинация всегда существует
  // и цена всегда соответствует выбранным параметрам.
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  useScrollLock(!!openDropdown);
  const [isSwiped, setIsSwiped] = useState(false);
  const [flashColor, setFlashColor] = useState<string | null>(null);

  useEffect(() => {
    if (!flashColor) return;
    const t = setTimeout(() => setFlashColor(null), 1500);
    return () => clearTimeout(t);
  }, [flashColor]);

  const sliderRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  // Последние эффективные значения параметров. Нужны для «липкого» якоря:
  // при смене выбора якорь сохраняет текущую страну/объём, если вариант с ними
  // существует, а не перепрыгивает на первую страну по порядку массива.
  const [prevEff, setPrevEff] = useState<Record<string, string>>({});

  const effKey = JSON.stringify(selected);
  const lastEffKey = useRef(effKey);

  // Цвет — якорный фильтр. Мода 1: всегда выбран (по умолчанию первый вариант),
  // от него считаются все остальные параметры. Мода 2: цвет — обычный параметр,
  // эффективный цвет следует за якорным вариантом (см. ниже).
  const effColorMode1 = selected["color"] ?? String(variants[0]?.attributes?.color ?? "");

  const matchesSelected = (v: Product) => {
    if (String(v.attributes?.color ?? "") !== effColorMode1) return false;
    for (const key of allAttrKeys) {
      if (key === "color") continue;
      const sel = selected[key];
      if (sel === undefined || sel === "") continue;
      if (String(v.attributes?.[key] ?? "") !== sel) return false;
    }
    return true;
  };

  // Мода 2: вариант должен соответствовать ЯВНЫМ выборам покупателя; цвет
  // учитывается, только если выбран явно (иначе подойдёт любой цвет).
  const matchesSelectedMode2 = (v: Product) => {
    for (const key of allAttrKeys) {
      const sel = selected[key];
      if (sel === undefined || sel === "") continue;
      if (String(v.attributes?.[key] ?? "") !== sel) return false;
    }
    return true;
  };

  const matchingVariants = multiMode
    ? variants.filter(matchesSelectedMode2)
    : variants.filter(matchesSelected);

  // Якорь «липкий»: среди подходящих вариантов предпочитаем те, что сохраняют
  // предыдущие эффективные значения незатронутых параметров (сначала все, затем
  // хотя бы страну). Так смена цвета не перепрыгивает цену на первую страну.
  const preferMatching = (): Product => {
    const fallback = matchingVariants[0] ?? variants[0];
    if (matchingVariants.length <= 1) return fallback;
    const preserved = Object.keys(prevEff).filter(
      (k) => k !== "color" && (selected[k] === undefined || selected[k] === "") && prevEff[k],
    );
    if (preserved.length > 0) {
      const full = matchingVariants.find((v) =>
        preserved.every((k) => String(v.attributes?.[k] ?? "") === prevEff[k]),
      );
      if (full) return full;
      const prevCountry = prevEff["country"];
      if (prevCountry) {
        const byCountry = matchingVariants.find(
          (v) => String(v.attributes?.country ?? "") === prevCountry,
        );
        if (byCountry) return byCountry;
      }
    }
    return fallback;
  };

  const anchor = preferMatching();

  // Мода 2: эффективный цвет следует за якорным вариантом — так при выборе
  // параметра, существующего только в другом цвете (например, 2023 у MacBook),
  // цвет неявно переключается на совместимый, и комбинация остаётся валидной.
  const effColor = multiMode
    ? String(anchor?.attributes?.color ?? "")
    : effColorMode1;

  const effSelected: Record<string, string> = {};
  for (const key of allAttrKeys) {
    effSelected[key] = key === "color" ? effColor : selected[key] ?? String(anchor?.attributes?.[key] ?? "");
  }
  // Derived state: обновляем «липкие» значения предыдущего рендера, чтобы при
  // следующем изменении выбора якорь сохранял текущую страну/объём.
  if (JSON.stringify(prevEff) !== JSON.stringify(effSelected)) {
    setPrevEff(effSelected);
  }

  const currentVariant = anchor;
  const currentPrice = currentVariant.price;
  const currentImages = currentVariant.images;

  // Каскад: доступные значения ключа key при текущих эффективных значениях
  // остальных параметров (выбор пользователя или значение якоря).
  // Собственное значение key не учитывается.
  const availableValuesFor = (key: string): string[] => {
    const pool = variants.filter((v) => {
      if (key !== "color" && String(v.attributes?.color ?? "") !== effColor) return false;
      for (const otherKey of allAttrKeys) {
        if (otherKey === key || otherKey === "color") continue;
        const eff = effSelected[otherKey];
        if (eff === undefined || eff === "") continue;
        if (String(v.attributes?.[otherKey] ?? "") !== eff) return false;
      }
      return true;
    });
    return unique(pool.map((v) => String(v.attributes?.[key] ?? "")).filter(Boolean));
  };

  const allColors = unique(variants.map((v) => String(v.attributes?.color ?? "")).filter(Boolean));

  // Все значения параметра во всей линейке (для показа полного списка —
  // несовместимые с текущим выбором просто перечёркиваются).
  const allValuesFor = (key: string): string[] =>
    unique(variants.map((v) => String(v.attributes?.[key] ?? "")).filter(Boolean));

  const colorVal = effSelected["color"] ?? "";
  const colorVariants = colorVal
    ? variants.filter((v) => String(v.attributes?.color ?? "") === colorVal)
    : variants;
  const colorImages = colorVariants.map((v) => v.images[0]).filter(Boolean);
  const displayImages = colorImages.length > 0 ? colorImages : currentImages;

  // Доступно сейчас: совместимо с текущими выборами, сброс не требуется.
  const isAvailableNow = (key: string, val: string): boolean =>
    colorVariants.some((v) => {
      if (String(v.attributes?.[key] ?? "") !== val) return false;
      for (const k of allAttrKeys) {
        if (k === key || k === "color") continue;
        const s = selected[k];
        if (s === undefined || s === "") continue;
        if (String(v.attributes?.[k] ?? "") !== s) return false;
      }
      return true;
    });

  // Доступность цвета с учётом ЭФФЕКТИВНЫХ значений остальных параметров
  // (выбор пользователя или значение якоря по умолчанию). Например, если
  // изначально стоит страна HK, то цвет, которого в HK нет, будет перечёркнут.
  const isColorAvailable = (color: string): boolean => availableValuesFor("color").includes(color);

  // Мода 2: доступность цвета по ЯВНЫМ выборам покупателя (как у остальных
  // параметров), без якорных дефолтов памяти/объёма/года. Но эффективная страна
  // учитывается всегда: она показана активной в панели стран, поэтому цвета,
  // которых в этой стране нет, зачёркнуты сразу, без лишнего клика по стране.
  const isColorAvailableLoose = (color: string): boolean =>
    variants.some((v) => {
      if (String(v.attributes?.color ?? "") !== color) return false;
      for (const k of allAttrKeys) {
        if (k === "color") continue;
        const s = k === "country" ? effSelected["country"] : selected[k];
        if (s === undefined || s === "") continue;
        if (String(v.attributes?.[k] ?? "") !== s) return false;
      }
      return true;
    });

  // После свайпа ползунок остаётся справа, область — зелёной с надписью
  // «добавлено». В исходное положение слайдер возвращается только когда
  // пользователь меняет параметры (эффективный ключ изменился), чтобы можно
  // было добавить в корзину следующий вариант. Сброс отложен в колбэк, чтобы
  // не вызывать setState синхронно в теле эффекта (react-hooks/set-state-in-effect).
  useEffect(() => {
    if (!isSwiped) {
      lastEffKey.current = effKey;
      return;
    }
    if (effKey === lastEffKey.current) return;
    lastEffKey.current = effKey;
    const t = window.setTimeout(() => {
      setIsSwiped(false);
      if (handleRef.current) {
        handleRef.current.style.transition = "transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)";
        handleRef.current.style.transform = "translateX(0px)";
        setTimeout(() => {
          if (handleRef.current) handleRef.current.style.transition = "";
        }, 400);
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, [effKey, isSwiped]);

  const getImageEl = () => {
    if (!imageRef.current) return null;
    return imageRef.current.querySelector("img");
  };

  const startSwipe = (x: number) => {
    if (isSwiped) return;
    isDragging.current = true;
    startX.current = x;
    if (onFlyProgress) {
      const img = getImageEl();
      if (img) onFlyProgress(img.src, img, 0);
    }
  };

  const moveSwipe = (x: number) => {
    if (!isDragging.current || !sliderRef.current || !handleRef.current) return;
    const maxTrack = sliderRef.current.clientWidth - handleRef.current.clientWidth - 8;
    let walk = x - startX.current;
    if (walk < 0) walk = 0;
    if (walk > maxTrack) walk = maxTrack;

    handleRef.current.style.transform = `translateX(${walk}px)`;

    const progress = Math.min(walk / maxTrack, 1);
    if (onFlyProgress) {
      const img = getImageEl();
      if (img) onFlyProgress(img.src, img, progress);
    }

    if (walk >= maxTrack * 0.9) {
      isDragging.current = false;
      setIsSwiped(true);
      handleRef.current.style.transform = `translateX(${maxTrack}px)`;
      onAddToCart({ ...currentVariant, price: currentPrice });
      if (onFlyComplete) {
        const img = getImageEl();
        if (img) onFlyComplete(img.src, img);
      }
    }
  };

  const endSwipe = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    if (!isSwiped) {
      if (handleRef.current) handleRef.current.style.transform = "translateX(0px)";
      onFlyCancel?.();
    }
  };

  // Каскад: фиксируем key=val и сохраняем максимальное по размеру
  // подмножество остальных выбранных параметров, для которого ещё существует
  // вариант в pool. Параметры, конфликтующие с новым значением, сбрасываются.
  function cascadeKeep(prev: Record<string, string>, key: string, val: string, pool: Product[]): Record<string, string> {
    const next: Record<string, string> = { [key]: val };
    const otherKeys = allAttrKeys.filter(
      (k) => k !== key && k !== "color" && prev[k] !== undefined && prev[k] !== "",
    );
    const fits = (subset: string[]) =>
      pool.some(
        (v) =>
          String(v.attributes?.[key] ?? "") === val &&
          subset.every((k) => String(v.attributes?.[k] ?? "") === prev[k]),
      );
    for (let drop = 0; drop <= otherKeys.length; drop++) {
      const keepCount = otherKeys.length - drop;
      for (const subset of combinations(otherKeys, keepCount)) {
        if (fits(subset)) {
          for (const k of otherKeys) {
            if (!subset.includes(k)) delete next[k];
          }
          return next;
        }
      }
    }
    return next;
  }

  // Мода 2: каскад по ВСЕМ параметрам линейки. Цвет — обычный параметр: если
  // его нельзя совместить с новым значением, он тоже сбрасывается. Поиск ведётся
  // по всей линейке (pool = variants), поэтому результат всегда существует.
  // Совместимые с новым значением ключи переносятся из prev в next, чтобы
  // выбранная страна/цвет не пропадали из selected (от них зависит зачёркивание
  // чипов цвета — isColorAvailableLoose).
  function cascadeKeepMulti(prev: Record<string, string>, key: string, val: string): Record<string, string> {
    const next: Record<string, string> = { [key]: val };
    const otherKeys = allAttrKeys.filter(
      (k) => k !== key && prev[k] !== undefined && prev[k] !== "",
    );
    const fits = (subset: string[]) =>
      variants.some(
        (v) =>
          String(v.attributes?.[key] ?? "") === val &&
          subset.every((k) => String(v.attributes?.[k] ?? "") === prev[k]),
      );
    for (let drop = 0; drop <= otherKeys.length; drop++) {
      const keepCount = otherKeys.length - drop;
      for (const subset of combinations(otherKeys, keepCount)) {
        if (fits(subset)) {
          for (const k of otherKeys) {
            if (subset.includes(k)) next[k] = prev[k];
          }
          return next;
        }
      }
    }
    return next;
  }

  // Цвет всегда выбран. При смене цвета остальные параметры каскадно
  // подстраиваются: сохраняются только совместимые с новым цветом.
  function selectColor(color: string) {
    if (multiMode) {
      setSelected((prev) => cascadeKeepMulti(prev, "color", color));
    } else {
      setSelected((prev) => cascadeKeep(prev, "color", color, variants));
    }
    setFlashColor(color);
  }

  function resetAttr(key: string) {
    setSelected((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  // Мода 2: выбор значения параметра. Если значение несовместимо с текущими
  // выборами, конфликтующие параметры (включая цвет) сбрасываются — покупатель
  // всегда может добраться до любого варианта линейки.
  function selectAttrWithReset(key: string, val: string) {
    setSelected((prev) => cascadeKeepMulti(prev, key, val));
  }

  // Мода 1: каскад «переливающегося сосуда». Значение фиксируется, из остальных
  // ЯВНЫХ выборов сохраняется максимально совместимое подмножество. Цвет в моде 1
  // всегда выбран (якорный) — если текущий эффективный цвет не совместим с новым
  // значением, он явно переключается на первый совместимый, иначе комбинация
  // осталась бы невалидной (якорный цвет «застрял» бы на первом варианте).
  function cascadeKeepMode1(prev: Record<string, string>, key: string, val: string): Record<string, string> {
    const next: Record<string, string> = { [key]: val };
    const otherKeys = allAttrKeys.filter(
      (k) => k !== key && k !== "color" && prev[k] !== undefined && prev[k] !== "",
    );
    const fits = (subset: string[]) =>
      variants.some(
        (v) =>
          String(v.attributes?.[key] ?? "") === val &&
          subset.every((k) => String(v.attributes?.[k] ?? "") === prev[k]),
      );
    for (let drop = 0; drop <= otherKeys.length; drop++) {
      const keepCount = otherKeys.length - drop;
      for (const subset of combinations(otherKeys, keepCount)) {
        if (fits(subset)) {
          for (const k of otherKeys) {
            if (subset.includes(k)) next[k] = prev[k];
          }
          const compatibleColors = unique(
            variants
              .filter((v) =>
                Object.entries(next).every(([k, s]) => String(v.attributes?.[k] ?? "") === s),
              )
              .map((v) => String(v.attributes?.color ?? "")),
          ).filter(Boolean);
          // Цвет в моде 1 всегда выбран: сохраняем текущий эффективный, если он
          // совместим, иначе явно переключаемся на первый совместимый. Запись
          // всегда явная, чтобы выбор не «откатывался» к первому варианту.
          if (compatibleColors.length > 0) {
            next["color"] = compatibleColors.includes(effColorMode1) ? effColorMode1 : compatibleColors[0];
          }
          return next;
        }
      }
    }
    return next;
  }

  function selectAttrMode1(key: string, val: string) {
    setSelected((prev) => cascadeKeepMode1(prev, key, val));
  }

  const modalValues = openDropdown ? allValuesFor(openDropdown) : [];

  // Доступные значения — сверху, без пролистывания. Недоступные (доступны
  // только со сбросом несовместимых параметров) — ниже, за разделителем.
  // Активное значение всегда остаётся в верхней группе.
  const modalAvailable = openDropdown
    ? modalValues.filter((val) => effSelected[openDropdown] === val || isAvailableNow(openDropdown, val))
    : [];
  const modalUnavailable = openDropdown
    ? modalValues.filter((val) => effSelected[openDropdown] !== val && !isAvailableNow(openDropdown, val))
    : [];

  return (
    <div
      className="mx-auto flex w-full max-w-7xl flex-col overflow-y-auto overflow-x-hidden px-4 pt-1 pb-1 text-[var(--c-text)] antialiased select-none [&::-webkit-scrollbar]:hidden"
      style={{ height: "calc(100dvh - 5.5rem)", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
    >

      {/* Название — верхний отступ опускает заголовок, фото, память и страну
          вниз, не сдвигая цвета, цену и слайдер */}
      <div className="text-center mt-8">
        <h2 className="text-2xl font-black tracking-tight uppercase leading-none">
          {currentVariant.title}
        </h2>
        <span className="text-[10px] font-bold tracking-widest text-[var(--c-text-40)] uppercase mt-1 inline-block">
          {currentVariant.category || "PREMIUM"}
        </span>
      </div>

      {/* === МОД 1: один параметр → левая/правая панели (iPhone, станции) === */}
      {!multiMode && (
        <div className="relative mt-5 mb-1 flex shrink-0 items-center justify-center">

          {/* Фото */}
          <div ref={imageRef} className="relative z-10 w-64 self-start max-h-full drop-shadow-[0_35px_25px_rgba(0,0,0,0.85)] transition duration-500">
            <img
              src={displayImages[0] || currentImages[0]}
              alt={currentVariant.title}
              className="w-full h-full object-contain"
            />
          </div>

          {/* Правая панель: страны */}
          {countryKeys.length > 0 && (
            <div className="absolute right-0 top-0 z-10 flex max-h-full flex-col items-center gap-2 overflow-y-auto [&::-webkit-scrollbar]:hidden">
              <span className="text-[10px] font-bold text-[var(--c-text-40)] tracking-wider mb-1">Страна</span>
              {allValuesFor("country").map((val) => {
                const isActive = effSelected["country"] === val;
                const isAvailable = availableValuesFor("country").includes(val);
                return (
                  <button
                    key={val}
                    onClick={() => selectAttrMode1("country", val)}
                    title={isActive || isAvailable ? undefined : "Сбросит несовместимые параметры"}
                    className={`flex h-9 items-center justify-center rounded-xl px-3 text-xs font-bold border transition-all ${
                      isActive
                        ? "bg-[var(--c-accent)] border-[var(--c-accent)] text-[var(--c-accent-fg)] shadow-lg shadow-[var(--c-accent)]/20"
                        : isAvailable
                          ? "bg-[var(--c-surface)] border-[var(--c-border)] text-[var(--c-text-80)] hover:bg-[var(--c-surface-hover)]"
                          : "bg-[var(--c-surface)] border-[var(--c-border)] text-[var(--c-text-40)] opacity-70 line-through hover:opacity-100"
                    }`}
                  >
                    {val}
                  </button>
                );
              })}
            </div>
          )}

          {/* Левая панель: единственный параметр (ОЗУ и т.п.) — зеркально странам */}
          {sideKeys.length === 1 && (
            <div className="absolute left-0 top-0 z-10 flex max-h-full flex-col items-center gap-2 overflow-y-auto [&::-webkit-scrollbar]:hidden">
              <span className="text-[10px] font-bold text-[var(--c-text-40)] tracking-wider mb-1">
                {LABELS[sideKeys[0]] ?? sideKeys[0]}
              </span>
              {allValuesFor(sideKeys[0]).map((val) => {
                const isActive = effSelected[sideKeys[0]] === val;
                const isAvailable = availableValuesFor(sideKeys[0]).includes(val);
                return (
                  <button
                    key={val}
                    onClick={() => selectAttrMode1(sideKeys[0], val)}
                    title={isActive || isAvailable ? undefined : "Сбросит несовместимые параметры"}
                    className={`flex h-9 items-center justify-center rounded-xl px-3 text-xs font-bold border transition-all ${
                      isActive
                        ? "bg-[var(--c-accent)] border-[var(--c-accent)] text-[var(--c-accent-fg)] shadow-lg shadow-[var(--c-accent)]/20"
                        : isAvailable
                          ? "bg-[var(--c-surface)] border-[var(--c-border)] text-[var(--c-text-80)] hover:bg-[var(--c-surface-hover)]"
                          : "bg-[var(--c-surface)] border-[var(--c-border)] text-[var(--c-text-40)] opacity-70 line-through hover:opacity-100"
                    }`}
                  >
                    {val}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* === МОД 2: много параметров → фото + страны + цвета + строка параметров (MacBook) === */}
      {multiMode && (
        <>
          <div className="relative mt-5 mb-1 flex shrink-0 items-center justify-center">
            {/* Фото по центру */}
            <div ref={imageRef} className="relative z-10 w-64 self-start max-h-full drop-shadow-[0_35px_25px_rgba(0,0,0,0.85)] transition duration-500">
              <img
                src={displayImages[0] || currentImages[0]}
                alt={currentVariant.title}
                className="w-full h-full object-contain"
              />
            </div>

            {/* Правая панель: страны */}
            {countryKeys.length > 0 && allValuesFor("country").length > 0 && (
              <div className="absolute right-0 top-0 z-10 flex max-h-full flex-col items-center gap-2 overflow-y-auto [&::-webkit-scrollbar]:hidden">
                <span className="text-[10px] font-bold text-[var(--c-text-40)] tracking-wider mb-1">Страна</span>
                {allValuesFor("country").map((val) => {
                  const isActive = effSelected["country"] === val;
                  const isNow = isAvailableNow("country", val);
                  return (
                    <button
                      key={val}
                      onClick={() => selectAttrWithReset("country", val)}
                      title={isActive || isNow ? undefined : "Сбросит несовместимые параметры"}
                      className={`flex h-9 items-center justify-center rounded-xl px-3 text-xs font-bold border transition-all ${
                        isActive
                          ? "bg-[var(--c-accent)] border-[var(--c-accent)] text-[var(--c-accent-fg)] shadow-lg shadow-[var(--c-accent)]/20"
                          : isNow
                            ? "bg-[var(--c-surface)] border-[var(--c-border)] text-[var(--c-text-80)] hover:bg-[var(--c-surface-hover)]"
                            : "bg-[var(--c-surface)] border-[var(--c-border)] text-[var(--c-text-40)] opacity-70 line-through hover:opacity-100"
                      }`}
                    >
                      {val}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Цвета — фото-чипсы */}
          {colorKeys.length > 0 && allColors.length > 1 && (
            <div className="relative mt-2 mb-4">
              <ColorScrollRow>
                {allColors.map((color) => {
                  const colorVariant = variants.find((v) => String(v.attributes?.color ?? "") === color);
                  const thumb = colorVariant?.images[0] ?? displayImages[0];
                  const isAvailable = isColorAvailableLoose(color);
                  return (
                    <div key={color} className="relative">
                      <button
                        onClick={() => isAvailable && selectColor(color)}
                        disabled={!isAvailable}
                        className={`h-16 w-16 overflow-hidden rounded-xl border-2 transition-all relative ${
                          !isAvailable
                            ? "border-[var(--c-border)] opacity-60 cursor-not-allowed"
                            : effColor === color
                              ? "border-[var(--c-accent)] shadow-lg shadow-[var(--c-accent)]/20 scale-110"
                              : "border-[var(--c-border)] opacity-60 hover:opacity-100"
                        }`}
                      >
                        <img src={thumb} alt={color} draggable={false} className="h-full w-full object-contain p-1" />
                        {!isAvailable && (
                          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 56 56"><line x1="8" y1="48" x2="48" y2="8" stroke="var(--c-text-80)" strokeWidth="2.5" strokeLinecap="round" /></svg>
                        )}
                      </button>
                      {flashColor === color && (
                        <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border border-[var(--c-border)] bg-[var(--c-surface)] px-1.5 py-0.5 text-[9px] font-semibold text-[var(--c-text-70)] shadow-md pointer-events-none z-20 animate-fade-out" style={{ animationDelay: "0.8s" }}>
                          {color}
                        </span>
                      )}
                    </div>
                  );
                })}
              </ColorScrollRow>
            </div>
          )}

          {/* Параметры — горизонтальная строка со свайпом */}
          {sideKeys.length > 0 && (
            <div className="mt-4 mb-4 flex justify-center">
              <div
                className="flex max-w-full items-center gap-2 overflow-x-auto px-4 pb-1 [&::-webkit-scrollbar]:hidden"
                style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
              >
                {[...sideKeys]
                  .sort((a, b) => (selected[b] !== undefined ? 1 : 0) - (selected[a] !== undefined ? 1 : 0))
                  .map((key) => {
                    const hasValue = selected[key] !== undefined;
                    const effVal = effSelected[key] ?? "";
                    return (
                      <div
                        key={key}
                        onClick={() => setOpenDropdown(key)}
                        className={`flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border transition-all ${
                          hasValue
                            ? "pl-3 pr-1.5 bg-[var(--c-accent)] border-[var(--c-accent)] text-[var(--c-accent-fg)] shadow-lg shadow-[var(--c-accent)]/20"
                            : "pl-3 pr-2.5 bg-[var(--c-surface)] border-[var(--c-border)] text-[var(--c-text-80)] hover:bg-[var(--c-surface-hover)]"
                        }`}
                      >
                        <span>{LABELS[key] ?? key}</span>
                        {effVal && (
                          <span className="max-w-24 truncate text-[10px] font-semibold opacity-80">{effVal}</span>
                        )}
                        <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6"/></svg>
                        {hasValue && (
                          <button
                            onClick={(e) => { e.stopPropagation(); resetAttr(key); }}
                            aria-label="Сбросить фильтр"
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg transition-opacity hover:opacity-70"
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
                          </button>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Сброс доступен внутри модалки выбранного параметра — глобальная
              кнопка не нужна, так как каскад сам подстраивает параметры. */}
        </>
      )}

      {/* Модалка снизу */}
      {openDropdown && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setOpenDropdown(null)}>
          <div className="absolute inset-0" style={{ backgroundColor: "var(--c-modal-bg)" }} />
          <div
            className="relative w-full max-w-lg rounded-t-3xl border-t border-[var(--c-border)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] animate-slide-up"
            style={{ backgroundColor: "var(--c-modal-surface)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black text-[var(--c-text)] tracking-wide">{LABELS[openDropdown] ?? openDropdown}</h3>
              <button onClick={() => setOpenDropdown(null)} className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--c-surface-hover)] text-[var(--c-text-60)] text-sm font-bold">×</button>
            </div>
            <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
              {modalAvailable.map((val) => {
                const isActive = effSelected[openDropdown] === val;
                return (
                  <button
                    key={val}
                    onClick={() => { selectAttrWithReset(openDropdown, val); setOpenDropdown(null); }}
                    className={`w-full text-left px-4 py-3 rounded-2xl text-sm font-bold transition-all border ${
                      isActive
                        ? "bg-[var(--c-accent)] border-[var(--c-accent)] text-[var(--c-accent-fg)] shadow-lg shadow-[var(--c-accent)]/20"
                        : "bg-[var(--c-surface)] border-[var(--c-border)] text-[var(--c-text-80)] hover:bg-[var(--c-surface-hover)]"
                    }`}
                  >
                    {val}
                  </button>
                );
              })}
              {modalUnavailable.length > 0 && (
                <>
                  <div className="px-1">
                    <p className="text-[11px] font-semibold text-[var(--c-text-40)]">Показаны все варианты линейки.</p>
                    <p className="text-[11px] font-bold leading-relaxed text-[var(--c-danger)]">
                      Значения с «↺» недоступны с текущими параметрами — выбор сбросит несовместимые.
                    </p>
                  </div>
                  <div className="h-px bg-[var(--c-border)]" />
                  {modalUnavailable.map((val) => (
                    <button
                      key={val}
                      onClick={() => { selectAttrWithReset(openDropdown, val); setOpenDropdown(null); }}
                      className="w-full text-left px-4 py-3 rounded-2xl text-sm font-bold transition-all border bg-[var(--c-surface)] border-[var(--c-border)] text-[var(--c-text-40)] hover:bg-[var(--c-surface-hover)]"
                    >
                      <span className="flex items-center justify-between gap-3">
                        {val}
                        <span className="shrink-0 text-[10px] font-bold text-[var(--c-text-40)]">↺ сбросить фильтры</span>
                      </span>
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Цвета (только в моде 1) */}
      {!multiMode && colorKeys.length > 0 && allColors.length > 1 && (
        <div className="relative mt-1 mb-1">
          <ColorScrollRow>
            {allColors.map((color) => {
              const colorVariant = variants.find((v) => String(v.attributes?.color ?? "") === color);
              const thumb = colorVariant?.images[0] ?? displayImages[0];
              const isAvailable = isColorAvailable(color);
              return (
                <div key={color} className="relative">
                  <button
                    onClick={() => isAvailable && selectColor(color)}
                    disabled={!isAvailable}
                    className={`h-20 w-20 overflow-hidden rounded-xl border-2 transition-all relative ${
                      !isAvailable
                        ? "border-[var(--c-border)] opacity-60 cursor-not-allowed"
                        : effColor === color
                          ? "border-[var(--c-accent)] shadow-lg shadow-[var(--c-accent)]/20 scale-110"
                          : "border-[var(--c-border)] opacity-60 hover:opacity-100"
                    }`}
                  >
                    <img src={thumb} alt={color} className="h-full w-full object-contain p-1" />
                    {!isAvailable && (
                      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 56 56"><line x1="8" y1="48" x2="48" y2="8" stroke="var(--c-text-80)" strokeWidth="2.5" strokeLinecap="round" /></svg>
                    )}
                  </button>
                  {flashColor === color && (
                    <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border border-[var(--c-border)] bg-[var(--c-surface)] px-1.5 py-0.5 text-[9px] font-semibold text-[var(--c-text-70)] shadow-md pointer-events-none z-20 animate-fade-out" style={{ animationDelay: "0.8s" }}>
                      {color}
                    </span>
                  )}
                </div>
              );
            })}
          </ColorScrollRow>
        </div>
      )}

      {/* Цена */}
      <div className={`text-center mb-1 ${!multiMode ? "mt-6" : "mt-4"}`}>
        <div className="text-4xl font-black text-[var(--c-accent-strong)] tracking-tight">
          {formatPrice(currentPrice)}
        </div>
      </div>

      {/* Слайдер */}
      <div className="mt-auto text-center" style={{ marginBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.5rem)" }}>
        <span className={`text-[9px] font-black tracking-[0.3em] uppercase transition-opacity ${isSwiped ? "opacity-0" : "text-shimmer"}`}>
          Передвинь вправо
        </span>

        <div
          ref={sliderRef}
          className={`relative mt-2 h-14 w-full rounded-2xl border-2 p-1 flex items-center overflow-hidden backdrop-blur-md transition-colors ${
            isSwiped
              ? "border-[var(--c-success-border)] bg-[var(--c-success-bg)]"
              : "border-[var(--c-accent)]/40 bg-[var(--c-overlay)]"
          }`}
          onMouseMove={(e) => moveSwipe(e.clientX)}
          onMouseUp={endSwipe}
          onMouseLeave={endSwipe}
          onTouchMove={(e) => moveSwipe(e.touches[0].clientX)}
          onTouchEnd={endSwipe}
        >
          <div
            ref={handleRef}
            onMouseDown={(e) => startSwipe(e.clientX)}
            onTouchStart={(e) => startSwipe(e.touches[0].clientX)}
            className="absolute left-1 z-10 flex h-12 w-16 cursor-grab items-center justify-center rounded-[14px] bg-white text-zinc-950 shadow-lg shadow-[var(--c-accent)]/30 active:cursor-grabbing transition-transform duration-75"
          >
            <svg
              className="w-6 h-6 text-zinc-950"
              viewBox="0 0 100 100"
              fill="none"
              stroke="currentColor"
              strokeWidth="7"
              strokeLinecap="butt"
              strokeLinejoin="miter"
            >
              <polygon points="50,6 90.1,28 90.1,72 50,94 9.9,72 9.9,28" />
              <polygon points="50,17 79.8,34.2 79.8,65.8 50,83 20.2,65.8 20.2,34.2" />
              <path d="M 52,50 L 68.5,50 L 68.5,59.3 L 50,70 L 31.5,59.3 L 31.5,40.7 L 50,30 L 64,38.1" />
            </svg>
          </div>

          <div className={`w-full text-center text-xs font-bold pointer-events-none select-none transition-colors ${isSwiped ? "text-[var(--c-success-soft)]" : "text-shimmer text-shimmer-bright"}`}>
            {isSwiped ? "✓ Товар в корзине" : "> > > Добавь в корзину"}
          </div>
        </div>
      </div>
    </div>
  );
}

// Горизонтальная строка с цветами товара. Когда цветов много — уходит вправо
// и прокручивается свайпом (тачскрин) или перетаскиванием левой кнопкой мыши
// (десктоп). При прокрутке содержимое центрируется, если помещается, и
// выравнивается влево при переполнении.
function ColorScrollRow({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef({ down: false, startX: 0, scrollLeft: 0, moved: false });

  const handleMouseDown = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    drag.current = { down: true, startX: e.clientX, scrollLeft: el.scrollLeft, moved: false };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const el = ref.current;
    const d = drag.current;
    if (!el || !d.down) return;
    const dx = e.clientX - d.startX;
    if (Math.abs(dx) > 4) d.moved = true;
    el.scrollLeft = d.scrollLeft - dx;
  };

  const handleMouseUp = () => {
    drag.current.down = false;
  };

  const handleClickCapture = (e: React.MouseEvent) => {
    if (drag.current.moved) {
      e.preventDefault();
      e.stopPropagation();
      drag.current.moved = false;
    }
  };

  return (
    <div
      ref={ref}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClickCapture={handleClickCapture}
      className="relative overflow-x-auto px-4 pt-1 pb-10 -mb-10 select-none [&::-webkit-scrollbar]:hidden"
      style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch", cursor: "grab" }}
    >
      <div className="flex items-center gap-3" style={{ width: "max-content", margin: "0 auto" }}>
        {children}
      </div>
    </div>
  );
}
