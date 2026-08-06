import { useState, useRef, useEffect } from "react";
import { COUNTRIES, formatPhoneDigits } from "../utils/phone";

type Props = {
  value: string;
  onChange: (value: string) => void;
  countryIdx?: number;
  onCountryChange?: (idx: number) => void;
  placeholder?: string;
};

export function PhoneInput({ value, onChange, countryIdx: controlledIdx, onCountryChange, placeholder }: Props) {
  const [internalIdx, setInternalIdx] = useState(0);
  const [showCountries, setShowCountries] = useState(false);
  const countryIdx = controlledIdx ?? internalIdx;
  const country = COUNTRIES[countryIdx];
  const countryListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (countryListRef.current && !countryListRef.current.contains(e.target as Node)) {
        setShowCountries(false);
      }
    }
    if (showCountries) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showCountries]);

  function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    const digits = raw.replace(/\D/g, "");
    const maxDigits = country.mask.replace(/[^9]/g, "").length;
    const trimmed = digits.slice(0, maxDigits);
    onChange(formatPhoneDigits(trimmed, country.mask));
  }

  function selectCountry(idx: number) {
    setShowCountries(false);
    if (onCountryChange) {
      onCountryChange(idx);
    } else {
      setInternalIdx(idx);
    }
    onChange("");
  }

  return (
    <div className="relative flex w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] focus-within:border-[var(--c-accent-border)]">
      <div ref={countryListRef} className="relative">
        <button
          type="button"
          onClick={() => setShowCountries(!showCountries)}
          className="flex h-full items-center gap-1.5 border-r border-[var(--c-border)] px-3 py-3 text-sm transition hover:bg-[var(--c-surface-hover)]"
        >
          <span>{country.flag}</span>
          <span className="text-xs text-[var(--c-text-70)]">{country.code}</span>
          <svg className="h-3 w-3 text-[var(--c-text-40)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6" /></svg>
        </button>
        {showCountries && (
          <div className="absolute left-0 top-full z-[100] mt-1 max-h-60 w-64 overflow-y-auto rounded-xl border border-[var(--c-border)] bg-[var(--c-bg)] shadow-xl">
            {COUNTRIES.map((c, i) => (
              <button
                key={c.code + c.name}
                type="button"
                onClick={() => selectCountry(i)}
                className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition hover:bg-[var(--c-surface)] ${i === countryIdx ? "bg-[var(--c-surface)]" : ""}`}
              >
                <span className="text-lg">{c.flag}</span>
                <span className="text-xs text-[var(--c-text-50)]">{c.code}</span>
                <span className="text-xs text-[var(--c-text-70)]">{c.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <input
        type="tel"
        inputMode="numeric"
        placeholder={placeholder ?? country.mask}
        value={value}
        onChange={handlePhoneChange}
        className="min-w-0 flex-1 bg-transparent px-3 py-3 text-base text-[var(--c-text)] outline-none placeholder:text-[var(--c-text-40)]"
      />
    </div>
  );
}
