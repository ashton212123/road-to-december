import { GlassCard } from "@/components/ui/GlassCard";

export default function AppLoading() {
  return (
    <div className="flex flex-col gap-4 pt-1">
      {[0, 1, 2].map((i) => (
        <GlassCard key={i} className="h-20 animate-pulse">
          <div className="h-3 w-24 rounded bg-white/10 mb-3" />
          <div className="h-6 w-32 rounded bg-white/10" />
        </GlassCard>
      ))}
    </div>
  );
}
