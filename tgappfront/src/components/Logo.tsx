type Props = {
  onClick?: () => void;
};

export function Logo({ onClick }: Props) {
  return (
    <div
      className={`flex items-center gap-4 select-none ${onClick ? "cursor-pointer" : ""}`}
      onClick={onClick}
    >
      <div className="logo-svg-drop flex-shrink-0">
        <svg
          className="w-[54px] h-[54px] text-[var(--c-logo-svg)]"
          viewBox="0 0 100 100"
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="butt"
          strokeLinejoin="miter"
        >
          <polygon points="50,6 90.1,28 90.1,72 50,94 9.9,72 9.9,28" />
          <polygon points="50,17 79.8,34.2 79.8,65.8 50,83 20.2,65.8 20.2,34.2" />
          <path d="M 52,50 L 68.5,50 L 68.5,59.3 L 50,70 L 31.5,59.3 L 31.5,40.7 L 50,30 L 64,38.1" />
        </svg>
      </div>

      <div className="logo-text-glow flex flex-col justify-center leading-[0.95] font-black uppercase text-[var(--c-logo-text)]">
        <div className="text-[19px] tracking-[0.03em]">Grand</div>
        <div className="text-[19px] tracking-[0.03em] mt-0.5">Store</div>
      </div>
    </div>
  );
}
