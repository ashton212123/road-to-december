import { GlassCard } from "@/components/ui/GlassCard";

export default function OfflinePage() {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <GlassCard className="max-w-sm text-center flex flex-col items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-2xl">
          📡
        </div>
        <div className="rtd-display text-lg">You&apos;re offline</div>
        <p className="text-sm text-[var(--rtd-text-secondary)]">
          Road to December works offline for pages you&apos;ve already opened. Reconnect to sync new
          logs, or keep browsing what&apos;s cached.
        </p>
      </GlassCard>
    </div>
  );
}
