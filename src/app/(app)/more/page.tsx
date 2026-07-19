import Link from "next/link";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { GlassCard } from "@/components/ui/GlassCard";
import { IconChevronRight } from "@/components/ui/icons";
import { LogoutButton } from "@/components/more/LogoutButton";

// Ordered by frequency of use: Coach and Recovery are daily-use screens,
// School and Business are checked periodically, Settings is occasional.
const LINKS = [
  { href: "/more/coach-ai", label: "Coach", desc: "Chat with your AI coach about training, food, meets", icon: "🤖" },
  { href: "/more/recovery", label: "Recovery", desc: "Sleep, soreness, readiness lights", icon: "🌙" },
  { href: "/school", label: "School", desc: "Courses, assignments, Canvas sync", icon: "🎓" },
  { href: "/business", label: "Business", desc: "Ventures, income, expenses, tasks", icon: "💼" },
  { href: "/more/settings", label: "Settings", desc: "ASEAN toggle, water target, MCP connector", icon: "⚙️" },
];

export default function MorePage() {
  return (
    <div className="flex flex-col gap-4 rtd-fade-in pt-1 md:max-w-xl md:mx-auto">
      <SectionLabel>More</SectionLabel>
      <div className="flex flex-col gap-3">
        {LINKS.map((link) => (
          <Link key={link.href} href={link.href}>
            <GlassCard interactive className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/[0.06] flex items-center justify-center text-lg shrink-0">
                {link.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-body font-semibold">{link.label}</div>
                <div className="text-footnote text-[var(--rtd-text-tertiary)] truncate">{link.desc}</div>
              </div>
              <IconChevronRight />
            </GlassCard>
          </Link>
        ))}
      </div>
      <LogoutButton />
    </div>
  );
}
