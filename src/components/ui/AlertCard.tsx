"use client";

import { ReactNode } from "react";

export type AlertTone = "info" | "warning" | "danger" | "success";

const TONE_COLORS: Record<AlertTone, string> = {
  info: "var(--rtd-blue)",
  warning: "var(--rtd-orange)",
  danger: "var(--rtd-red)",
  success: "var(--rtd-green)",
};

export function AlertCard({
  tone = "info",
  title,
  body,
  onDismiss,
  action,
}: {
  tone?: AlertTone;
  title: string;
  body: string;
  onDismiss?: () => void;
  action?: ReactNode;
}) {
  const color = TONE_COLORS[tone];
  return (
    <div
      className="rtd-glass rtd-fade-in p-3.5 flex gap-3 items-start"
      style={{ borderLeft: `3px solid ${color}` }}
    >
      <div className="flex-1 min-w-0">
        <div className="text-body font-semibold" style={{ color }}>
          {title}
        </div>
        <div className="text-subhead text-[var(--rtd-text-secondary)] mt-0.5 leading-snug">
          {body}
        </div>
        {action && <div className="mt-2">{action}</div>}
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="rtd-tap-target shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-[var(--rtd-text-tertiary)] cursor-pointer transition-colors duration-150 ease-out hover:bg-white/10 hover:text-[var(--rtd-text)] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2 text-subhead"
        >
          ✕
        </button>
      )}
    </div>
  );
}
