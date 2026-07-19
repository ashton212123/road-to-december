"use client";

import { useState, useTransition } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { logTransactionAction } from "@/app/(app)/business/actions";

export function TransactionLogger({ businessId }: { businessId: number }) {
  const [type, setType] = useState<"income" | "expense">("income");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    const parsed = Number(amount);
    if (!parsed || parsed <= 0 || !description.trim()) return;
    startTransition(async () => {
      await logTransactionAction({ businessId, type, amountPhp: parsed, description: description.trim() });
      setAmount("");
      setDescription("");
    });
  }

  return (
    <GlassCard className="flex flex-col gap-3">
      <SegmentedControl
        value={type}
        onChange={setType}
        options={[
          { value: "income", label: "Income" },
          { value: "expense", label: "Expense" },
        ]}
      />
      <div className="grid grid-cols-3 gap-2">
        <input
          inputMode="decimal"
          placeholder="₱ amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="rounded-lg bg-white/[0.06] px-3 py-2 text-subhead text-center outline-none col-span-1"
        />
        <input
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="rounded-lg bg-white/[0.06] px-3 py-2 text-subhead outline-none col-span-2"
        />
      </div>
      <Button
        variant={type === "income" ? "secondary" : "danger"}
        disabled={pending || !amount || !description.trim()}
        onClick={submit}
      >
        Log {type}
      </Button>
    </GlassCard>
  );
}
