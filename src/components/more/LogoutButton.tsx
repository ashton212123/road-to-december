"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { logoutAction } from "@/app/login/actions";

export function LogoutButton() {
  const [pending, startTransition] = useTransition();
  return (
    <Button variant="ghost" disabled={pending} onClick={() => startTransition(() => logoutAction())}>
      Log out
    </Button>
  );
}
