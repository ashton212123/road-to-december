"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";

const initialState: LoginState = { error: null };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <div className="flex-1 flex items-center justify-center p-6 rtd-app-bg min-h-dvh">
      <GlassCard className="w-full max-w-sm flex flex-col gap-5 rtd-fade-in">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[var(--rtd-blue)]/15 flex items-center justify-center text-2xl">
            🏊
          </div>
          <h1 className="rtd-display text-title-2">Road to December</h1>
          <p className="text-subhead text-[var(--rtd-text-tertiary)]">Personal athlete command center</p>
        </div>

        <form action={formAction} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="rtd-micro-label">Password</span>
            <input
              type="password"
              name="password"
              autoFocus
              autoComplete="current-password"
              required
              className="rtd-glass px-4 py-3 bg-white/[0.04] text-[var(--rtd-text)] text-subhead outline-none focus:ring-2 focus:ring-[var(--rtd-blue)]/50"
            />
          </label>
          {state.error && (
            <p className="text-footnote text-[var(--rtd-red)]" role="alert">
              {state.error}
            </p>
          )}
          <Button type="submit" disabled={pending} className="w-full mt-1">
            {pending ? "Checking…" : "Enter"}
          </Button>
        </form>
      </GlassCard>
    </div>
  );
}
