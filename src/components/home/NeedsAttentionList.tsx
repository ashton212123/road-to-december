import Link from "next/link";
import clsx from "clsx";
import { TerminalPanel } from "@/components/ui/TerminalPanel";
import { StatusChip } from "@/components/ui/StatusChip";
import { IconCheck } from "@/components/ui/icons";
import { DOMAIN_META, sortAttentionItems, type AttentionItem } from "@/lib/dashboard/needsAttention";

export function NeedsAttentionList({ items, className }: { items: AttentionItem[]; className?: string }) {
  if (items.length === 0) {
    return (
      <TerminalPanel variant="open" className={clsx("items-center justify-center text-center", className)}>
        <span
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
          style={{ background: "color-mix(in srgb, var(--rtd-green) 16%, transparent)", color: "var(--rtd-green)" }}
        >
          <IconCheck size={16} />
        </span>
        <span className="text-subhead font-semibold" style={{ color: "var(--rtd-green)" }}>
          All clear
        </span>
        <span className="text-caption text-[var(--rtd-text-tertiary)]">No alerts yet today</span>
      </TerminalPanel>
    );
  }
  const sorted = sortAttentionItems(items);
  const domainsPresent = [...new Set(sorted.map((i) => i.domain))];

  return (
    <TerminalPanel variant="open" label="NEEDS ATTENTION" number="08" className={className}>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {domainsPresent.map((d) => (
          <div key={d} className="flex items-center gap-1.5 text-caption text-[var(--rtd-text-secondary)]">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: DOMAIN_META[d].color }} />
            {DOMAIN_META[d].label}
          </div>
        ))}
      </div>

      <div className="flex flex-col rtd-divide-y rtd-stagger overflow-y-auto min-h-0">
        {sorted.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className="rtd-tap-target flex items-center gap-2.5 py-2 first:pt-0 last:pb-0 rounded-lg px-1.5 -mx-1.5 cursor-pointer hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2 active:scale-[0.98] transition-transform duration-150 ease-out"
          >
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: DOMAIN_META[item.domain].color }} />
            <div className="flex-1 min-w-0">
              <div className="text-footnote text-[var(--rtd-text)] truncate">{item.label}</div>
              {item.detail && <div className="text-caption text-[var(--rtd-text-secondary)] truncate">{item.detail}</div>}
            </div>
            {item.urgent && <StatusChip label="Urgent" tone="danger" />}
          </Link>
        ))}
      </div>
    </TerminalPanel>
  );
}
