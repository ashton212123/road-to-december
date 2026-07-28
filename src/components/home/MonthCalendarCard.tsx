import { TerminalPanel } from "@/components/ui/TerminalPanel";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

/** The Fitonist centerpiece, translated: a month-at-a-glance training
 * calendar. Days with a logged session (gym or swim) fill lilac, today gets
 * the white ring, and the footer states the month's session count in the
 * reference's big-number inset style. */
export function MonthCalendarCard({
  today,
  gymDates,
  swimDates,
  colSpan = 4,
  rowSpan = 3,
  className,
}: {
  today: string;
  gymDates: string[];
  swimDates: string[];
  colSpan?: number;
  rowSpan?: number;
  className?: string;
}) {
  const ym = today.slice(0, 7);
  const monthStart = new Date(`${ym}-01T00:00:00`);
  const monthLabel = monthStart.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
  const leadingBlanks = (monthStart.getDay() + 6) % 7; // Monday-first

  const gym = new Set(gymDates.filter((d) => d.startsWith(ym)));
  const swim = new Set(swimDates.filter((d) => d.startsWith(ym)));
  const sessionsThisMonth = new Set([...gym, ...swim]).size;

  return (
    <TerminalPanel label={monthLabel} colSpan={colSpan} rowSpan={rowSpan} className={className}>
      <div className="grid grid-cols-7 gap-1 flex-1 content-start">
        {WEEKDAYS.map((d, i) => (
          <span key={`h${i}`} className="text-caption text-[var(--rtd-text-tertiary)] text-center pb-0.5">
            {d}
          </span>
        ))}
        {Array.from({ length: leadingBlanks }, (_, i) => (
          <span key={`b${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const dateISO = `${ym}-${String(i + 1).padStart(2, "0")}`;
          const trained = gym.has(dateISO) || swim.has(dateISO);
          const both = gym.has(dateISO) && swim.has(dateISO);
          const isToday = dateISO === today;
          const future = dateISO > today;
          return (
            <span
              key={dateISO}
              className="aspect-square rounded-[9px] flex items-center justify-center text-footnote rtd-nums rtd-mono"
              style={{
                background: trained
                  ? both
                    ? "linear-gradient(135deg, var(--rtd-lilac), var(--rtd-cyan))"
                    : "var(--rtd-lilac)"
                  : "rgba(255,255,255,0.05)",
                color: trained ? "#0b0b0d" : future ? "var(--rtd-text-tertiary)" : "var(--rtd-text-secondary)",
                fontWeight: trained ? 700 : 500,
                outline: isToday ? "1.5px solid rgba(255,255,255,0.8)" : undefined,
                outlineOffset: 1.5,
                opacity: future && !trained ? 0.55 : 1,
              }}
            >
              {i + 1}
            </span>
          );
        })}
      </div>
      <div className="mt-3 rounded-[14px] border border-[var(--rtd-border)] bg-black/40 px-4 py-2.5 flex items-baseline justify-between">
        <span className="rtd-big-num rtd-mono" style={{ fontSize: 28 }}>
          {sessionsThisMonth}
        </span>
        <span className="text-footnote text-[var(--rtd-text-secondary)]">training days this month</span>
      </div>
    </TerminalPanel>
  );
}
