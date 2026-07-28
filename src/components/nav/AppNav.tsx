"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { TabBar, TopBar, type TabItem } from "@/components/ui/TabBar";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { CoachPanel, OPEN_COACH_EVENT } from "@/components/coach/CoachPanel";
import { CaptureBar } from "@/components/home/CaptureBar";
import {
  IconHome,
  IconTrain,
  IconFuel,
  IconAnalytics,
  IconBusiness,
  IconSchool,
  IconMore,
  IconSparkle,
  IconSwim,
  IconTask,
  IconJournal,
  IconBrain,
  IconMoon,
  IconBook,
  IconSettings,
} from "@/components/ui/icons";

type Rail = "athlete" | "life";
const RAIL_STORAGE_KEY = "rtd-rail";

const ATHLETE_PRIMARY: TabItem[] = [
  { href: "/home", label: "Home", icon: <IconHome /> },
  { href: "/train", label: "Train", icon: <IconTrain /> },
  { href: "/swim", label: "Swim", icon: <IconSwim /> },
  { href: "/fuel", label: "Fuel", icon: <IconFuel /> },
  { href: "/analytics", label: "Analytics", icon: <IconAnalytics /> },
];

const LIFE_PRIMARY: TabItem[] = [
  { href: "/home", label: "Home", icon: <IconHome /> },
  { href: "/life/crm", label: "CRM", icon: <IconTask /> },
  { href: "/life/brain", label: "Brain", icon: <IconBrain /> },
  { href: "/life/journal", label: "Journal", icon: <IconJournal /> },
  { href: "/school", label: "School", icon: <IconSchool /> },
];

const ATHLETE_EXTRA: TabItem[] = [
  { href: "/more/recovery", label: "Recovery", icon: <IconMoon /> },
  { href: "/learn", label: "Learn", icon: <IconBook /> },
];

const LIFE_EXTRA: TabItem[] = [
  { href: "/business", label: "Business", icon: <IconBusiness /> },
  { href: "/more/settings", label: "Settings", icon: <IconSettings /> },
];

// Coach/More are rail-agnostic per §8a ("More remains the overflow on both") --
// always present regardless of which rail is active.
const COMMON_EXTRA: TabItem[] = [
  { href: "#coach", label: "Coach", icon: <IconSparkle />, dispatchEvent: OPEN_COACH_EVENT },
  { href: "/more", label: "More", icon: <IconMore /> },
];

const ATHLETE_PREFIXES = ["/train", "/swim", "/fuel", "/analytics", "/more/recovery", "/learn"];
const LIFE_PREFIXES = ["/life", "/school", "/business", "/more/settings"];

/** Home, /more (its own hub), /more/coach-ai, /login, /offline are rail-
 * agnostic and must never force a rail switch (§8b: "Home is shared and
 * identical in both rails"). Everything else maps to exactly one rail. */
function railForPath(pathname: string): Rail | null {
  if (ATHLETE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return "athlete";
  if (LIFE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return "life";
  return null;
}

export function AppNav({ children }: { children: ReactNode }) {
  const [rail, setRail] = useState<Rail>("athlete");
  const pathname = usePathname();

  // Restore the persisted rail after mount. setTimeout(fn, 0) sidesteps
  // react-hooks/set-state-in-effect (§3.2), this app's established pattern
  // (CrmClient.tsx, Phase 3) for a one-shot localStorage read.
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(RAIL_STORAGE_KEY);
        if (stored === "athlete" || stored === "life") setRail(stored);
      } catch {
        // ignore
      }
    }, 0);
    return () => clearTimeout(id);
  }, []);

  // Deep-linking into a rail-exclusive tab auto-selects the right rail (§8a).
  useEffect(() => {
    const resolved = railForPath(pathname);
    if (!resolved) return;
    const id = setTimeout(() => setRail(resolved), 0);
    return () => clearTimeout(id);
  }, [pathname]);

  function changeRail(next: Rail) {
    setRail(next);
    try {
      window.localStorage.setItem(RAIL_STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }

  const primaryItems = rail === "athlete" ? ATHLETE_PRIMARY : LIFE_PRIMARY;
  const extraItems = [...(rail === "athlete" ? ATHLETE_EXTRA : LIFE_EXTRA), ...COMMON_EXTRA];

  const railSwitcher = (
    <SegmentedControl
      options={[
        { value: "athlete", label: "ATHLETE" },
        { value: "life", label: "LIFE" },
      ]}
      value={rail}
      onChange={changeRail}
    />
  );

  return (
    <div className="flex-1 flex flex-col w-full px-3 md:px-6 lg:px-10 md:py-6">
      <TopBar items={primaryItems} extras={extraItems} railSwitcher={railSwitcher} />
      <div className="md:hidden pt-[calc(env(safe-area-inset-top)+10px)] flex justify-center">{railSwitcher}</div>
      <main className="flex-1 min-w-0 max-w-[1600px] w-full mx-auto pb-[calc(env(safe-area-inset-bottom)+156px)] md:pb-6 pt-2 md:pt-0">
        {children}
      </main>
      <CaptureBar />
      <TabBar items={primaryItems} />
      <CoachPanel />
    </div>
  );
}
