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
  return (
    <div
      className={`flex p-1 gap-1 rounded-full bg-white/[0.06] border border-[var(--rtd-hairline)] ${className ?? ""}`}
      role="tablist"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            data-active={active}
            onClick={() => onChange(opt.value)}
            className="rtd-segmented-btn flex-1 min-h-11 px-3 py-1.5 rounded-full text-subhead font-medium cursor-pointer transition-[background-color,transform] duration-200 ease-out active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2"
            style={{ color: active ? "#fff" : "var(--rtd-text-secondary)" }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
