import { AppNav } from "@/components/nav/AppNav";

// Every screen under here reads live, personal, auth-gated data (today's
// date, logs, alerts) — never statically prerender it at build time. Kept
// on this file (not AppNav) because a route-segment config export can't
// live in a "use client" file.
export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppNav>{children}</AppNav>;
}
