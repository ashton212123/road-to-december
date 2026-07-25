import { SectionLabel } from "@/components/ui/SectionLabel";
import { GroupedList, GroupedListRow } from "@/components/ui/GroupedList";
import { IconChevronRight } from "@/components/ui/icons";
import { LogoutButton } from "@/components/more/LogoutButton";

// Coach has its own tab/floating panel now (see AppLayout) -- this list is
// reached via Home's avatar menu or More row on mobile, and the sidebar on
// desktop. Ordered by frequency of use: Recovery is daily, School/Business
// are periodic, Settings is occasional.
const LINKS = [
  { href: "/more/coach-ai", label: "Coach", desc: "Full-screen chat with today's context", icon: "✨" },
  { href: "/more/recovery", label: "Recovery", desc: "Sleep, soreness, readiness lights", icon: "🌙" },
  { href: "/learn", label: "Learn", desc: "Python, ML, cybersecurity, project-based tracks", icon: "📚" },
  { href: "/school", label: "School", desc: "Courses, assignments, Canvas sync", icon: "🎓" },
  { href: "/business", label: "Business", desc: "Ventures, income, expenses, tasks", icon: "💼" },
  { href: "/more/settings", label: "Settings", desc: "ASEAN toggle, water target, MCP connector", icon: "⚙️" },
];

export default function MorePage() {
  return (
    <div className="flex flex-col gap-4 pt-1 md:max-w-2xl md:mx-auto">
      <SectionLabel>More</SectionLabel>
      <GroupedList>
        {LINKS.map((link) => (
          <GroupedListRow
            key={link.href}
            href={link.href}
            label={link.label}
            desc={link.desc}
            icon={<span className="text-lg">{link.icon}</span>}
            trailing={<IconChevronRight className="text-[var(--rtd-text-tertiary)] shrink-0" />}
          />
        ))}
      </GroupedList>
      <LogoutButton />
    </div>
  );
}
