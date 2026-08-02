import Link from "next/link";
import { TerminalPanel } from "@/components/ui/TerminalPanel";
import { EmptyState } from "@/components/ui/EmptyState";
import { ZoneDistributionBar } from "@/components/swim/ZoneDistributionBar";
import { todayManilaISO, addDaysISO, mondayOf } from "@/lib/time";
import { classifySession, TYPE_LABELS, type SessionType } from "@/lib/swim/sessionType";
import type { ZoneDistance } from "@/lib/swim/zones";
import { getSwimSessionsListData, WEEKS_CAP } from "./data";

function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function weekLabel(mondayISO: string): string {
  const d = new Date(`${mondayISO}T00:00:00`);
  return `Week of ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

export async function SwimSessionsContent({ typeFilter }: { typeFilter: SessionType | "all" }) {
  const today = todayManilaISO();
  const since = addDaysISO(today, -7 * WEEKS_CAP);
  const rows = await getSwimSessionsListData(since);

  // sessionType is already the server-computed classification from save
  // time; older rows that predate it fall back to a live recompute so
  // nothing in the list ever shows as unclassified.
  const classified = rows.map((s) => {
    const zoneDistance = (s.zoneDistanceM ?? {}) as ZoneDistance;
    const type = (s.sessionType as SessionType | null) ?? classifySession(zoneDistance, s.parsedDistanceM ?? 0).type;
    return { ...s, type, zoneDistance };
  });

  const filtered = typeFilter === "all" ? classified : classified.filter((s) => s.type === typeFilter);

  const byWeek = new Map<string, typeof filtered>();
  for (const s of filtered) {
    const wk = mondayOf(s.date);
    const arr = byWeek.get(wk);
    if (arr) arr.push(s);
    else byWeek.set(wk, [s]);
  }
  const weeks = [...byWeek.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));

  if (weeks.length === 0) {
    return (
      <EmptyState
        title="No sessions in this window"
        body={typeFilter === "all" ? "Log a session and it'll show up here." : "No sessions of this type in the last 26 weeks."}
      />
    );
  }

  return (
    <>
      {weeks.map(([weekStart, weekSessions]) => {
        const totalM = weekSessions.reduce((sum, s) => sum + (s.parsedDistanceM ?? 0), 0);
        const breastKickM = weekSessions.reduce((sum, s) => sum + (s.breastKickM ?? 0), 0);
        const combinedZone: ZoneDistance = {};
        for (const s of weekSessions) {
          for (const [z, m] of Object.entries(s.zoneDistance)) {
            const zone = z as keyof ZoneDistance;
            combinedZone[zone] = (combinedZone[zone] ?? 0) + (m ?? 0);
          }
        }
        const sorted = [...weekSessions].sort((a, b) => (a.date < b.date ? 1 : -1));

        return (
          <div key={weekStart} className="flex flex-col gap-2">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-footnote font-semibold text-[var(--rtd-text)]">{weekLabel(weekStart)}</span>
                <span className="text-caption text-[var(--rtd-text-secondary)] rtd-nums rtd-mono">
                  {weekSessions.length} session{weekSessions.length === 1 ? "" : "s"}
                  {totalM > 0 ? ` · ${totalM.toLocaleString()}m` : ""}
                  {breastKickM > 0 ? ` · ${breastKickM}m BR kick` : ""}
                </span>
              </div>
              <ZoneDistributionBar zoneDistance={combinedZone} totalM={totalM} height={6} />
            </div>
            <TerminalPanel variant="open" gap="none" className="rtd-divide-y">
              {sorted.map((s) => (
                <Link
                  key={s.id}
                  href={`/swim/session/${s.id}`}
                  className="rtd-tap-target flex items-center justify-between gap-2 py-2 first:pt-0 last:pb-0 -mx-1 px-1 rounded-[6px] cursor-pointer hover:bg-white/[0.03] transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2"
                >
                  <span className="text-footnote text-[var(--rtd-text)] shrink-0 rtd-mono">{shortDate(s.date)}</span>
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="text-caption px-1.5 py-0.5 rounded-full bg-white/[0.08] text-[var(--rtd-text-secondary)] shrink-0 truncate">
                      {TYPE_LABELS[s.type].replace(" session", "")}
                    </span>
                    <span className="text-caption rtd-nums rtd-mono text-[var(--rtd-text-tertiary)] shrink-0 w-16 text-right">
                      {s.parsedDistanceM ? `${s.parsedDistanceM.toLocaleString()}m` : "—"}
                    </span>
                  </span>
                </Link>
              ))}
            </TerminalPanel>
          </div>
        );
      })}
    </>
  );
}
