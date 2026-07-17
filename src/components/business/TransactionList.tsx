"use client";

import { useTransition } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { deleteTransactionAction } from "@/app/(app)/business/actions";
import { formatPhp } from "@/lib/business/profit";

type Transaction = { id: number; type: string; amountPhp: string; description: string; date: string };

export function TransactionList({ businessId, transactions }: { businessId: number; transactions: Transaction[] }) {
  const [pending, startTransition] = useTransition();

  if (transactions.length === 0) {
    return <EmptyState title="No transactions yet" body="Log your first income or expense above." />;
  }

  return (
    <GlassCard className="flex flex-col gap-2">
      {transactions.map((t) => (
        <div key={t.id} className="flex items-center justify-between text-xs">
          <div className="min-w-0">
            <span className="text-[var(--rtd-text)]">{t.description}</span>
            <div className="text-[10px] text-[var(--rtd-text-tertiary)]">{t.date}</div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className="font-semibold"
              style={{ color: t.type === "income" ? "var(--rtd-green)" : "var(--rtd-red)" }}
            >
              {t.type === "income" ? "+" : "−"}
              {formatPhp(Number(t.amountPhp))}
            </span>
            <button
              type="button"
              disabled={pending}
              onClick={() => startTransition(() => deleteTransactionAction(t.id, businessId))}
              className="text-[var(--rtd-red)]"
              aria-label="Delete transaction"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </GlassCard>
  );
}
