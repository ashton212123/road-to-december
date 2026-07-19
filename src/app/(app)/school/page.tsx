import { SectionLabel } from "@/components/ui/SectionLabel";
import { GlassCard } from "@/components/ui/GlassCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { AssignmentRow } from "@/components/school/AssignmentRow";
import { CanvasRefreshButton } from "@/components/school/CanvasRefreshButton";
import { getCanvasSummary } from "@/lib/canvas/sync";
import { withRetry } from "@/lib/db/withRetry";

export default async function SchoolPage() {
  const { configured, courses, assignments, syncedAt, error } = await withRetry(() => getCanvasSummary());

  if (!configured) {
    return (
      <div className="flex flex-col gap-4 rtd-fade-in pt-1 md:max-w-xl md:mx-auto">
        <SectionLabel>School</SectionLabel>
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
    <div className="flex flex-col gap-4 rtd-fade-in pt-1 md:max-w-xl md:mx-auto">
      <SectionLabel>School</SectionLabel>

      {error && (
        <GlassCard className="border border-[var(--rtd-red)]/30">
          <div className="text-body font-semibold text-[var(--rtd-red)] mb-1">Canvas sync issue</div>
          <div className="text-subhead text-[var(--rtd-text-secondary)]">{error}</div>
        </GlassCard>
      )}

      <CanvasRefreshButton syncedAt={syncedAt} />

      {courses.length === 0 ? (
        <EmptyState title="No active courses found" body="Check back once your courses are published on Canvas." />
      ) : (
        <>
          <div>
            <SectionLabel>Courses</SectionLabel>
            <GlassCard className="flex flex-col gap-2">
              {courses.map((c) => (
                <div key={c.id} className="flex items-center justify-between text-body">
                  <span className="text-[var(--rtd-text)]">{c.name}</span>
                  <span className="text-[var(--rtd-text-secondary)]">{c.currentGrade ?? "—"}</span>
                </div>
              ))}
            </GlassCard>
          </div>

          <div>
            <SectionLabel>Assignments due</SectionLabel>
            {unsubmitted.length === 0 ? (
              <EmptyState title="Nothing outstanding" body="Every assignment is submitted or has no due date yet." />
            ) : (
              <GlassCard className="flex flex-col divide-y divide-white/[0.06] rtd-stagger">
                {unsubmitted.map((a) => (
                  <AssignmentRow key={a.id} assignment={a} />
                ))}
              </GlassCard>
            )}
          </div>

          {submitted.length > 0 && (
            <div>
              <SectionLabel>Submitted</SectionLabel>
              <GlassCard className="flex flex-col divide-y divide-white/[0.06] rtd-stagger">
                {submitted.map((a) => (
                  <AssignmentRow key={a.id} assignment={a} />
                ))}
              </GlassCard>
            </div>
          )}
        </>
      )}
    </div>
  );
}
