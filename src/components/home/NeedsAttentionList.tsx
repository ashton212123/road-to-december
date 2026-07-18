import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";
import { DOMAIN_META, sortAttentionItems, type AttentionItem } from "@/lib/dashboard/needsAttention";

export function NeedsAttentionList({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) return null;
  const sorted = sortAttentionItems(items);
  const domainsPresent = [...new Set(sorted.map((i) => i.domain))];

  return (
    <GlassCard className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {domainsPresent.map((d) => (
          <div key={d} className="flex items-center gap-1.5 text-caption text-[var(--rtd-text-secondary)]">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: DOMAIN_META[d].color }} />
            {DOMAIN_META[d].label}
          </div>
        ))}
      </div>

      <div className="flex flex-col divide-y divide-white/[0.06]">
        {sorted.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className="flex items-center gap-2.5 py-2 first:pt-0 last:pb-0 rounded-lg px-1.5 -mx-1.5 cursor-pointer hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2 active:scale-[0.98] transition-transform duration-150 ease-out"
          >
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: DOMAIN_META[item.domain].color }} />
            <div className="flex-1 min-w-0">
              <div className="text-footnote text-[var(--rtd-text)] truncate">{item.label}</div>
              {item.detail && <div className="text-caption text-[var(--rtd-text-secondary)] truncate">{item.detail}</div>}
            </div>
            {item.urgent && (
              <span className="shrink-0 text-caption font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-[var(--rtd-red)]/15 text-[var(--rtd-red)]">
                Urgent
              </span>
            )}
          </Link>
        ))}
      </div>
    </GlassCard>
  );
}
