export type TransactionLike = { type: string; amountPhp: string | number };

export function computeProfit(transactions: TransactionLike[]) {
  let income = 0;
  let expense = 0;
  for (const t of transactions) {
    const amt = Number(t.amountPhp);
    if (t.type === "income") income += amt;
    else expense += amt;
  }
  return { income, expense, profit: income - expense };
}

export function formatPhp(amount: number): string {
  return `₱${amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
