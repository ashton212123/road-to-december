import { db } from "@/lib/db";
import { canvasCourses, canvasAssignments } from "@/lib/db/schema";
import {
  fetchCanvasCourses,
  fetchCanvasAssignments,
  isCanvasConfigured,
  CanvasAuthError,
  CanvasError,
} from "./client";

const STALE_AFTER_MS = 20 * 60 * 1000; // avoid hammering Canvas on every page load

export async function syncCanvasData(): Promise<void> {
  const courses = await fetchCanvasCourses();
  const assignmentLists = await Promise.all(courses.map((c) => fetchCanvasAssignments(c.id)));
  const assignments = assignmentLists.flat();
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx.delete(canvasAssignments);
    await tx.delete(canvasCourses);
    if (courses.length > 0) {
      await tx.insert(canvasCourses).values(courses.map((c) => ({ ...c, syncedAt: now })));
    }
    if (assignments.length > 0) {
      await tx.insert(canvasAssignments).values(
        assignments.map((a) => ({
          id: a.id,
          courseId: a.courseId,
          name: a.name,
          dueAt: a.dueAt ? new Date(a.dueAt) : null,
          submitted: a.submitted,
          pointsPossible: a.pointsPossible !== null ? String(a.pointsPossible) : null,
          score: a.score !== null ? String(a.score) : null,
          htmlUrl: a.htmlUrl,
          syncedAt: now,
        }))
      );
    }
  });
}

export type CanvasAssignmentWithCourse = {
  id: number;
  courseId: number;
  courseName: string;
  name: string;
  dueAt: Date | null;
  submitted: boolean;
  pointsPossible: number | null;
  score: number | null;
  htmlUrl: string | null;
};

export type CanvasSummary = {
  configured: boolean;
  courses: { id: number; name: string; courseCode: string | null; currentGrade: string | null }[];
  assignments: CanvasAssignmentWithCourse[];
  syncedAt: string | null;
  error: string | null;
};

/** Reads cached Canvas data, refreshing from the live API first if the cache
 * is missing/stale. Never throws — sync failures surface as `error` so a
 * page can show a clear banner (e.g. expired token) without crashing, and
 * still serve whatever was last cached. */
export async function getCanvasSummary(): Promise<CanvasSummary> {
  if (!isCanvasConfigured()) {
    return { configured: false, courses: [], assignments: [], syncedAt: null, error: null };
  }

  const cachedCourses = await db.select().from(canvasCourses);
  const isStale = cachedCourses.length === 0 || Date.now() - cachedCourses[0].syncedAt.getTime() > STALE_AFTER_MS;

  let error: string | null = null;
  if (isStale) {
    try {
      await syncCanvasData();
    } catch (err) {
      error =
        err instanceof CanvasAuthError || err instanceof CanvasError
          ? err.message
          : "Failed to sync Canvas data.";
    }
  }

  const courses = await db.select().from(canvasCourses);
  const assignmentRows = await db.select().from(canvasAssignments);
  const courseNameById = new Map(courses.map((c) => [c.id, c.name]));

  return {
    configured: true,
    courses,
    assignments: assignmentRows
      .map((a) => ({
        id: a.id,
        courseId: a.courseId,
        courseName: courseNameById.get(a.courseId) ?? "Unknown course",
        name: a.name,
        dueAt: a.dueAt,
        submitted: a.submitted,
        pointsPossible: a.pointsPossible !== null ? Number(a.pointsPossible) : null,
        score: a.score !== null ? Number(a.score) : null,
        htmlUrl: a.htmlUrl,
      }))
      .sort((a, b) => (a.dueAt?.getTime() ?? Infinity) - (b.dueAt?.getTime() ?? Infinity)),
    syncedAt: courses[0]?.syncedAt.toISOString() ?? null,
    error,
  };
}

const URGENT_WINDOW_MS = 3 * 24 * 60 * 60 * 1000; // due within 3 days -- general "priorities" list
const CRITICAL_WINDOW_MS = 48 * 60 * 60 * 1000; // due within 48h -- distinct, more severe "urgent" tier

export function getUrgentAssignments(assignments: CanvasAssignmentWithCourse[], now = new Date()) {
  return assignments.filter(
    (a) => !a.submitted && a.dueAt !== null && a.dueAt.getTime() - now.getTime() <= URGENT_WINDOW_MS
  );
}

/** Stricter than getUrgentAssignments -- due within 48h, unsubmitted. Feeds the
 * rules-engine "Coach" alerts (a distinct, more prominent tier than the
 * general Priorities merge) rather than the everyday due-soon list. */
export function getCriticalAssignments(assignments: CanvasAssignmentWithCourse[], now = new Date()) {
  return assignments.filter(
    (a) => !a.submitted && a.dueAt !== null && a.dueAt.getTime() - now.getTime() <= CRITICAL_WINDOW_MS
  );
}
