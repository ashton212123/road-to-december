"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

/**
 * Shared glide-without-drift pill container for every tab/segmented
 * selector (TabBar, TopBar nav, AnalyticsTabs, PeriodSelector,
 * SegmentedControl). Renders one absolutely-positioned thumb div and
 * measures the active item's real box (offsetLeft/Top/Width/Height) via
 * ResizeObserver, mutating the thumb's style directly -- zero setState, so
 * this is compiler-clean by construction and can never drift the way the
 * old percentage-of-index formula did.
 *
 * Usage: wrap the item list, give each item `data-pill-key={value}` and
 * `className="relative z-10 ..."` (items must NOT carry .rtd-pill-active
 * themselves -- only the thumb does now).
 */
export function SlidingPillNav({
  activeKey,
  className,
  role,
  "aria-label": ariaLabel,
  children,
}: {
  activeKey: string;
  className?: string;
  role?: string;
  "aria-label"?: string;
  children: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const thumb = thumbRef.current;
    if (!container || !thumb) return;

    function position() {
      if (!container || !thumb) return;
      const active = container.querySelector<HTMLElement>(`[data-pill-key="${CSS.escape(activeKey)}"]`);
      if (!active) return;
      thumb.style.transform = `translate(${active.offsetLeft}px, ${active.offsetTop}px)`;
      thumb.style.width = `${active.offsetWidth}px`;
      thumb.style.height = `${active.offsetHeight}px`;
      // First measurement: skip the transition so the thumb doesn't glide
      // in from (0,0) on mount -- enabled one frame later via this data
      // attribute, matched by the CSS in globals.css.
      if (thumb.dataset.ready !== "true") {
        requestAnimationFrame(() => {
          if (thumb) thumb.dataset.ready = "true";
        });
      }
    }

    position();
    const observer = new ResizeObserver(position);
    observer.observe(container);
    return () => observer.disconnect();
  }, [activeKey]);

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`} role={role} aria-label={ariaLabel}>
      <div ref={thumbRef} className="rtd-pill-thumb rtd-pill-active" aria-hidden="true" />
      {children}
    </div>
  );
}
