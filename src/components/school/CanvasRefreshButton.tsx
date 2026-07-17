"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { refreshCanvasAction } from "@/app/(app)/school/actions";

export function CanvasRefreshButton({ syncedAt }: { syncedAt: string | null }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    setError(null);
    startTransition(async () => {
      const result = await refreshCanvasAction();
      setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[var(--rtd-text-tertiary)]">
          {syncedAt ? `Synced ${new Date(syncedAt).toLocaleTimeString()}` : "Not synced yet"}
        </span>
        <Button variant="ghost" disabled={pending} onClick={refresh} className="!py-1 !px-2 !text-xs">
          {pending ? "Syncing…" : "Sync now"}
        </Button>
      </div>
      {error && <div className="text-[11px] text-[var(--rtd-red)]">{error}</div>}
    </div>
  );
}
