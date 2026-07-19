"use client";

import { useEffect, useRef, useState } from "react";

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Tweens a number up from 0 on mount, and smoothly between values on later
 * updates. Renders `value` directly on the server (no hydration mismatch);
 * the count-up is a client-only reveal. Skips animation entirely under
 * prefers-reduced-motion.
 *
 * `prefix`/`suffix`/`decimals` (not a formatter callback) so this stays
 * passable from Server Components — functions can't cross that boundary.
 */
export function AnimatedNumber({
  value,
  duration = 700,
  decimals = 0,
  prefix = "",
  suffix = "",
}: {
  value: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
}) {
  const [display, setDisplay] = useState(value);
  const prevValue = useRef(value);
  const mounted = useRef(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const from = mounted.current ? prevValue.current : 0;
    mounted.current = true;

    if (reduced || from === value) {
      setDisplay(value);
      prevValue.current = value;
      return;
    }

    const start = performance.now();
    let raf: number;
    function tick(now: number) {
      const t = Math.min(1, (now - start) / duration);
      setDisplay(from + (value - from) * easeOutCubic(t));
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        prevValue.current = value;
      }
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return (
    <>
      {prefix}
      {display.toFixed(decimals)}
      {suffix}
    </>
  );
}
