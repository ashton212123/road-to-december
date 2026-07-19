"use client";

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  const activeIndex = Math.max(0, options.findIndex((o) => o.value === value));

  return (
    <div
      className={`relative flex p-1 gap-1 rounded-full bg-white/[0.06] border border-[var(--rtd-hairline)] ${className ?? ""}`}
      role="tablist"
    >
      {/* Sliding glass thumb -- positioned by percentage against equal-width
          flex-1 options, so it works without measuring pixel widths. */}
      <div
        aria-hidden="true"
        className="absolute top-1 bottom-1 rounded-full bg-white/[0.12] border border-[var(--rtd-hairline)] transition-[left] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{
          left: `calc(${(activeIndex / options.length) * 100}% + 4px)`,
          width: `calc(${100 / options.length}% - 8px)`,
        }}
      />
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            data-active={active}
            onClick={() => onChange(opt.value)}
            className="relative z-10 flex-1 min-h-11 px-3 py-1.5 rounded-full text-subhead font-medium cursor-pointer transition-colors duration-200 ease-out active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2"
            style={{ color: active ? "#fff" : "var(--rtd-text-secondary)" }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
