import { notFound } from "next/navigation";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { GlassCard } from "@/components/ui/GlassCard";
import { TransactionLogger } from "@/components/business/TransactionLogger";
import { TransactionList } from "@/components/business/TransactionList";
import { TaskList } from "@/components/business/TaskList";
import { NoteList } from "@/components/business/NoteList";
import { BusinessSettings } from "@/components/business/BusinessSettings";
import { getBusinessById, getBusinessTransactions, getBusinessTasks, getBusinessNotes } from "@/lib/db/queries";
import { computeProfit, formatPhp } from "@/lib/business/profit";
import { withRetry } from "@/lib/db/withRetry";

export default async function BusinessDetailPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId: businessIdParam } = await params;
  const businessId = Number(businessIdParam);
  if (!Number.isInteger(businessId)) notFound();

  const business = await withRetry(() => getBusinessById(businessId), { label: "Business detail" });
  if (!business) notFound();

  const [transactions, tasks, notes] = await withRetry(
    () =>
      Promise.all([
        getBusinessTransactions(businessId),
        getBusinessTasks(businessId),
        getBusinessNotes(businessId),
      ]),
    { label: "Business transactions/tasks/notes" }
  );

  const profit = computeProfit(transactions);

  return (
    <div className="flex flex-col gap-4 pt-1 md:max-w-2xl md:mx-auto">
      <SectionLabel>{business.name}</SectionLabel>
      {business.description && <p className="text-footnote text-[var(--rtd-text-tertiary)] -mt-2">{business.description}</p>}

      <GlassCard className="flex flex-col gap-1">
        <div className="text-footnote text-[var(--rtd-text-tertiary)]">Profit</div>
        <div className="text-large-title" style={{ color: profit.profit >= 0 ? "var(--rtd-green)" : "var(--rtd-red)" }}>
          {formatPhp(profit.profit)}
        </div>
        <div className="text-footnote text-[var(--rtd-text-secondary)]">
          {formatPhp(profit.income)} in · {formatPhp(profit.expense)} out
        </div>
      </GlassCard>

      <TransactionLogger businessId={businessId} />

      <div>
        <SectionLabel>Transactions</SectionLabel>
        <TransactionList
          businessId={businessId}
          transactions={transactions.map((t) => ({ id: t.id, type: t.type, amountPhp: t.amountPhp, description: t.description, date: t.date }))}
        />
      </div>

      <div>
        <SectionLabel>Tasks</SectionLabel>
        <TaskList businessId={businessId} tasks={tasks} />
      </div>

      <div>
        <SectionLabel>Notes</SectionLabel>
        <NoteList businessId={businessId} notes={notes} />
      </div>

      <div>
        <SectionLabel>Manage</SectionLabel>
        <BusinessSettings businessId={businessId} archived={business.archived} />
      </div>
    </div>
  );
}
