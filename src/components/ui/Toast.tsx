/**
 * First shared toast/snackbar in this app (previously every "toast" was a
 * one-off inline implementation, e.g. CaptureBar's). Positioned like
 * RestPill (src/components/train/RestPill.tsx) -- left-aligned with a
 * max-width, not centered -- so it never overlaps the coach FAB parked at
 * right-4 on mobile, the same standing rule CaptureBar documents.
 */
export function Toast({
  message,
  actionLabel,
  onAction,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div
      role="status"
      className="rtd-glass rtd-fade-in fixed z-40 left-4 right-auto bottom-[calc(env(safe-area-inset-bottom)+84px)] max-w-[calc(100vw-96px)] md:left-6 md:bottom-6 md:max-w-sm flex items-center gap-3 px-4 py-2.5 rounded-full"
    >
      <span className="text-subhead text-[var(--rtd-text)] truncate">{message}</span>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="rtd-tap-target shrink-0 text-subhead font-semibold text-[var(--rtd-blue)] cursor-pointer active:scale-95 transition-transform duration-150 ease-out"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
