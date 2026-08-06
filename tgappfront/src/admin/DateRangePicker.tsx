import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type DateRangePickerProps = {
  dateFrom: string;
  dateTo: string;
  onFromChange: (date: string) => void;
  onToChange: (date: string) => void;
};

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDisplay(date: Date): string {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return `${d}.${m}.${y}`;
}

const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

const DAYS_OF_WEEK = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export function DateRangePicker({ dateFrom, dateTo, onFromChange, onToChange }: DateRangePickerProps) {
  const today = new Date();
  const from = parseDate(dateFrom);
  const to = parseDate(dateTo);
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selecting, setSelecting] = useState<"from" | "to">(!dateFrom ? "from" : "to");

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
  const daysInMonth = lastDay.getDate();

  const days: (number | null)[] = [];
  for (let i = 0; i < startDayOfWeek; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  function isInRange(d: number): boolean {
    if (!from || !to) return false;
    const date = new Date(year, month, d);
    return date > from && date < to;
  }

  function isRangeStart(d: number): boolean {
    if (!from) return false;
    return from.getFullYear() === year && from.getMonth() === month && from.getDate() === d;
  }

  function isRangeEnd(d: number): boolean {
    if (!to) return false;
    return to.getFullYear() === year && to.getMonth() === month && to.getDate() === d;
  }

  function isToday(d: number): boolean {
    return today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;
  }

  function isSelectable(d: number): boolean {
    const date = new Date(year, month, d);
    return date <= today;
  }

  function handleDayClick(d: number) {
    const date = new Date(year, month, d);
    const str = formatDate(date);

    if (!isSelectable(d)) return;

    if (selecting === "from") {
      onFromChange(str);
      if (to && date > to) {
        onToChange("");
      }
      setSelecting("to");
    } else {
      const currentFrom = parseDate(dateFrom);
      if (currentFrom && date < currentFrom) {
        onFromChange(str);
      } else {
        onToChange(str);
        setSelecting("from");
      }
    }
  }

  function handleFromClick() {
    setSelecting("from");
  }

  function handleToClick() {
    if (dateFrom) {
      setSelecting("to");
    }
  }

  function isSelected(d: number): boolean {
    return isRangeStart(d) || isRangeEnd(d);
  }

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-3">
        <button
          type="button"
          onClick={handleFromClick}
          className={`flex-1 rounded-xl border px-3 py-1.5 text-sm transition text-left ${
            selecting === "from"
              ? "border-[var(--c-accent-border)] bg-[var(--c-accent-bg)] text-[var(--c-accent-soft)]"
              : "border-[var(--c-border)] text-[var(--c-text)] hover:border-[var(--c-accent-border)]"
          }`}
        >
          <span className={selecting === "from" ? "text-[var(--c-accent-soft)]" : "text-[var(--c-text-50)]"}>с </span>
          {dateFrom ? formatDisplay(parseDate(dateFrom)!) : "__.__.____"}
        </button>
        <span className="text-[var(--c-text-50)] text-sm shrink-0">—</span>
        <button
          type="button"
          onClick={handleToClick}
          className={`flex-1 rounded-xl border px-3 py-1.5 text-sm transition text-left ${
            selecting === "to"
              ? "border-[var(--c-accent-border)] bg-[var(--c-accent-bg)] text-[var(--c-accent-soft)]"
              : "border-[var(--c-border)] text-[var(--c-text)] hover:border-[var(--c-accent-border)]"
          }`}
        >
          <span className={selecting === "to" ? "text-[var(--c-accent-soft)]" : "text-[var(--c-text-50)]"}>по </span>
          {dateTo ? formatDisplay(parseDate(dateTo)!) : "__.__.____"}
        </button>
      </div>

      <div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-bg)] p-3">
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={() => setViewDate(new Date(year, month - 1, 1))}
            className="rounded-lg p-1 text-[var(--c-text-50)] hover:text-[var(--c-text)] hover:bg-[var(--c-surface-hover)] transition"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-medium text-[var(--c-text)]">
            {MONTHS[month]} {year}
          </span>
          <button
            type="button"
            onClick={() => setViewDate(new Date(year, month + 1, 1))}
            className="rounded-lg p-1 text-[var(--c-text-50)] hover:text-[var(--c-text)] hover:bg-[var(--c-surface-hover)] transition"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-0">
          {DAYS_OF_WEEK.map((day) => (
            <div key={day} className="text-center text-xs text-[var(--c-text-50)] py-1">
              {day}
            </div>
          ))}
          {days.map((d, i) => {
            if (d === null) {
              return <div key={`empty-${i}`} />;
            }

            const inRange = isInRange(d);
            const selected = isSelected(d);
            const today_bool = isToday(d);
            const selectable = isSelectable(d);

            let cellClass = "text-center text-sm py-1.5 rounded-lg transition relative";

            if (!selectable) {
              cellClass += " text-[var(--c-text-30)]";
            } else if (selected) {
              cellClass += " bg-[var(--c-accent-bg)] text-[var(--c-accent-soft)] font-semibold";
            } else if (inRange) {
              cellClass += " bg-[var(--c-accent-bg)] text-[var(--c-accent-soft)]";
            } else if (today_bool) {
              cellClass += " text-[var(--c-text)]";
            } else {
              cellClass += " text-[var(--c-text-70)] hover:bg-[var(--c-surface-hover)]";
            }

            return (
              <button
                key={d}
                type="button"
                disabled={!selectable}
                onClick={() => handleDayClick(d)}
                className={cellClass}
                style={
                  inRange && !selected
                    ? { background: "color-mix(in srgb, var(--c-accent-bg) 40%, transparent)" }
                    : undefined
                }
              >
                {d}
                {today_bool && !selected && (
                  <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[var(--c-accent-soft)]" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
