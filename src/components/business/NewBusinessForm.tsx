"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TerminalPanel } from "@/components/ui/TerminalPanel";
import { Button } from "@/components/ui/Button";
import { createBusinessAction } from "@/app/(app)/business/actions";

export function NewBusinessForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)} className="w-full md:w-auto md:self-start md:px-8">
        + New venture
      </Button>
    );
  }

  function submit() {
    if (!name.trim()) return;
    startTransition(async () => {
      const created = await createBusinessAction({ name: name.trim(), description: description.trim() || null });
      setOpen(false);
      setName("");
      setDescription("");
      if (created) router.push(`/business/${created.id}`);
    });
  }

  return (
    <TerminalPanel>
      <input
        autoFocus
        placeholder="Venture name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="rounded-lg bg-white/[0.06] px-3 py-2 text-subhead outline-none"
      />
      <input
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="rounded-lg bg-white/[0.06] px-3 py-2 text-subhead outline-none"
      />
      <div className="flex gap-2">
        <Button variant="secondary" disabled={pending || !name.trim()} onClick={submit} className="flex-1">
          Create
        </Button>
        <Button variant="ghost" disabled={pending} onClick={() => setOpen(false)} className="flex-1">
          Cancel
        </Button>
      </div>
    </TerminalPanel>
  );
}
