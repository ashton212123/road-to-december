import { SectionHeader } from "@/components/ui/SectionHeader";
import { TerminalPanel } from "@/components/ui/TerminalPanel";
import { EmptyState } from "@/components/ui/EmptyState";
import { AssignmentRow } from "@/components/school/AssignmentRow";
import { CanvasRefreshButton } from "@/components/school/CanvasRefreshButton";
import { getCanvasSummary } from "@/lib/canvas/sync";
import { withRetry } from "@/lib/db/withRetry";

export default async function SchoolPage() {
  const { configured, courses, assignments, syncedAt, error } = await withRetry(() => getCanvasSummary(), { label: "Canvas summary" });

  if (!configured) {
    return (
      <div className="flex flex-col gap-4 pt-1 md:max-w-2xl md:mx-auto">
        <SectionHeader title="School" className="mb-2" />
        <EmptyState
          icon="🎓"
          title="Canvas isn't connected yet"
          body="Set CANVAS_BASE_URL and CANVAS_ACCESS_TOKEN (a personal access token from Canvas → Account → Settings) as environment variables to see courses, assignments, and grades here."
        />
      </div>
    );
  }

  const unsubmitted = assignments.filter((a) => !a.submitted);
  const submitted = assignments.filter((a) => a.submitted);

  return (
    <div className="flex flex-col gap-4 pt-1 md:max-w-4xl md:mx-auto">
      <SectionHeader title="School" className="mb-2" />

      {error && (
        <TerminalPanel className="border border-[var(--rtd-red)]/30">
          <div className="text-body font-semibold text-[var(--rtd-red)] mb-1">Canvas sync issue</div>
          <div className="text-subhead text-[var(--rtd-text-secondary)]">{error}</div>
        </TerminalPanel>
      )}

      <CanvasRefreshButton syncedAt={syncedAt} />

      {courses.length === 0 ? (
        <EmptyState title="No active courses found" body="Check back once your courses are published on Canvas." />
      ) : (
        <div className="flex flex-col gap-4 md:grid md:grid-cols-2 md:gap-4 md:items-start">
          <div>
            <SectionHeader title="Courses" className="mb-2" />
            <TerminalPanel className="gap-2">
              {courses.map((c) => (
                <div key={c.id} className="flex items-center justify-between text-body">
                  <span className="text-[var(--rtd-text)]">{c.name}</span>
                  <span className="text-[var(--rtd-text-secondary)]">{c.currentGrade ?? "—"}</span>
                </div>
              ))}
            </TerminalPanel>
          </div>

          <div>
            <SectionHeader title="Assignments due" className="mb-2" />
            {unsubmitted.length === 0 ? (
              <EmptyState title="Nothing outstanding" body="Every assignment is submitted or has no due date yet." />
            ) : (
              <TerminalPanel className="rtd-divide-y rtd-stagger">
                {unsubmitted.map((a) => (
                  <AssignmentRow key={a.id} assignment={a} />
                ))}
              </TerminalPanel>
            )}
          </div>

          {submitted.length > 0 && (
            <div className="md:col-span-2">
              <SectionHeader title="Submitted" className="mb-2" />
              <TerminalPanel className="rtd-divide-y rtd-stagger">
                {submitted.map((a) => (
                  <AssignmentRow key={a.id} assignment={a} />
                ))}
              </TerminalPanel>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
