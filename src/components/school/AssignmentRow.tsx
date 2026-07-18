import type { CanvasAssignmentWithCourse } from "@/lib/canvas/sync";

function statusFor(a: CanvasAssignmentWithCourse, now: Date) {
  if (a.submitted) return { label: "Submitted", color: "var(--rtd-green)", bg: "rgba(48,209,88,0.14)" };
  if (a.dueAt && a.dueAt.getTime() < now.getTime())
    return { label: "Overdue", color: "var(--rtd-red)", bg: "rgba(255,69,58,0.14)" };
  if (a.dueAt && a.dueAt.getTime() - now.getTime() <= 3 * 24 * 60 * 60 * 1000)
    return { label: "Due soon", color: "var(--rtd-orange)", bg: "rgba(255,159,10,0.14)" };
  return { label: "Upcoming", color: "var(--rtd-text-secondary)", bg: "rgba(255,255,255,0.06)" };
}

export function AssignmentRow({ assignment, showCourse = true }: { assignment: CanvasAssignmentWithCourse; showCourse?: boolean }) {
  const now = new Date();
  const status = statusFor(assignment, now);
  const dueLabel = assignment.dueAt
    ? assignment.dueAt.toLocaleString("en-US", {
        timeZone: "Asia/Manila",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "No due date";

  const content = (
    <div className="flex items-center justify-between gap-2 text-body">
      <div className="min-w-0">
        <div className="text-[var(--rtd-text)] truncate">{assignment.name}</div>
        <div className="text-caption text-[var(--rtd-text-secondary)]">
          {showCourse ? `${assignment.courseName} · ` : ""}
          {dueLabel}
          {assignment.score !== null && assignment.pointsPossible !== null && (
            <span>
              {" "}
              · {assignment.score}/{assignment.pointsPossible}
            </span>
          )}
        </div>
      </div>
      <span
        className="shrink-0 text-caption font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full"
        style={{ background: status.bg, color: status.color }}
      >
        {status.label}
      </span>
    </div>
  );

  if (!assignment.htmlUrl) return <div className="py-1">{content}</div>;
  return (
    <a
      href={assignment.htmlUrl}
      target="_blank"
      rel="noreferrer"
      className="py-1 block cursor-pointer hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2 active:scale-[0.98] transition-transform duration-150 ease-out"
    >
      {content}
    </a>
  );
}
