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
            onClick={() => onChange(opt.value)}
            className="flex-1 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200"
            style={{
              background: active ? "rgba(255,255,255,0.16)" : "transparent",
              color: active ? "#fff" : "var(--rtd-text-secondary)",
              boxShadow: active ? "0 2px 6px rgba(0,0,0,0.35)" : "none",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
