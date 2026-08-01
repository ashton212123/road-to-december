"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TerminalPanel } from "@/components/ui/TerminalPanel";
import { Button } from "@/components/ui/Button";
import { setBusinessArchivedAction, deleteBusinessAction } from "@/app/(app)/business/actions";

export function BusinessSettings({ businessId, archived }: { businessId: number; archived: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <TerminalPanel>
      <Button
        variant="secondary"
        disabled={pending}
        onClick={() => startTransition(() => setBusinessArchivedAction(businessId, !archived))}
      >
        {archived ? "Unarchive venture" : "Archive venture"}
      </Button>

      {confirmingDelete ? (
        <div className="flex gap-2">
          <Button
            variant="danger"
            disabled={pending}
            className="flex-1"
            onClick={() =>
              startTransition(async () => {
                await deleteBusinessAction(businessId);
                router.push("/business");
              })
            }
          >
            Confirm delete
          </Button>
          <Button variant="ghost" disabled={pending} className="flex-1" onClick={() => setConfirmingDelete(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button variant="ghost" disabled={pending} onClick={() => setConfirmingDelete(true)}>
          Delete venture (permanent)
        </Button>
      )}
    </TerminalPanel>
  );
}
