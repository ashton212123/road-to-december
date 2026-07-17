export class CanvasAuthError extends Error {}
export class CanvasError extends Error {}

export function isCanvasConfigured(): boolean {
  return Boolean(process.env.CANVAS_BASE_URL && process.env.CANVAS_ACCESS_TOKEN);
}

function requireConfig() {
  const baseUrl = process.env.CANVAS_BASE_URL;
  const token = process.env.CANVAS_ACCESS_TOKEN;
  if (!baseUrl || !token) {
    throw new CanvasError("Canvas is not configured. Set CANVAS_BASE_URL and CANVAS_ACCESS_TOKEN.");
  }
  return { baseUrl: baseUrl.replace(/\/$/, ""), token };
}

async function canvasFetch(path: string): Promise<unknown> {
  const { baseUrl, token } = requireConfig();
  let res: Response;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  } catch {
    throw new CanvasError(`Could not reach Canvas at ${baseUrl}. Check CANVAS_BASE_URL.`);
  }
  if (res.status === 401 || res.status === 403) {
    throw new CanvasAuthError(
      "Canvas token expired or invalid. Generate a new one at Canvas → Account → Settings → New Access Token, then update CANVAS_ACCESS_TOKEN."
    );
  }
  if (!res.ok) {
    throw new CanvasError(`Canvas API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export type CanvasCourseRow = { id: number; name: string; courseCode: string | null; currentGrade: string | null };

export type CanvasAssignmentRow = {
  id: number;
  courseId: number;
  name: string;
  dueAt: string | null;
  submitted: boolean;
  pointsPossible: number | null;
  score: number | null;
  htmlUrl: string | null;
};

export async function fetchCanvasCourses(): Promise<CanvasCourseRow[]> {
  const data = (await canvasFetch(
    "/api/v1/courses?enrollment_state=active&include[]=total_scores&per_page=50"
  )) as Array<{
    id: number;
    name: string;
    course_code?: string;
    enrollments?: { computed_current_score?: number | null; computed_current_grade?: string | null }[];
  }>;
  return data.map((c) => {
    const enrollment = c.enrollments?.[0];
    const grade =
      enrollment?.computed_current_grade ??
      (enrollment?.computed_current_score != null ? `${enrollment.computed_current_score}%` : null);
    return { id: c.id, name: c.name, courseCode: c.course_code ?? null, currentGrade: grade };
  });
}

export async function fetchCanvasAssignments(courseId: number): Promise<CanvasAssignmentRow[]> {
  const data = (await canvasFetch(
    `/api/v1/courses/${courseId}/assignments?include[]=submission&order_by=due_at&per_page=100`
  )) as Array<{
    id: number;
    name: string;
    due_at: string | null;
    points_possible: number | null;
    html_url: string | null;
    submission?: { workflow_state?: string; score?: number | null };
  }>;
  return data.map((a) => ({
    id: a.id,
    courseId,
    name: a.name,
    dueAt: a.due_at,
    submitted: a.submission?.workflow_state ? a.submission.workflow_state !== "unsubmitted" : false,
    pointsPossible: a.points_possible,
    score: a.submission?.score ?? null,
    htmlUrl: a.html_url,
  }));
}
