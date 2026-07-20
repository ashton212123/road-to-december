"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LogoutButton } from "@/components/more/LogoutButton";
import { TrainingStatusControl } from "@/components/more/TrainingStatusControl";
import type { TrainingStatus } from "@/app/(app)/more/actions";

const ITEMS = [
  { href: "/more/recovery", label: "Recovery", icon: "🌙" },
  { href: "/school", label: "School", icon: "🎓" },
  { href: "/business", label: "Business", icon: "💼" },
  { href: "/more/settings", label: "Settings", icon: "⚙️" },
];

/** Mobile-only avatar button in Home's header -- everything that used to
 * live under the bottom-tab "More" screen (now replaced by Coach) is reachable
 * from here, plus the compact row grid at the bottom of Home. */
export function MoreMenuButton({ trainingStatus }: { trainingStatus: TrainingStatus }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative md:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="More"
        aria-expanded={open}
        className="w-9 h-9 rounded-full flex items-center justify-center bg-white/[0.08] text-subhead cursor-pointer hover:brightness-110 active:scale-95 transition-transform duration-150 ease-out focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2"
      >
        👤
      </button>
      {open && (
        <div role="menu" className="rtd-glass rtd-glass-blur rtd-fade-in absolute right-0 top-11 z-30 w-64 p-2 flex flex-col gap-0.5 overflow-hidden">
          <div className="px-1 pb-1.5">
            <TrainingStatusControl current={trainingStatus} compact />
          </div>
          <div className="rtd-divider mb-1" />
          {ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-[8px] text-subhead text-[var(--rtd-text)] cursor-pointer hover:bg-white/[0.04] transition-colors duration-150 ease-out"
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
          <div className="rtd-divider mt-1 mb-1" />
          <LogoutButton />
        </div>
      )}
    </div>
  );
}
