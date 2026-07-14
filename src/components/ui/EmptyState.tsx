import { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rtd-glass flex flex-col items-center text-center gap-2 py-10 px-6">
      {icon && (
        <div className="w-12 h-12 flex items-center justify-center rounded-full bg-white/5 text-[var(--rtd-text-tertiary)] mb-1">
          {icon}
        </div>
      )}
      <div className="text-sm font-semibold text-[var(--rtd-text)]">{title}</div>
      {body && <div className="text-xs text-[var(--rtd-text-tertiary)] max-w-[26ch]">{body}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
