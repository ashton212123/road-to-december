export function ProgressRing({
  pct,
  size = 64,
  strokeWidth = 7,
  color = "var(--rtd-blue)",
  trackColor = "rgba(255,255,255,0.08)",
  label,
  sub,
  className,
}: {
  pct: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  label?: string;
  sub?: string;
  /** When set, sizes the ring via this class (e.g. responsive width/height utilities) instead of the fixed `size` px — `size` still drives the internal geometry/viewBox. */
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  return (
    <div
      className={className ? `relative flex items-center justify-center ${className}` : "relative flex items-center justify-center"}
      style={className ? undefined : { width: size, height: size }}
    >
      <svg
        width={className ? "100%" : size}
        height={className ? "100%" : size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
      </svg>
      {(label || sub) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {label && (
            <span className="text-subhead font-semibold text-[var(--rtd-text)]">{label}</span>
          )}
          {sub && <span className="text-caption text-[var(--rtd-text-tertiary)]">{sub}</span>}
        </div>
      )}
    </div>
  );
}
