import { notFound } from "next/navigation";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { TerminalPanel } from "@/components/ui/TerminalPanel";
import { TransactionLogger } from "@/components/business/TransactionLogger";
import { TransactionList } from "@/components/business/TransactionList";
import { TaskList } from "@/components/business/TaskList";
import { NoteList } from "@/components/business/NoteList";
import { BusinessSettings } from "@/components/business/BusinessSettings";
import { getBusinessById, getBusinessTransactions, getBusinessTasks, getBusinessNotes } from "@/lib/db/queries";
import { computeProfit, formatPhp } from "@/lib/business/profit";
import { withRetry } from "@/lib/db/withRetry";
import { withFallback } from "@/lib/db/withFallback";

export default async function BusinessDetailPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId: businessIdParam } = await params;
  const businessId = Number(businessIdParam);
  if (!Number.isInteger(businessId)) notFound();

  const business = await withRetry(() => getBusinessById(businessId), { label: "Business detail" });
  if (!business) notFound();

  const [transactions, tasks, notes] = await Promise.all([
    withFallback(withRetry(() => getBusinessTransactions(businessId), { label: "Business detail: transactions" }), []),
    withFallback(withRetry(() => getBusinessTasks(businessId), { label: "Business detail: tasks" }), []),
    withFallback(withRetry(() => getBusinessNotes(businessId), { label: "Business detail: notes" }), []),
  ]);

  const profit = computeProfit(transactions);

  return (
    <div className="flex flex-col gap-4 pt-1 md:max-w-2xl md:mx-auto">
      <SectionHeader title={business.name} className="mb-2" />
      {business.description && <p className="text-footnote text-[var(--rtd-text-tertiary)] -mt-2">{business.description}</p>}

      <TerminalPanel className="gap-1">
        <div className="text-footnote text-[var(--rtd-text-tertiary)]">Profit</div>
        <div className="text-large-title rtd-nums rtd-mono" style={{ color: profit.profit >= 0 ? "var(--rtd-green)" : "var(--rtd-red)" }}>
          {formatPhp(profit.profit)}
        </div>
        <div className="text-footnote text-[var(--rtd-text-secondary)] rtd-nums rtd-mono">
          {formatPhp(profit.income)} in · {formatPhp(profit.expense)} out
        </div>
      </TerminalPanel>

      <TransactionLogger businessId={businessId} />

      <div>
        <SectionHeader title="Transactions" className="mb-2" />
        <TransactionList
          businessId={businessId}
          transactions={transactions.map((t) => ({ id: t.id, type: t.type, amountPhp: t.amountPhp, description: t.description, date: t.date }))}
        />
      </div>

      <div>
        <SectionHeader title="Tasks" className="mb-2" />
        <TaskList businessId={businessId} tasks={tasks} />
      </div>

      <div>
        <SectionHeader title="Notes" className="mb-2" />
        <NoteList businessId={businessId} notes={notes} />
      </div>

      <div>
        <SectionHeader title="Manage" className="mb-2" />
        <BusinessSettings businessId={businessId} archived={business.archived} />
      </div>
    </div>
  );
}
