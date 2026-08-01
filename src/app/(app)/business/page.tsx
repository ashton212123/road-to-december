import Link from "next/link";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { TerminalPanel } from "@/components/ui/TerminalPanel";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconChevronRight } from "@/components/ui/icons";
import { NewBusinessForm } from "@/components/business/NewBusinessForm";
import { getBusinesses, getAllBusinessTransactions } from "@/lib/db/queries";
import { computeProfit, formatPhp } from "@/lib/business/profit";
import { withRetry } from "@/lib/db/withRetry";
import { withFallback } from "@/lib/db/withFallback";

export default async function BusinessPage() {
  const [allBusinesses, allTransactions] = await Promise.all([
    withFallback(withRetry(() => getBusinesses(), { label: "Business: ventures" }), []),
    withFallback(withRetry(() => getAllBusinessTransactions(), { label: "Business: transactions" }), []),
  ]);

  const byBusiness = new Map<number, typeof allTransactions>();
  for (const t of allTransactions) {
    if (!byBusiness.has(t.businessId)) byBusiness.set(t.businessId, []);
    byBusiness.get(t.businessId)!.push(t);
  }

  const overall = computeProfit(allTransactions);
  const active = allBusinesses.filter((b) => !b.archived);
  const archived = allBusinesses.filter((b) => b.archived);

  return (
    <div className="flex flex-col gap-4 pt-1 md:max-w-3xl md:mx-auto">
      <SectionHeader title="Business" className="mb-2" />

      {allBusinesses.length > 0 && (
        <TerminalPanel className="gap-1">
          <div className="text-footnote text-[var(--rtd-text-tertiary)]">Overall profit</div>
          <div
            className="text-large-title rtd-nums rtd-mono"
            style={{ color: overall.profit >= 0 ? "var(--rtd-green)" : "var(--rtd-red)" }}
          >
            {formatPhp(overall.profit)}
          </div>
          <div className="text-footnote text-[var(--rtd-text-secondary)] rtd-nums rtd-mono">
            {formatPhp(overall.income)} in · {formatPhp(overall.expense)} out
          </div>
        </TerminalPanel>
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
                <TerminalPanel interactive gap="none">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-body font-semibold truncate">{b.name}</div>
                      {b.description && (
                        <div className="text-footnote text-[var(--rtd-text-tertiary)] truncate">{b.description}</div>
                      )}
                    </div>
                    <div
                      className="text-headline shrink-0 rtd-nums rtd-mono"
                      style={{ color: profit.profit >= 0 ? "var(--rtd-green)" : "var(--rtd-red)" }}
                    >
                      {formatPhp(profit.profit)}
                    </div>
                    <IconChevronRight />
                  </div>
                </TerminalPanel>
              </Link>
            );
          })}
        </div>
      )}

      <NewBusinessForm />

      {archived.length > 0 && (
        <div>
          <SectionHeader title="Archived" className="mb-2" />
          <div className="flex flex-col gap-3 md:grid md:grid-cols-2 md:gap-3">
            {archived.map((b) => (
              <Link key={b.id} href={`/business/${b.id}`}>
                <TerminalPanel interactive gap="none" className="opacity-60">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-body font-semibold truncate">{b.name}</div>
                    </div>
                    <IconChevronRight />
                  </div>
                </TerminalPanel>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
