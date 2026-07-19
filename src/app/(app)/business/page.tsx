import Link from "next/link";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { GlassCard } from "@/components/ui/GlassCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconChevronRight } from "@/components/ui/icons";
import { NewBusinessForm } from "@/components/business/NewBusinessForm";
import { getBusinesses, getAllBusinessTransactions } from "@/lib/db/queries";
import { computeProfit, formatPhp } from "@/lib/business/profit";
import { withRetry } from "@/lib/db/withRetry";

export default async function BusinessPage() {
  const [allBusinesses, allTransactions] = await withRetry(() =>
    Promise.all([getBusinesses(), getAllBusinessTransactions()])
  );

  const byBusiness = new Map<number, typeof allTransactions>();
  for (const t of allTransactions) {
    if (!byBusiness.has(t.businessId)) byBusiness.set(t.businessId, []);
    byBusiness.get(t.businessId)!.push(t);
  }

  const overall = computeProfit(allTransactions);
  const active = allBusinesses.filter((b) => !b.archived);
  const archived = allBusinesses.filter((b) => b.archived);

  return (
    <div className="flex flex-col gap-4 rtd-fade-in pt-1 md:max-w-3xl md:mx-auto">
      <SectionLabel>Business</SectionLabel>

      {allBusinesses.length > 0 && (
        <GlassCard className="flex flex-col gap-1">
          <div className="text-footnote text-[var(--rtd-text-tertiary)]">Overall profit</div>
          <div
            className="text-large-title rtd-nums"
            style={{ color: overall.profit >= 0 ? "var(--rtd-green)" : "var(--rtd-red)" }}
          >
            {formatPhp(overall.profit)}
          </div>
          <div className="text-footnote text-[var(--rtd-text-secondary)] rtd-nums">
            {formatPhp(overall.income)} in · {formatPhp(overall.expense)} out
          </div>
        </GlassCard>
      )}

      {active.length === 0 && archived.length === 0 ? (
        <EmptyState
          icon="💼"
          title="No ventures yet"
          body="Add a venture to start tracking income, expenses, tasks, and notes."
        />
      ) : (
        <div className="flex flex-col gap-3 md:grid md:grid-cols-2 md:gap-3">
          {active.map((b) => {
            const profit = computeProfit(byBusiness.get(b.id) ?? []);
            return (
              <Link key={b.id} href={`/business/${b.id}`}>
                <GlassCard interactive className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-body font-semibold truncate">{b.name}</div>
                    {b.description && (
                      <div className="text-footnote text-[var(--rtd-text-tertiary)] truncate">{b.description}</div>
                    )}
                  </div>
                  <div
                    className="text-headline shrink-0"
                    style={{ color: profit.profit >= 0 ? "var(--rtd-green)" : "var(--rtd-red)" }}
                  >
                    {formatPhp(profit.profit)}
                  </div>
                  <IconChevronRight />
                </GlassCard>
              </Link>
            );
          })}
        </div>
      )}

      <NewBusinessForm />

      {archived.length > 0 && (
        <div>
          <SectionLabel>Archived</SectionLabel>
          <div className="flex flex-col gap-3 md:grid md:grid-cols-2 md:gap-3">
            {archived.map((b) => (
              <Link key={b.id} href={`/business/${b.id}`}>
                <GlassCard interactive className="flex items-center gap-3 opacity-60">
                  <div className="flex-1 min-w-0">
                    <div className="text-body font-semibold truncate">{b.name}</div>
                  </div>
                  <IconChevronRight />
                </GlassCard>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
