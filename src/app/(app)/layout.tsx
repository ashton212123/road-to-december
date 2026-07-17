import { TabBar, SideBar, type TabItem } from "@/components/ui/TabBar";
import { IconHome, IconTrain, IconFuel, IconAnalytics, IconBusiness, IconMore } from "@/components/ui/icons";

// Every screen under here reads live, personal, auth-gated data (today's
// date, logs, alerts) — never statically prerender it at build time.
export const dynamic = "force-dynamic";

const NAV_ITEMS: TabItem[] = [
  { href: "/home", label: "Home", icon: <IconHome /> },
  { href: "/train", label: "Train", icon: <IconTrain /> },
  { href: "/fuel", label: "Fuel", icon: <IconFuel /> },
  { href: "/analytics", label: "Analytics", icon: <IconAnalytics /> },
  { href: "/business", label: "Business", icon: <IconBusiness /> },
  { href: "/more", label: "More", icon: <IconMore /> },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex flex-col md:flex-row max-w-6xl w-full mx-auto md:gap-6 md:px-6 md:py-6">
      <SideBar items={NAV_ITEMS} />
      <main className="flex-1 min-w-0 max-w-[430px] md:max-w-none w-full mx-auto pb-24 md:pb-6 px-4 pt-[calc(env(safe-area-inset-top)+16px)] md:pt-0">
        {children}
      </main>
      <TabBar items={NAV_ITEMS} />
    </div>
  );
}
