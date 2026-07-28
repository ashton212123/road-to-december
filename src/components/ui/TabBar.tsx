"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { useKeyboardOpen } from "@/lib/useKeyboardOpen";
import { SlidingPillNav } from "./SlidingPillNav";

export type TabItem = {
  href: string;
  label: string;
  icon: ReactNode;
  /** Extra path prefixes (besides `href`) that should also count as active — e.g. routes nested under a "More" tab. Plain strings, not a function, since this crosses the server/client boundary. */
  matchPrefixes?: string[];
  /** When set, SideBar renders a button that dispatches this DOM event name instead of a Link -- used for "Coach" opening the slide-over panel rather than navigating. */
  dispatchEvent?: string;
};

function isActive(item: TabItem, pathname: string) {
  if (item.matchPrefixes?.some((p) => pathname.startsWith(p))) return true;
  if (item.href === "/home") return pathname === "/home" || pathname === "/";
  return pathname.startsWith(item.href);
}

export function TabBar({ items }: { items: TabItem[] }) {
  const pathname = usePathname();
  const keyboardOpen = useKeyboardOpen();
  const activeItem = items.find((item) => isActive(item, pathname));

  // The keyboard replaces the bottom third of the screen -- a fixed dock
  // sitting on top of it just floats mid-content until dismissed.
  if (keyboardOpen) return null;

  return (
    <nav
      className="rtd-glass-blur fixed z-30 md:hidden rounded-full"
      style={{
        left: 12,
        right: 12,
        bottom: "calc(env(safe-area-inset-bottom) + 12px)",
        height: 64,
        background: "rgba(10,10,12,0.82)",
        border: "0.5px solid var(--rtd-hairline)",
        boxShadow: "var(--rtd-shadow)",
      }}
    >
      <SlidingPillNav activeKey={activeItem?.href ?? ""} className="flex items-stretch h-full px-1.5 gap-1">
        {items.map((item) => {
          const active = isActive(item, pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              data-pill-key={item.href}
              className="relative z-10 flex-1 min-w-0 min-h-11 flex flex-col items-center justify-center gap-0.5 cursor-pointer rounded-full transition-colors duration-200 ease-out focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2"
            >
              <span
                className="rtd-tab-icon w-5 h-5 flex items-center justify-center transition-colors duration-150 ease-out"
                data-active={active}
                style={{ color: active ? "#fff" : "var(--rtd-text-tertiary)" }}
              >
                {item.icon}
              </span>
              <span
                className="text-[10px] font-semibold truncate max-w-full transition-colors duration-150 ease-out"
                style={{ color: active ? "#fff" : "var(--rtd-text-tertiary)" }}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </SlidingPillNav>
    </nav>
  );
}

/** Fitonist-style desktop header: wordmark left, white-pill nav center,
 * secondary destinations as quiet icon buttons right. Replaces the sidebar —
 * the content field below runs full width like the reference dashboard. */
export function TopBar({ items, extras, railSwitcher }: { items: TabItem[]; extras: TabItem[]; railSwitcher?: ReactNode }) {
  const pathname = usePathname();
  const activeItem = items.find((item) => isActive(item, pathname));

  return (
    <header className="hidden md:flex items-center justify-between gap-4 w-full mb-6">
      <Link href="/home" className="flex items-baseline gap-1 shrink-0 focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2 rounded-md">
        <span className="text-title-3 font-extrabold tracking-tight">road</span>
        <span className="text-title-3 font-extrabold tracking-tight text-[var(--rtd-lilac)]">2dec</span>
      </Link>

      {railSwitcher && <div className="shrink-0">{railSwitcher}</div>}

      <SlidingPillNav
        activeKey={activeItem?.href ?? ""}
        aria-label="Primary"
        className="flex p-1 gap-1 rounded-full bg-white/[0.05] border border-[var(--rtd-border)]"
      >
        {items.map((item) => {
          const active = isActive(item, pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              data-pill-key={item.href}
              className="relative z-10 min-h-10 px-5 rounded-full text-subhead font-semibold flex items-center justify-center cursor-pointer transition-colors duration-200 ease-out focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2"
              style={{ color: active ? "#fff" : "var(--rtd-text-secondary)" }}
            >
              {item.label}
            </Link>
          );
        })}
      </SlidingPillNav>

      <div className="flex items-center gap-1.5 shrink-0">
        {extras.map((item) => {
          const active = !item.dispatchEvent && isActive(item, pathname);
          const cls = `w-10 h-10 flex items-center justify-center rounded-full border border-[var(--rtd-border)] cursor-pointer transition-colors duration-150 ease-out hover:bg-white/[0.08] focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2 ${active ? "rtd-pill-active" : ""}`;
          const style = { color: active ? "#fff" : "var(--rtd-text-secondary)" };
          if (item.dispatchEvent) {
            return (
              <button key={item.href} type="button" title={item.label} aria-label={item.label} onClick={() => window.dispatchEvent(new CustomEvent(item.dispatchEvent!))} className={cls} style={style}>
                <span className="w-5 h-5 flex items-center justify-center">{item.icon}</span>
              </button>
            );
          }
          return (
            <Link key={item.href} href={item.href} title={item.label} aria-label={item.label} className={cls} style={style}>
              <span className="w-5 h-5 flex items-center justify-center">{item.icon}</span>
            </Link>
          );
        })}
      </div>
    </header>
  );
}

export function SideBar({ items }: { items: TabItem[] }) {
  const pathname = usePathname();
  return (
    <nav
      className="hidden md:flex flex-col gap-1 w-[220px] shrink-0 rtd-glass p-3 h-fit sticky top-6"
    >
      {items.map((item) => {
        const active = isActive(item, pathname);
        const sharedClassName =
          "flex items-center gap-3 min-h-11 px-3 py-2.5 rounded-[8px] text-subhead font-medium cursor-pointer transition-colors duration-150 ease-out hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2";
        const sharedStyle = { background: active ? "rgba(10,132,255,0.14)" : undefined, color: active ? "var(--rtd-blue)" : "var(--rtd-text-secondary)" };

        if (item.dispatchEvent) {
          return (
            <button
              key={item.href}
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent(item.dispatchEvent!))}
              className={sharedClassName}
              style={sharedStyle}
            >
              <span className="w-5 h-5 flex items-center justify-center">{item.icon}</span>
              {item.label}
            </button>
          );
        }

        return (
          <Link key={item.href} href={item.href} className={sharedClassName} style={sharedStyle}>
            <span className="w-5 h-5 flex items-center justify-center">{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
