import { TabBar, SideBar, type TabItem } from "@/components/ui/TabBar";
import { CoachPanel, OPEN_COACH_EVENT } from "@/components/coach/CoachPanel";
import { IconHome, IconTrain, IconFuel, IconAnalytics, IconBusiness, IconSchool, IconMore, IconSparkle } from "@/components/ui/icons";

// Every screen under here reads live, personal, auth-gated data (today's
// date, logs, alerts) — never statically prerender it at build time.
export const dynamic = "force-dynamic";

// Desktop sidebar keeps all seven top-level sections, plus Coach -- clicking
// it opens the same slide-over panel as the floating button (CoachPanel),
// not a navigation, since it's meant as instant access from any page.
const SIDEBAR_ITEMS: TabItem[] = [
  { href: "/home", label: "Home", icon: <IconHome /> },
  { href: "/train", label: "Train", icon: <IconTrain /> },
  { href: "/fuel", label: "Fuel", icon: <IconFuel /> },
  { href: "/analytics", label: "Analytics", icon: <IconAnalytics /> },
  { href: "#coach", label: "Coach", icon: <IconSparkle />, dispatchEvent: OPEN_COACH_EVENT },
  { href: "/business", label: "Business", icon: <IconBusiness /> },
  { href: "/school", label: "School", icon: <IconSchool /> },
  { href: "/more", label: "More", icon: <IconMore /> },
];

// Mobile bottom bar: Coach takes the center slot (full-screen chat at
// /more/coach-ai) in place of the old "More" tab. Business/School/Recovery/
// Settings/logout move to Home's avatar menu + More row instead (routes
// unchanged, just reached differently).
const TAB_BAR_ITEMS: TabItem[] = [
  { href: "/home", label: "Home", icon: <IconHome /> },
  { href: "/train", label: "Train", icon: <IconTrain /> },
  { href: "/more/coach-ai", label: "Coach", icon: <IconSparkle /> },
  { href: "/fuel", label: "Fuel", icon: <IconFuel /> },
  { href: "/analytics", label: "Analytics", icon: <IconAnalytics /> },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex flex-col md:flex-row max-w-6xl w-full mx-auto md:gap-6 md:px-6 md:py-6">
      <SideBar items={SIDEBAR_ITEMS} />
      <main className="flex-1 min-w-0 max-w-[430px] md:max-w-none w-full mx-auto pb-24 md:pb-6 px-4 pt-[calc(env(safe-area-inset-top)+16px)] md:pt-0">
        {children}
      </main>
      <TabBar items={TAB_BAR_ITEMS} />
      <CoachPanel />
    </div>
  );
}
