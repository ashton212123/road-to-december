import { TabBar, TopBar, type TabItem } from "@/components/ui/TabBar";
import { CoachPanel, OPEN_COACH_EVENT } from "@/components/coach/CoachPanel";
import { IconHome, IconTrain, IconFuel, IconAnalytics, IconBusiness, IconSchool, IconMore, IconSparkle, IconSwim, IconBook } from "@/components/ui/icons";

// Every screen under here reads live, personal, auth-gated data (today's
// date, logs, alerts) — never statically prerender it at build time.
export const dynamic = "force-dynamic";

// Fitonist-style desktop header: five primary destinations as white-pill nav
// (Swim is top-level now, not an Analytics tab); Coach/Business/School/More
// live as icon buttons on the right. Coach dispatches the slide-over panel,
// not a navigation.
const PRIMARY_ITEMS: TabItem[] = [
  { href: "/home", label: "Home", icon: <IconHome /> },
  { href: "/train", label: "Train", icon: <IconTrain /> },
  { href: "/swim", label: "Swim", icon: <IconSwim /> },
  { href: "/fuel", label: "Fuel", icon: <IconFuel /> },
  { href: "/analytics", label: "Analytics", icon: <IconAnalytics /> },
];

const EXTRA_ITEMS: TabItem[] = [
  { href: "#coach", label: "Coach", icon: <IconSparkle />, dispatchEvent: OPEN_COACH_EVENT },
  { href: "/learn", label: "Learn", icon: <IconBook /> },
  { href: "/business", label: "Business", icon: <IconBusiness /> },
  { href: "/school", label: "School", icon: <IconSchool /> },
  { href: "/more", label: "More", icon: <IconMore /> },
];

// Mobile bottom dock mirrors the five primaries. Coach stays reachable via
// the floating button + Home avatar menu (full-screen chat at /more/coach-ai).
const TAB_BAR_ITEMS: TabItem[] = PRIMARY_ITEMS;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    // Full-width shell, Fitonist header on desktop; the 1600px cap lives on
    // <main> alone so content centers on ultra-wide displays.
    <div className="flex-1 flex flex-col w-full px-3 md:px-6 lg:px-10 md:py-6">
      <TopBar items={PRIMARY_ITEMS} extras={EXTRA_ITEMS} />
      <main className="flex-1 min-w-0 max-w-[1600px] w-full mx-auto pb-[calc(env(safe-area-inset-bottom)+92px)] md:pb-6 pt-[calc(env(safe-area-inset-top)+16px)] md:pt-0">
        {children}
      </main>
      <TabBar items={TAB_BAR_ITEMS} />
      <CoachPanel />
    </div>
  );
}
