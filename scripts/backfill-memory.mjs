/**
 * One-off (§6a): embed every existing row across the app's real data into
 * memory_chunks so the Brain has full season history from day one, not just
 * whatever gets logged after this ships. Resumable -- rows already chunked
 * (present in memory_chunks by sourceType+sourceId) are skipped on a re-run,
 * so a rate-limit failure partway through just means running it again.
 *
 * A plain .mjs script (not TS) with its own raw `postgres` connection and a
 * direct fetch()-based embed call -- matches every other one-off script in
 * this repo (e.g. seed-habits.mjs, probe-embedding-model.mjs); it can't
 * import src/lib/ai/embed.ts's model-fallback logic directly (no path-alias
 * resolution outside Next's build), so that logic is duplicated here
 * intentionally, same two model names/dimensions/batch size/pause as embed.ts.
 *
 *   node scripts/backfill-memory.mjs
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import postgres from "postgres";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(ROOT, ".env.local") });

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("GEMINI_API_KEY not found in .env.local -- get a free key at https://aistudio.google.com first.");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not found in .env.local");
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });

// ---------- embedding (mirrors src/lib/ai/embed.ts's embedBatch exactly) ----------

const EMBED_MODELS = ["text-embedding-004", "gemini-embedding-001"];
const DIMENSIONS = 768;
const BATCH_SIZE = 100;
const BATCH_PAUSE_MS = 1000;
// A bulk backfill sends far more requests/tokens per minute than the live
// app's own one-at-a-time embed() calls ever do, so it trips the free
// tier's rate limit after the first ~100-item batch even with embed.ts's
// normal 1s pause (confirmed empirically: batch 1 always succeeds, every
// batch after it comes back all-null on the first try). Retrying the same
// failed batch after a real cooldown, instead of giving up immediately,
// is what actually gets every row through -- not a code fix, a rate-limit
// accommodation specific to this one-off's burst shape.
const RATE_LIMIT_COOLDOWN_MS = 20_000;
const MAX_BATCH_RETRIES = 4;

function embedUrl(model) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:batchEmbedContents?key=${apiKey}`;
}

async function embedBatchOnce(texts) {
  for (const model of EMBED_MODELS) {
    try {
      const res = await fetch(embedUrl(model), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: texts.map((text) => ({
            model: `models/${model}`,
            content: { parts: [{ text }] },
            outputDimensionality: DIMENSIONS,
          })),
        }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) {
        if (res.status === 429) console.log(`    HTTP 429 (rate limited) on ${model}`);
        continue;
      }
      const data = await res.json();
      const embeddings = data.embeddings;
      if (!embeddings || embeddings.length !== texts.length) continue;
      return embeddings.map((e) => (e.values && e.values.length === DIMENSIONS ? e.values : null));
    } catch {
      // try the next model name
    }
  }
  return texts.map(() => null);
}

async function embedBatchWithRetry(texts) {
  for (let attempt = 1; attempt <= MAX_BATCH_RETRIES; attempt++) {
    const result = await embedBatchOnce(texts);
    if (result.some((v) => v !== null)) return result;
    if (attempt < MAX_BATCH_RETRIES) {
      console.log(`    batch came back empty (attempt ${attempt}/${MAX_BATCH_RETRIES}) -- cooling down ${RATE_LIMIT_COOLDOWN_MS / 1000}s`);
      await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_COOLDOWN_MS));
    }
  }
  return texts.map(() => null);
}

async function embedBatch(texts) {
  const results = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const chunk = texts.slice(i, i + BATCH_SIZE);
    results.push(...(await embedBatchWithRetry(chunk)));
    if (i + BATCH_SIZE < texts.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_PAUSE_MS));
    }
    process.stdout.write(`  embedded ${Math.min(i + BATCH_SIZE, texts.length)}/${texts.length}\r\n`);
  }
  return results;
}

// ---------- helpers ----------

function truncate(text, maxChars) {
  if (!text) return text;
  return text.length > maxChars ? `${text.slice(0, maxChars)}…` : text;
}

function formatSwimTime(ms) {
  if (ms == null) return null;
  const totalCs = Math.round(ms / 10);
  const cs = totalCs % 100;
  const totalSec = Math.floor(totalCs / 100);
  const sec = totalSec % 60;
  const min = Math.floor(totalSec / 60);
  const csStr = String(cs).padStart(2, "0");
  return min > 0 ? `${min}:${String(sec).padStart(2, "0")}.${csStr}` : `${sec}.${csStr}`;
}

function toDateStr(value) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

// ---------- 16 source-type descriptors, one query + one sentence template each ----------

const SOURCE_TYPES = [
  {
    type: "swim_session",
    async rows() {
      return sql`select id, date, load_rating, sets_text, parsed_distance_m, duration_min, ai_summary from swim_sessions`;
    },
    toChunk(r) {
      const bits = [r.sets_text || r.ai_summary || `load ${r.load_rating}/10`];
      if (r.duration_min) bits.push(`${r.duration_min} min`);
      if (r.parsed_distance_m) bits.push(`${r.parsed_distance_m}m`);
      return { sourceId: String(r.id), sourceDate: toDateStr(r.date), text: `Swim session on ${r.date}: ${bits.join(", ")}.` };
    },
  },
  {
    type: "swim_time",
    async rows() {
      return sql`select id, date, event, time_ms, meet_name, is_pb from swim_times`;
    },
    toChunk(r) {
      const time = formatSwimTime(r.time_ms);
      const meet = r.meet_name ? ` at ${r.meet_name}` : "";
      const pb = r.is_pb ? " (personal best)" : "";
      return { sourceId: String(r.id), sourceDate: toDateStr(r.date), text: `Swam ${r.event} in ${time}${meet} on ${r.date}${pb}.` };
    },
  },
  {
    type: "workout_log",
    async rows() {
      return sql`
        select wl.id, wl.date, wl.set_number, wl.weight_kg, wl.reps, wl.rpe, e.name as exercise_name
        from workout_logs wl join exercises e on e.id = wl.exercise_id
      `;
    },
    toChunk(r) {
      const weight = r.weight_kg ? `${r.weight_kg}kg x ` : "";
      const rpe = r.rpe ? ` @RPE ${r.rpe}` : "";
      return {
        sourceId: String(r.id),
        sourceDate: toDateStr(r.date),
        text: `${r.exercise_name}: set ${r.set_number}, ${weight}${r.reps ?? "?"} reps${rpe} on ${r.date}.`,
      };
    },
  },
  {
    type: "food_log",
    async rows() {
      return sql`select id, date, time_slot, description, kcal, protein_g, carbs_g, fat_g from food_logs`;
    },
    toChunk(r) {
      const macros = [`${r.kcal} kcal`, `${r.protein_g}g protein`];
      if (r.carbs_g) macros.push(`${r.carbs_g}g carbs`);
      if (r.fat_g) macros.push(`${r.fat_g}g fat`);
      return {
        sourceId: String(r.id),
        sourceDate: toDateStr(r.date),
        text: `Ate ${r.description} (${r.time_slot}) on ${r.date}: ${macros.join(", ")}.`,
      };
    },
  },
  {
    type: "sleep_log",
    async rows() {
      return sql`select id, date, hours, bedtime, on_time from sleep_logs`;
    },
    toChunk(r) {
      const bed = r.bedtime ? `, bedtime ${r.bedtime}` : "";
      const status = r.on_time === true ? " (on time)" : r.on_time === false ? " (late)" : "";
      return { sourceId: String(r.id), sourceDate: toDateStr(r.date), text: `Slept ${r.hours}h on ${r.date}${bed}${status}.` };
    },
  },
  {
    type: "soreness_log",
    async rows() {
      return sql`select id, date, rating_1_5, area from soreness_logs`;
    },
    toChunk(r) {
      return { sourceId: String(r.id), sourceDate: toDateStr(r.date), text: `Soreness on ${r.date}: ${r.area}, ${r.rating_1_5}/5.` };
    },
  },
  {
    type: "weigh_in",
    async rows() {
      return sql`select id, date, kg from weigh_ins`;
    },
    toChunk(r) {
      return { sourceId: String(r.id), sourceDate: toDateStr(r.date), text: `Weighed in at ${r.kg}kg on ${r.date}.` };
    },
  },
  {
    type: "meet",
    async rows() {
      return sql`select id, name, date, course from meets`;
    },
    toChunk(r) {
      const course = r.course ? ` (${r.course})` : "";
      return { sourceId: String(r.id), sourceDate: toDateStr(r.date), text: `Meet "${r.name}" on ${r.date}${course}.` };
    },
  },
  {
    type: "meet_event",
    async rows() {
      return sql`
        select me.id, me.event, me.current_time_ms, me.target_time_ms, m.name as meet_name, m.date as meet_date
        from meet_events me join meets m on m.id = me.meet_id
      `;
    },
    toChunk(r) {
      const target = formatSwimTime(r.target_time_ms);
      const current = r.current_time_ms ? `, entered at ${formatSwimTime(r.current_time_ms)}` : "";
      return {
        sourceId: String(r.id),
        sourceDate: toDateStr(r.meet_date),
        text: `At ${r.meet_name} (${r.meet_date}): ${r.event}, target ${target}${current}.`,
      };
    },
  },
  {
    type: "business_task",
    async rows() {
      return sql`
        select bt.id, bt.title, bt.done, bt.due_date, bt.created_at, bt.business_id, b.name as business_name
        from business_tasks bt join businesses b on b.id = bt.business_id
      `;
    },
    toChunk(r) {
      const done = r.done ? " (done)" : "";
      const due = r.due_date ? `, due ${toDateStr(r.due_date)}` : "";
      return {
        sourceId: String(r.id),
        sourceDate: toDateStr(r.due_date) ?? toDateStr(r.created_at),
        text: `${r.business_name} task: "${r.title}"${done}${due}.`,
        metadata: { businessId: r.business_id },
      };
    },
  },
  {
    type: "business_note",
    async rows() {
      return sql`
        select bn.id, bn.body, bn.created_at, bn.business_id, b.name as business_name
        from business_notes bn join businesses b on b.id = bn.business_id
      `;
    },
    toChunk(r) {
      return {
        sourceId: String(r.id),
        sourceDate: toDateStr(r.created_at),
        text: `${r.business_name} note (${toDateStr(r.created_at)}): ${truncate(r.body, 1500)}.`,
        metadata: { businessId: r.business_id },
      };
    },
  },
  {
    type: "canvas_assignment",
    async rows() {
      return sql`
        select ca.id, ca.name, ca.due_at, ca.submitted, ca.points_possible, ca.score, cc.name as course_name
        from canvas_assignments ca left join canvas_courses cc on cc.id = ca.course_id
      `;
    },
    toChunk(r) {
      const due = r.due_at ? `, due ${toDateStr(r.due_at)}` : "";
      const status = r.submitted ? " (submitted)" : " (not submitted)";
      const score = r.score !== null ? `, scored ${r.score}/${r.points_possible}` : "";
      const course = r.course_name ?? "Unknown course";
      return {
        sourceId: String(r.id),
        sourceDate: toDateStr(r.due_at),
        text: `${course} assignment "${r.name}"${due}${status}${score}.`,
      };
    },
  },
  {
    type: "coach_message",
    async rows() {
      return sql`select id, role, content, created_at from coach_messages`;
    },
    toChunk(r) {
      return {
        sourceId: String(r.id),
        sourceDate: toDateStr(r.created_at),
        text: `Coach chat (${r.role}) on ${toDateStr(r.created_at)}: ${truncate(r.content, 1500)}`,
      };
    },
  },
  {
    type: "knowledge",
    async rows() {
      return sql`select path, folder, title, content, modified_at from knowledge`;
    },
    toChunk(r) {
      return {
        sourceId: r.path,
        sourceDate: toDateStr(r.modified_at),
        text: `Note "${r.title}" (${r.folder}): ${truncate(r.content, 3000)}`,
      };
    },
  },
  {
    type: "daily_brief",
    async rows() {
      return sql`select date, message from daily_briefs`;
    },
    toChunk(r) {
      return { sourceId: toDateStr(r.date), sourceDate: toDateStr(r.date), text: `Daily brief for ${r.date}: ${r.message}` };
    },
  },
  {
    type: "ai_takeaway",
    async rows() {
      return sql`select id, date, key, message from ai_takeaways`;
    },
    toChunk(r) {
      return { sourceId: String(r.id), sourceDate: toDateStr(r.date), text: `AI takeaway (${r.key}) on ${r.date}: ${r.message}` };
    },
  },
];

// ---------- main ----------

async function main() {
  const existing = await sql`select source_type, source_id from memory_chunks`;
  const existingSet = new Set(existing.map((r) => `${r.source_type}:${r.source_id}`));
  console.log(`${existingSet.size} chunks already exist -- will be skipped (resumable backfill).\n`);

  const pending = [];
  for (const source of SOURCE_TYPES) {
    const rows = await source.rows();
    let newCount = 0;
    for (const row of rows) {
      const chunk = source.toChunk(row);
      if (existingSet.has(`${source.type}:${chunk.sourceId}`)) continue;
      pending.push({ sourceType: source.type, ...chunk });
      newCount++;
    }
    console.log(`${source.type}: ${rows.length} total, ${newCount} new`);
  }

  if (pending.length === 0) {
    console.log("\nNothing new to embed. Backfill already complete.");
    await sql.end();
    return;
  }

  console.log(`\nEmbedding ${pending.length} new chunks...`);
  const embeddings = await embedBatch(pending.map((p) => p.text));

  let inserted = 0;
  let failed = 0;
  for (let i = 0; i < pending.length; i++) {
    const chunk = pending[i];
    const embedding = embeddings[i];
    if (!embedding) {
      failed++;
      continue;
    }
    // pgvector's text input format is bracket-delimited ("[1,2,3]"), NOT
    // Postgres's own brace array literal -- JSON.stringify of a plain number
    // array happens to match it exactly, so this cast is safe without a
    // separate array-to-vector helper.
    const metadata = { ...(chunk.metadata ?? {}), backfilled: true };
    await sql`
      insert into memory_chunks (source_type, source_id, source_date, text, embedding, metadata)
      values (${chunk.sourceType}, ${chunk.sourceId}, ${chunk.sourceDate}, ${chunk.text}, ${JSON.stringify(embedding)}::vector, ${sql.json(metadata)})
      on conflict (source_type, source_id) do update set
        source_date = excluded.source_date, text = excluded.text, embedding = excluded.embedding, metadata = excluded.metadata
    `;
    inserted++;
    if (inserted % 50 === 0) console.log(`  inserted ${inserted}/${pending.length}`);
  }

  console.log(`\nDone. Inserted/updated ${inserted} chunks, ${failed} failed to embed (embedding API returned null).`);
  const total = await sql`select count(*) from memory_chunks`;
  console.log(`memory_chunks now has ${total[0].count} total rows.`);
  await sql.end();
}

main().catch(async (err) => {
  console.error("backfill-memory.mjs failed:", err);
  await sql.end();
  process.exit(1);
});
