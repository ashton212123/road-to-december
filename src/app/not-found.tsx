import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="flex-1 flex items-center justify-center p-6 rtd-app-bg min-h-dvh">
      <GlassCard className="max-w-sm text-center flex flex-col items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-2xl">🧭</div>
        <div className="rtd-display text-title-3">Page not found</div>
        <p className="text-subhead text-[var(--rtd-text-secondary)]">That screen doesn&apos;t exist.</p>
        <Link href="/home">
          <Button className="mt-1">Back to Home</Button>
        </Link>
      </GlassCard>
    </div>
  );
}
