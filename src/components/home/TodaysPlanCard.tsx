import Link from "next/link";
import { BentoCard } from "@/components/ui/BentoCard";
import { IconCheck } from "@/components/ui/icons";

type PlanRow = {
  key: string;
  time: string | null;
  title: string;
  done: boolean;
  href: string;
  color: string;
};

export function TodaysPlanCard({ rows, startHref }: { rows: PlanRow[]; startHref: string | null }) {
  return (
    <BentoCard label="Today's plan" colSpan={5} rowSpan={3}>
      <div className="flex flex-col gap-2 flex-1 min-h-0 overflow-y-auto">
        {rows.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-subhead text-[var(--rtd-text-tertiary)]">
            Rest day — nothing scheduled.
          </div>
        )}
        {rows.map((row) => (
          <Link
            key={row.key}
            href={row.href}
            className="flex items-center gap-3 rounded-[8px] px-2.5 py-2 -mx-1 hover:bg-white/[0.04] transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2"
          >
            <span
              className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
              style={{
                background: row.done ? row.color : "rgba(255,255,255,0.08)",
                border: row.done ? "none" : "1.5px solid rgba(255,255,255,0.25)",
                color: row.done ? "#0a0a0a" : "transparent",
              }}
            >
              <IconCheck size={13} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-subhead font-medium text-[var(--rtd-text)] truncate">{row.title}</div>
              {row.time && <div className="text-caption text-[var(--rtd-text-tertiary)] truncate">{row.time}</div>}
            </div>
          </Link>
        ))}
      </div>
      {startHref && (
        <Link
          href={startHref}
          className="rtd-btn-shiny mt-2 shrink-0 flex items-center justify-center text-white text-subhead font-semibold py-2.5 cursor-pointer hover:brightness-110 active:scale-[0.98] transition-transform duration-150 ease-out"
        >
          Start session →
        </Link>
      )}
    </BentoCard>
  );
}
