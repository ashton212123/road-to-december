"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

export type TabItem = {
  href: string;
  label: string;
  icon: ReactNode;
  match?: (pathname: string) => boolean;
};

function isActive(item: TabItem, pathname: string) {
  if (item.match) return item.match(pathname);
  if (item.href === "/home") return pathname === "/home" || pathname === "/";
  return pathname.startsWith(item.href);
}

export function TabBar({ items }: { items: TabItem[] }) {
  const pathname = usePathname();
  return (
    <nav
      className="rtd-glass-blur fixed bottom-0 inset-x-0 z-30 md:hidden"
      style={{
        background: "rgba(20,20,22,0.72)",
        borderTop: "0.5px solid var(--rtd-hairline)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="flex items-stretch px-1 pt-2 pb-1 max-w-[430px] mx-auto">
        {items.map((item) => {
          const active = isActive(item, pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex-1 min-w-0 flex flex-col items-center gap-1 px-0.5 py-1"
            >
              <span
                className="w-6 h-6 flex items-center justify-center"
                style={{ color: active ? "var(--rtd-blue)" : "var(--rtd-text-tertiary)" }}
              >
                {item.icon}
              </span>
              <span
                className="text-[9px] font-medium truncate max-w-full"
                style={{ color: active ? "var(--rtd-blue)" : "var(--rtd-text-tertiary)" }}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function SideBar({ items }: { items: TabItem[] }) {
  const pathname = usePathname();
  return (
    <nav
      className="hidden md:flex flex-col gap-1 w-56 shrink-0 rtd-glass p-3 h-fit sticky top-6"
    >
      {items.map((item) => {
        const active = isActive(item, pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors"
            style={{
              background: active ? "rgba(10,132,255,0.14)" : "transparent",
              color: active ? "var(--rtd-blue)" : "var(--rtd-text-secondary)",
            }}
          >
            <span className="w-5 h-5 flex items-center justify-center">{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
