"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { deleteSwimSessionAction } from "@/app/(app)/analytics/actions";

/** Two-tap arm/confirm -- no modal system in this app, and a single-tap
 * delete on a page whose entire purpose is showing one session's data is too
 * easy to hit by accident. Disarms itself after 4s of no second tap. */
export function DeleteSessionButton({ sessionId }: { sessionId: number }) {
  const [armed, setArmed] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    if (!armed) {
      setArmed(true);
      setTimeout(() => setArmed(false), 4000);
      return;
    }
    startTransition(async () => {
      await deleteSwimSessionAction(sessionId);
      router.push("/swim/sessions");
    });
  }

  return (
    <Button variant={armed ? "danger" : "ghost"} disabled={pending} onClick={handleClick} className="w-full">
      {pending ? "Deleting…" : armed ? "Tap again to permanently delete" : "Delete session"}
    </Button>
  );
}
