"use client";

import { useEffect, useRef, useState } from "react";

export function ProgressRing({
  pct,
  size = 64,
  strokeWidth = 7,
  color = "var(--rtd-blue)",
  trackColor = "rgba(255,255,255,0.08)",
  label,
  sub,
  className,
  ariaLabel,
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
  /** Screen-reader description, e.g. "Calories: 1200 of 3400". Omit only when adjacent visible text already conveys the same value unambiguously. */
  ariaLabel?: string;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const targetOffset = circumference * (1 - clamped / 100);

  // Renders at the final offset for SSR (no flash of an empty ring pre-hydration);
  // on mount, briefly resets to fully-empty so the CSS transition can reveal the
  // fill. Later prop changes animate directly to their new target.
  const [offset, setOffset] = useState(targetOffset);
  const mounted = useRef(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || mounted.current) {
      setOffset(targetOffset);
      mounted.current = true;
      return;
    }
    mounted.current = true;
    setOffset(circumference);
    const raf1 = requestAnimationFrame(() => {
      const raf2 = requestAnimationFrame(() => setOffset(targetOffset));
      return () => cancelAnimationFrame(raf2);
    });
    return () => cancelAnimationFrame(raf1);
  }, [targetOffset, circumference]);

  return (
    <div
      className={className ? `relative flex items-center justify-center ${className}` : "relative flex items-center justify-center"}
      style={className ? undefined : { width: size, height: size }}
      role={ariaLabel ? "img" : undefined}
      aria-label={ariaLabel}
    >
      <svg
        width={className ? "100%" : size}
        height={className ? "100%" : size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden="true"
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
          style={{ transition: "stroke-dashoffset 0.7s cubic-bezier(0.16, 1, 0.3, 1)" }}
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
