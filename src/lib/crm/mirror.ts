import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

/**
 * Mirrors business_tasks and canvas_assignments into the universal `tasks`
 * table as read-only (for title/notes) rows. One batched INSERT ... SELECT
 * ... ON CONFLICT per source table (not a per-row loop) -- the pool is
 * capped at 3 (see src/lib/db/index.ts), so this stays two round trips
 * regardless of how many business tasks or assignments exist.
 *
 * urgency/is_key/priority_score are only set on first INSERT (the user owns
 * them afterwards, per spec: "mirror rows are read-only for title/notes but
 * the user can star them and change their urgency") -- the ON CONFLICT
 * clauses below deliberately never touch those three columns.
 *
 * completed_at for business-mirrored rows tracks business_tasks.done
 * (COALESCEd against the existing value so re-syncing a still-done task
 * doesn't keep bumping its completion timestamp to "now"). Canvas has no
 * local "done" concept -- canvas_assignments.submitted is a Canvas-reported
 * fact, not something this app or the user sets -- so canvas-mirrored rows'
 * completed_at is left alone on every conflict; only the CRM's own
 * completeTask/uncompleteTask actions ever set it for those rows.
 */
export async function syncCrmMirror(): Promise<void> {
  await db.execute(sql`
    INSERT INTO tasks (title, notes, urgency, is_key, priority_score, time_estimate_min, tags, due_date, rail, category, source_kind, source_id, completed_at, created_at, updated_at)
    SELECT
      bt.title,
      NULL,
      'someday',
      false,
      0,
      NULL,
      NULL,
      bt.due_date,
      'life',
      b.name,
      'business',
      bt.id::text,
      CASE WHEN bt.done THEN now() ELSE NULL END,
      now(),
      now()
    FROM business_tasks bt
    JOIN businesses b ON b.id = bt.business_id
    ON CONFLICT (source_kind, source_id) WHERE source_kind <> 'manual'
    DO UPDATE SET
      title = EXCLUDED.title,
      due_date = EXCLUDED.due_date,
      category = EXCLUDED.category,
      completed_at = CASE
        WHEN EXCLUDED.completed_at IS NOT NULL THEN COALESCE(tasks.completed_at, EXCLUDED.completed_at)
        ELSE NULL
      END,
      updated_at = now()
  `);

  await db.execute(sql`
    INSERT INTO tasks (title, notes, urgency, is_key, priority_score, time_estimate_min, tags, due_date, rail, category, source_kind, source_id, completed_at, created_at, updated_at)
    SELECT
      ca.name,
      NULL,
      'someday',
      false,
      0,
      NULL,
      NULL,
      (ca.due_at AT TIME ZONE 'Asia/Manila')::date,
      'life',
      cc.name,
      'canvas',
      ca.id::text,
      NULL,
      now(),
      now()
    FROM canvas_assignments ca
    JOIN canvas_courses cc ON cc.id = ca.course_id
    ON CONFLICT (source_kind, source_id) WHERE source_kind <> 'manual'
    DO UPDATE SET
      title = EXCLUDED.title,
      due_date = EXCLUDED.due_date,
      category = EXCLUDED.category,
      updated_at = now()
  `);
}
