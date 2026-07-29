import Link from "next/link";
import { TerminalPanel } from "@/components/ui/TerminalPanel";
import { EmptyState } from "@/components/ui/EmptyState";
import { TYPE_LABELS, type SessionType } from "@/lib/swim/sessionType";

type Session = {
  id: number;
  date: string;
  loadRating: number;
  setsText: string | null;
  parsedDistanceM: number | null;
  sessionType: string | null;
};

export function SwimSessionList({ sessions }: { sessions: Session[] }) {
  if (sessions.length === 0) {
    return <EmptyState title="No swim sessions logged yet" body="Log training load above after your next practice." />;
  }

  return (
    <TerminalPanel variant="open" gap="none" className="rtd-divide-y">
      {sessions.slice(0, 10).map((s) => (
        <Link
          key={s.id}
          href={`/swim/session/${s.id}`}
          className="rtd-tap-target flex items-center justify-between gap-2 py-2 first:pt-0 last:pb-0 -mx-1 px-1 rounded-[6px] cursor-pointer hover:bg-white/[0.03] transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2"
        >
          <div className="min-w-0">
            <span className="text-footnote text-[var(--rtd-text)] rtd-mono">{s.date}</span>
            {s.setsText && <div className="text-caption text-[var(--rtd-text-tertiary)] truncate">{s.setsText}</div>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {s.sessionType && (
              <span className="text-caption px-1.5 py-0.5 rounded-full bg-white/[0.08] text-[var(--rtd-text-secondary)]">
                {TYPE_LABELS[s.sessionType as SessionType]?.replace(" session", "") ?? s.sessionType}
              </span>
            )}
            <span className="text-caption rtd-nums rtd-mono text-[var(--rtd-text-tertiary)] w-16 text-right">
              {s.parsedDistanceM ? `${s.parsedDistanceM.toLocaleString()}m` : "—"}
            </span>
          </div>
        </Link>
      ))}
    </TerminalPanel>
  );
}
