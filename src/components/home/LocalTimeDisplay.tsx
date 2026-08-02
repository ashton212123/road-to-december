"use client";

import { useEffect, useState } from "react";

/** Client-side-only clock for the "02 // SESSION" card header (§4d/WS5 §0
 * Task 4D). Renders nothing until after mount -- `new Date()` during SSR
 * would bake the server's clock into the markup and mismatch the browser's
 * on hydration, so the first real render happens client-side only. */
export function LocalTimeDisplay() {
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    function tick() {
      setTime(new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }));
    }
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  if (!time) return null;

  return (
    <div className="flex flex-col items-start leading-tight gap-0.5 shrink-0">
      <span className="text-caption font-semibold rtd-nums rtd-mono text-[var(--rtd-text-secondary)]">{time}</span>
      <span className="rtd-micro-label">LOCAL TIME</span>
    </div>
  );
}
