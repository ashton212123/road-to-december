# Personal OS merge — build log

Append-only. One section per phase: what changed, files touched, what was verified, assumptions made.

---

## PHASE 0 — Recon and baseline (no code)

**Files read in full** (per spec §Phase 0.1):
- `src/lib/db/schema.ts`
- `src/lib/db/index.ts`
- `src/lib/coach/tools.ts`
- `src/lib/ai/groq.ts`
- `src/lib/time.ts`
- `src/app/(app)/layout.tsx`
- `src/app/globals.css`
- `src/components/ui/` — all 20 files: `SectionLabel.tsx`, `AlertCard.tsx`, `EmptyState.tsx`,
  `AnimatedNumber.tsx`, `IconTile.tsx`, `DotStrip.tsx`, `Button.tsx`, `ProgressChip.tsx`,
  `GroupedList.tsx`, `DeltaChip.tsx`, `icons.tsx`, `ComparisonLine.tsx`, `Sparkline.tsx`,
  `StatCard.tsx`, `SlidingPillNav.tsx`, `SegmentedControl.tsx`, `TabBar.tsx`, `ProgressRing.tsx`,
  `BentoCard.tsx`, `GlassCard.tsx`, `MiniBarList.tsx`
- `DECISIONS.md`

**Gate commands and results:**

```
$ npm run lint
> road-to-december@0.1.0 lint
> eslint
```
Exit 0, zero findings.

```
$ npx tsc --noEmit
```
Exit 0, zero errors.

```
$ npm run build
▲ Next.js 16.2.10 (Turbopack)
- Environments: .env.local
  Creating an optimized production build ...
✓ Compiled successfully in 7.3s
  Running TypeScript ...
  Finished TypeScript in 8.9s ...
  Collecting page data using 23 workers ...
✓ Generating static pages using 23 workers (9/9) in 611ms
  Finalizing page optimization ...

Route (app)
┌ ○ /
├ ○ /_not-found
├ ƒ /analytics
├ ƒ /api/coach/chat
├ ƒ /api/export
├ ƒ /api/mcp
├ ƒ /business
├ ƒ /business/[businessId]
├ ƒ /fuel
├ ƒ /home
├ ○ /icon.png
├ ƒ /learn
├ ƒ /learn/[trackId]
├ ○ /login
├ ƒ /more
├ ƒ /more/coach-ai
├ ƒ /more/recovery
├ ƒ /more/settings
├ ○ /offline
├ ƒ /school
├ ƒ /swim
├ ƒ /swim/session/[sessionId]
├ ƒ /swim/sessions
├ ƒ /train
└ ƒ /train/[phaseId]

ƒ Proxy (Middleware)
○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
```
Exit 0. (No first-load-JS table — Turbopack build, per AGENTS.md, not a gap.)

```
$ node scripts/smoke.mjs
{
  "pass": false,
  "results": [
    { "route": "/home (no cookie)", "ok": true, "detail": "status 307 (expect 3xx redirect to /login)" },
    { "route": "/home", "ok": false, "ms": 30004, "detail": "TimeoutError: The operation was aborted due to timeout" },
    { "route": "/train", "ok": true, "ms": 77, "detail": "ok" },
    { "route": "/fuel", "ok": false, "ms": 25274, "detail": "missing sentinel \"Protein\"" },
    { "route": "/fuel?view=plan", "ok": false, "ms": 25248, "detail": "missing sentinel \"g/kg\"" },
    { "route": "/analytics?period=week&offset=0", "ok": true, "ms": 74, "detail": "ok" },
    { "route": "/analytics?period=month&offset=0", "ok": true, "ms": 39, "detail": "ok" },
    { "route": "/swim", "ok": true, "ms": 70, "detail": "ok" },
    { "route": "/swim/sessions", "ok": false, "ms": 25253, "detail": "missing sentinel \"All sessions\"" },
    { "route": "/learn", "ok": true, "ms": 34, "detail": "ok" },
    { "route": "/learn/python", "ok": true, "ms": 32, "detail": "ok" },
    { "route": "/analytics?tab=train&period=week&offset=0", "ok": true, "ms": 54, "detail": "ok" },
    { "route": "/analytics?tab=fuel&period=month&offset=0", "ok": true, "ms": 26, "detail": "ok" },
    { "route": "/analytics?tab=recovery&period=week&offset=0", "ok": true, "ms": 28, "detail": "ok" },
    { "route": "/more", "ok": true, "ms": 39, "detail": "ok" },
    { "route": "/more/recovery", "ok": true, "ms": 25263, "detail": "ok" },
    { "route": "/more/settings", "ok": false, "ms": 25271, "detail": "missing sentinel \"Training status\"" },
    { "route": "/school", "ok": true, "ms": 25259, "detail": "ok" },
    { "route": "/business", "ok": true, "ms": 25256, "detail": "ok" },
    { "route": "/offline", "ok": true, "ms": 26, "detail": "ok" },
    { "route": "[burst x10 concurrent]", "ok": false, "ms": 30013, "detail": "[{\"route\":\"/home\",\"ok\":false,\"detail\":\"TimeoutError: The operation was aborted due to timeout\"}]" }
  ]
}
```
Exit 1. **5 of 19 route checks failed, plus the burst check.**

Pattern: every failure (and several nominal "ok" routes) clusters around **~25.2–25.3 seconds**, and
`/home` hit the client's own 30s hard abort twice (once solo, once inside the burst). That ~25s
figure lines up with `src/lib/db/index.ts`'s `statement_timeout: 20000` plus retry/queue overhead,
not a random hang. `/home` is documented in `DECISIONS.md` as the heaviest page (a ~14-query
`Promise.all` even after caching work), which is consistent with it being the one that blows past
even the 30s client timeout while lighter pages (`/train`, `/swim`, `/learn`, most `/analytics`
tabs) return in double-digit milliseconds.

**This matches a known, already-investigated, already-accepted issue, not a new regression:**
`DECISIONS.md` documents at length that the Supabase project runs on the free "Micro" compute tier
(shared, ~60-connection ceiling) and that the app's own pool is deliberately capped at `max: 3`
per serverless container; the user was asked directly whether to upgrade to a paid compute tier to
eliminate this and **explicitly said no, stay on free tier**, accepting occasional hangs under
concurrent load as the tradeoff. `scripts/smoke.mjs`'s own header comment says the burst phase
exists specifically to "reproduce a real navigation storm... the pattern that intermittently blew
the Supabase connection budget" — i.e. this script is designed to be able to hit exactly this
ceiling, and did.

**Caveat / assumption:** this run was from the local dev machine to Supabase `us-east-1`, not from
Vercel `iad1` (same-region) — so some of the ~25s could be added local-to-cloud latency on top of
pool contention, not pool contention alone. Not verified against a fresh `SMOKE_BASE_URL`-pointed
run against production in this session.

**Assumptions:** none in the reading/gate-running itself — every file location and command in this
phase matched the spec exactly. The one interpretive call: treating the smoke failure as "pre-existing
and already accepted" rather than "new breakage" is my read of `DECISIONS.md`'s history, not something
I verified by re-running smoke against a known-good historical commit.

**Not finished / flagged, not silently passed:** the smoke test does not pass on the untouched tree.
Per the spec's own rule ("If you think something is wrong, stop and say so... do not silently
substitute your own approach"), I'm not marking Phase 0 as a clean green baseline — lint/typecheck/
build (the three checks the Gate line names explicitly) are green; smoke is not, for reasons that
predate this session. Flagged to the user in this phase's report rather than proceeding past it.

---

## PHASE 1 — Schema, pgvector, embeddings

**Files created:**
- `scripts/enable-pgvector.mjs` — one-off, run once (§1a)
- `scripts/probe-embedding-model.mjs` — one-off diagnostic (§1d), **not yet run to completion** — see below
- `scripts/scratch-embed-test.ts` — gate check for `embed()` (§Gate), **not yet run to completion** — see below
- `src/lib/ai/embed.ts` — `embed()` / `embedBatch()` (§1d)
- `src/lib/memory/write.ts` — `rememberChunk()` (§1e)
- `drizzle/0012_nostalgic_bill_hollister.sql` — generated migration (§Gate)

**Files modified:**
- `src/lib/db/schema.ts` — appended `rawCaptures`, `tasks`, `habits`, `habitLogs`, `journalEntries`,
  `goals`, `memoryChunks`, `auditLog` (§1b/1c) + their type exports; added `real`, `vector`, `index`
  imports from `drizzle-orm/pg-core` and `sql` from `drizzle-orm`
- `.env.example` — added `GEMINI_API_KEY` (blank placeholder + comment)
- `.env.local` — added `GEMINI_API_KEY=""` placeholder (value never read/printed this session)

**§1a — pgvector:**
```
$ node scripts/enable-pgvector.mjs
pgvector extension enabled (version 0.8.2).
```

**§1b/1c — schema + HNSW index:** all 7 tables added exactly per spec's field list, following the
file's existing conventions (`serial` PKs, `timestamp({ withTimezone: true }).notNull().defaultNow()`,
`uniqueIndex(...).on(...)` array-return style, `onDelete: "cascade"` on every new FK — matching every
existing FK in the file). `tags`/`routedTo`/`doneSubtaskIds` used real Postgres `text[]` via Drizzle's
`.array()` (the spec's own notation distinguishes these from the `jsonb` fields in the same tables,
e.g. `rawCaptures.classification`/`routedIds` — read as intentional, not sloppy shorthand).
`memoryChunks.embedding` is `vector("embedding", { dimensions: 768 })` with
`index(...).using("hnsw", table.embedding.op("vector_cosine_ops"))` — confirmed in the generated SQL:
```sql
CREATE TABLE "memory_chunks" ( ... "embedding" vector(768), ... );
CREATE INDEX "memory_chunks_embedding_idx" ON "memory_chunks" USING hnsw ("embedding" vector_cosine_ops);
```

**§Gate — `npm run db:generate`, SQL review:**
```
$ npx drizzle-kit generate
37 tables ...
[✓] Your SQL migration file ➜ drizzle\0012_nostalgic_bill_hollister.sql
```
Read in full. 7 `CREATE TABLE` statements (audit_log, goals, habit_logs, habits, journal_entries,
memory_chunks, raw_captures, tasks) + 3 new FK constraints + 6 new indexes — all purely additive and
exactly what Phase 1 asked for.

**Two lines I did NOT write and did not expect:**
```sql
ALTER TABLE "settings" ALTER COLUMN "energy_phase" DROP DEFAULT;
ALTER TABLE "settings" ALTER COLUMN "energy_phase" DROP NOT NULL;
```
This is drizzle-kit's tracked snapshot catching up to a change `DECISIONS.md` documents as already
applied directly to the live DB in a past session (`scripts/alter-energy-phase-nullable.mjs`,
"energy_phase moves from NOT NULL DEFAULT 'gain' to a plain nullable column... confirmed... Home is
fast and reliable now, verified by you") — that script bypassed drizzle-kit entirely (per
`apply-migration.mjs`'s own header: `drizzle-kit push` crashes in this repo with a TypeError in its
CHECK-constraint introspection), so drizzle-kit's migration history never recorded it, and it just
resurfaced as a diff now. `schema.ts` already declared `energyPhase` as nullable/no-default before I
touched anything — this is pre-existing drift, unrelated to Phase 1, not something my table additions
introduced.

Per spec rule 3.9 ("if it contains any DROP... stop and ask the user before pushing"), **I did not
apply these two lines.** I wrote a targeted apply script that ran every statement in the generated
migration *except* those two, applying all 7 new tables + FKs + indexes, and left the `settings`
lines unapplied and flagged here. My read is that they're safe (constraint-loosening, not data-loss,
and the live DB already reflects this state per `DECISIONS.md`) — but the rule says ask, not decide,
so: **do you want me to run those two lines** (pure metadata reconciliation, zero expected behavior
change since the DB is already in that state), or leave drizzle-kit's snapshot drifted from schema.ts
indefinitely (harmless but means every future `db:generate` will keep re-proposing the same two lines)?

**§Gate — apply:** `npm run db:push -- --force` was **not** used — per `apply-migration.mjs`'s header
comment, `drizzle-kit push` crashes in this repo (TypeError in its own CHECK-constraint
introspection), and this codebase's own established workaround is `generate` → apply the SQL file
directly with a `postgres` client (same pattern as `apply-migration.mjs` and
`alter-energy-phase-nullable.mjs`). Used that same mechanism, scoped to skip the two flagged lines
above. All 8 additive statement groups applied `OK`.

**§Gate — row counts, before/after migration:**
```
before: {"swim_sessions":"1","food_logs":"120","workout_logs":"165"}
after:  {"swim_sessions":"1","food_logs":"120","workout_logs":"165"}
```
Identical. No existing data touched.

**§Gate — `npx tsc --noEmit && npm run lint && npm run build`:** all exit 0, same as Phase 0 (build
route list unchanged — schema/lib changes don't add routes).

**§1d — embeddings client (`src/lib/ai/embed.ts`):** mirrors `groq.ts`'s defensive shape exactly —
`embed()`/`embedBatch()` never throw, return `null` (or an array of `null`s) on a missing key. Tries
`text-embedding-004` first, falls back to `gemini-embedding-001` **at runtime on every call** (not
just as a one-time manual pick) — the spec names both an explicit try-order *and* asks for a one-off
probe script to "record the winner," which I read as: build real runtime resilience (so a future
model-name deprecation doesn't require a code change), and use the probe script to confirm/document
which one is live *right now*. `embedBatch` chunks at 100 with a 1s pause between chunks, per the
free-tier rate-limit note.

**§1e — memory writer (`src/lib/memory/write.ts`):** `rememberChunk()` embeds then upserts on
`(sourceType, sourceId)`; both the embed call and the DB write are wrapped so the function itself
never throws, matching "a failed embedding must never fail the write."

**§Gate — live verification: RESOLVED.** You supplied `GEMINI_API_KEY`, written into `.env.local`
(value never echoed to chat or printed by any command — confirmed present via name-only grep).

```
$ node scripts/probe-embedding-model.mjs
text-embedding-004: HTTP 404
  {"error":{"code":404,"message":"models/text-embedding-004 is not found for API version v1beta,
   or is not supported for embedContent. ...","status":"NOT_FOUND"}}
gemini-embedding-001: HTTP 200
  values length: 768
```
**Winner: `gemini-embedding-001`.** `text-embedding-004` is retired (404, not a transient error) —
confirms the spec's "model names move" warning was correct, and that `embed.ts`'s runtime fallback
(not just a one-time hardcoded pick) is the right design, not over-engineering.

```
$ npx tsx scripts/scratch-embed-test.ts
embed('test') returned a 768-length array.
[ -0.008958523, -0.007950606, 0.019478967, -0.055917874, 0.01935889 ]
```
Real end-to-end confirmation: `embed()` tried `text-embedding-004` (404), fell through to
`gemini-embedding-001` (200), returned a genuine 768-length vector. The embeddings client is now
fully verified, not just code-complete.

**Assumptions (judgment calls not explicitly spelled out in the spec):**
- `onDelete: "cascade"` on `tasks.captureId` and `journalEntries.captureId` (both FK → `rawCaptures`)
  — the spec doesn't state a delete behavior; every single existing FK in `schema.ts` uses `cascade`,
  so I matched that uniform convention rather than inventing a different one for just these two.
- `habits.sortOrder` has no default (`notNull()`, no `.default()`) — matches the existing
  `orderIndex` columns on `phases`/`sessions`/`exercises`, which are also notNull with no default and
  set explicitly at insert/seed time; `goals.sortOrder` follows the same pattern.
- `.env.example` got only `GEMINI_API_KEY` added, not all 6 of section 4's new vars — the other 5
  (Telegram ×3, `GOOGLE_CALENDAR_ICAL_URL`, `CRON_SECRET`) aren't read by any code yet (Phases 2/5/7).
  Documenting unused vars now seemed more likely to mislead than help; I'll add each as its phase
  lands, keeping `.env.example` accurate to what actually exists in code at each point.
- Nullability on fields the spec's table notation didn't explicitly mark (e.g. `rawCaptures.rawText`/
  `transcript`/`audioFileId`, `tasks.category`, `auditLog.resourceId`) — inferred from what's
  semantically optional (a text capture has no audio file id; a manual task has no category) rather
  than asking about each of ~15 individually-obvious fields.

**Not finished:** nothing — the live embedding verification and model-name probe (previously blocked
on `GEMINI_API_KEY`) were completed once you supplied the key; see above. Phase 1 is fully complete,
gated, and verified.

**Flagged, needs your decision before it's touched:** ~~the two `settings.energy_phase` DROP lines
from the generated migration~~ — **resolved.** You confirmed, so both were applied directly
(`DROP DEFAULT`, `DROP NOT NULL`), and a follow-up `npx drizzle-kit generate` now reports
`No schema changes, nothing to migrate` — the drift is fully reconciled, no new migration file
needed for this.

**Next phase's manual steps (Phase 2, not started — for when you're ready):** per spec §4, Phase 2
needs a Telegram bot token (@BotFather → `/newbot`), your numeric Telegram user ID (@userinfobot),
and `TELEGRAM_WEBHOOK_SECRET`/`CRON_SECRET` (I can generate those two myself via `openssl rand -hex
16`, no manual step needed for them). Not acting on any of this now — flagging early per the spec's
own reporting rule, not starting Phase 2.

---

## PHASE 2 — Capture pipeline (the backbone)

**Files created:**
- `src/lib/capture/executors.ts` — pure DB-write functions: `logSwimSession`, `logSwimTime`,
  `logGymSet`, `logMeal`, `logWater`, `logSleep`, `logWeighIn`, `logSoreness`, `updateCoachMemory`
  (§2a, extracted from coach/MCP's existing inline writes) + `createTask`, `createJournalEntry`,
  `createNote` (§2a, new)
- `src/lib/capture/classify.ts` — `RouteKind`/`Classification` types, `ROUTE_PAYLOAD_SCHEMAS` (zod,
  one per route), `SYSTEM_PROMPT`, `regexFallbackClassify`, `classify()` (Groq → regex, never throws)
  (§2b)
- `src/lib/capture/pipeline.ts` — `runCapturePipeline()`, `undoCapture()`, `executeRoute()`,
  `deleteRoutedRow()` — the shared orchestration both entry points call (§2b/2c/2d)
- `src/app/api/telegram/webhook/route.ts` — secret check, user-id check, `update_id` dedup, voice
  transcription, sequential multi-route execution, reply + inline urgency/undo keyboard, callback
  handler (§2c)
- `src/app/api/capture/route.ts` — web capture endpoint, cookie-or-`x-api-secret` auth (§2d)
- `src/components/home/CaptureBar.tsx` — floating quick-capture input on Home (§2d)

**Files modified:**
- `src/lib/coach/tools.ts` — rewired 9 cases in `executeCoachTool` to call the new executors instead
  of raw `db` calls; every validation check, revalidation call, and reply-message format left
  byte-for-byte identical (§2a)
- `src/app/api/mcp/route.ts` — rewired 8 single-item tools to the same executors
  (`log_food`, `log_water`, `log_weigh_in`, `log_sleep`, `log_workout_set`, `log_swim_time`,
  `log_soreness`, `log_swim_session`). `log_meal` and `log_gym_session` (the plural/batch tools)
  left untouched — see assumption below (§2a)
- `src/app/(app)/home/page.tsx` — renders `<CaptureBar />` as the first child, above the existing
  header row (§2d)
- `src/proxy.ts` — added `/api/telegram/webhook` and `/api/capture` to `PUBLIC_PATHS` (both guarded
  by their own secret inside the route, since Telegram/non-browser callers can't present a session
  cookie) (§2e)
- `.env.local` / `.env.example` — added `TELEGRAM_BOT_TOKEN` (blank), `TELEGRAM_WEBHOOK_SECRET`
  (self-generated via `openssl rand -hex 16`), `TELEGRAM_USER_ID` (blank)

**§Gate — `npx tsc --noEmit && npm run lint && npm run build`:** all exit 0. Lint has the one
pre-existing-pattern warning (`_p` unused in `createNote`, underscore-prefixed intentionally — a
warning, not an error). Build's route table now includes `ƒ /api/capture` and
`ƒ /api/telegram/webhook`, confirming both are registered.

**§Gate — live pipeline verification, against the real production DB.** Ran the spec's own worked
example verbatim through `runCapturePipeline` via real HTTP round trips (through both the web
capture route and a temporary local test route, all test data cleaned up afterward):
- `"swam 6x100 free on 1:30, felt heavy, then chicken and rice"` → `routedTo: ["swim_session",
  "soreness", "meal"]` — matches the spec's own description of this example exactly.
- Gibberish input → routed to `note`, no crash, no unhandled rejection.
- Duplicate `telegram_update_id` → second insert no-ops via `onConflictDoNothing`, pipeline never
  re-runs for it.
- Undo → deletes every row in the capture's `routedIds`, marks the `raw_captures` row `discarded`,
  and re-invoking Undo on an already-discarded capture is a no-op (idempotent, as designed).
- Refactor parity: re-verified at least one rewired function (`logWater`) produces an identical DB
  row and identical reply/revalidation behavior through both the coach tool-loop caller and the MCP
  `tools/call` caller, post-refactor.

**§Gate — CaptureBar placement, 390px viewport.** The live `/home` page could not be used for this
check this session — it's currently timing out against the DB intermittently (documented,
pre-existing behavior: see Phase 0's smoke-test section above, `withRetry.ts`'s own header comment
about "intermittent, total hangs" between this environment and Supabase, and `DECISIONS.md`'s
accepted-tradeoff note re: the free-tier pool cap). This is unrelated to Phase 2's changes — the
same ~25s-class stalls Phase 0 already caught and the user already accepted are what's happening
now, not a new regression.

Verified instead with a static reproduction: a throwaway page (served briefly as
`public/debug-capturebar-check.html`, deleted immediately after) that copies the *exact* CSS from
the three real components — `CaptureBar.tsx` (`bottom: calc(env(safe-area-inset-bottom) + 144px)`),
`CoachPanel.tsx`'s mobile FAB (`bottom: calc(env(safe-area-inset-bottom) + 92px)`, 44px), and
`TabBar.tsx` (`bottom: calc(env(safe-area-inset-bottom) + 12px)`, 64px) — at a real 390×844 viewport,
then ran `getBoundingClientRect()` on all three and computed actual pairwise intersection (not just
eyeballing). Result:
```
CaptureBar overlaps FAB: false
CaptureBar overlaps TabBar: false
```
CaptureBar's bottom edge sits ~6-8px above the FAB's top edge, which sits ~14-16px above the
TabBar's top edge — matches the design intent exactly, confirmed by measurement rather than just
arithmetic. Once the DB connection is stable again, worth a quick real-`/home` glance to confirm
nothing else on that page pushed the layout around, but the component's own CSS — the only thing
that determines this — is verified correct.

**Assumptions (judgment calls not explicitly spelled out in the spec):**
- **Batch MCP tools stay unrefactored.** `log_meal` (plural) and `log_gym_session` (plural) have
  real round-trip-saving optimizations (in-memory set-number caching, single batched insert) that a
  per-item executor would turn into N sequential DB calls against a pool capped at 3. Read the
  "pure refactor, zero behavior change" instruction as not licensing a performance regression, so
  left both as direct `db` calls, untouched.
- **`createNote` has no table.** The spec names it as an executor but Phase 1's locked schema has no
  `notes` table. Made it a no-op: the `raw_captures` row already inserted before classification is
  the durable record, and the pipeline's own `rememberChunk` call already makes it searchable via
  the Brain. Documented in the function's own doc comment, not silently invented.
- **`gym_set` capture-route resolver.** Coach's tool loop matches exercises against *today's
  scheduled session only* (mid-workout context); MCP's `log_workout_set` and this new capture route
  both use the broader `resolveExerciseByName` (whole program, phase-aware) instead, since a capture
  can arrive well after the actual workout, not necessarily while it's in progress. A new caller, not
  a behavior change to an existing one.
- **`journal` route stores only its own excerpt, not the full transcript.** A single capture can be
  journal + meal + swim at once; the journal route's `rawText` is the classifier's carved-out journal
  portion. The full original text/transcript stays reachable via `captureId` → `raw_captures`, so
  nothing is lost, and no extra Groq summarization call was added since Phase 2 doesn't ask this
  pipeline to make one.
- **Web capture auth reuses `MCP_BEARER_TOKEN`** (as `x-api-secret`) rather than inventing a new env
  var, on top of the existing session-cookie path. One fewer secret to manage; the token's already
  scoped to "trusted server-to-server caller of this app," which is exactly what this is.

**Not finished / blocked on you:**
- `TELEGRAM_BOT_TOKEN` (from @BotFather → `/newbot`) and `TELEGRAM_USER_ID` (from @userinfobot) are
  still blank in `.env.local`. `TELEGRAM_WEBHOOK_SECRET` is already self-generated and set.
- The spec's Gate items that need a real bot + a production deploy are **not done**: registering the
  webhook (`setWebhook`), `npx vercel deploy --prod`, and the live Telegram tests (real text message,
  real voice note, mixed voice note, real Undo tap, real duplicate-`update_id` replay). All correctly
  blocked on the two missing credentials above, not skipped.
- A real-browser glance at `/home` at 390px once the DB connection is stable, as a final confirmation
  alongside the static CSS-geometry proof above (belt-and-suspenders, not because the current
  evidence is in doubt).

**Not starting Phase 3.** Everything from Phase 3 (`/life/crm`, `src/lib/crm/`, etc.) is untouched.

---

## PHASE 3 — CRM (universal task layer at /life/crm)

Session context: user supplied `TELEGRAM_BOT_TOKEN` and switched instructions mid-session from
"one phase per session" to "run Phase 3, recheck, Phase 4, recheck... until the whole prompt is
done; stop only on a bug or when you need me" (they were going to sleep). This and all following
phase sections in this log were built under that instruction, not the original one-phase gate —
noted here once rather than repeating it every phase.

**Files created:**
- `src/lib/crm/priority.ts` — `computePriorityScore` (default tier ranking: urgency base + key
  bonus + due-date proximity + age), `interpolateScore` (drag-drop reorder: averages the two
  neighbor scores at the drop point, pads ±100 at list ends), `topOfTierScore` (new task / urgency
  quick-change: current tier max + 100)
- `src/lib/crm/mirror.ts` — `syncCrmMirror()`: two batched `INSERT ... SELECT ... ON CONFLICT`
  statements (business_tasks→tasks, canvas_assignments→tasks), not a per-row loop (§3.1)
- `src/lib/crm/queries.ts` — `getCrmData()`: one batched query (analyticsQuery.ts's `json_agg`
  pattern) returning `open` + a 200-row `archived` slice
- `src/app/(app)/life/crm/actions.ts` — `createTaskAction`, `updateTaskAction`,
  `completeTaskAction`, `uncompleteTaskAction`, `deleteTaskAction`, `toggleKeyAction`,
  `setUrgencyAction`, `reorderTaskAction`
- `src/app/(app)/life/crm/page.tsx` — server component: `syncCrmMirror()` → `getCrmData()` → renders `CrmClient`
- `src/components/crm/{CrmClient,KanbanView,ListView,CategoryView,ArchiveView,TaskCard,TaskDrawer}.tsx`
- `src/components/ui/Toast.tsx` — first shared toast/undo component in this app (previously every
  "toast" was a one-off; positioned like `RestPill.tsx` — left-aligned + max-width, not centered,
  so it never overlaps the coach FAB)

**Files modified:**
- `src/components/ui/icons.tsx` — added `IconTask`
- `src/app/(app)/more/page.tsx` — added a CRM row
- `src/app/(app)/layout.tsx` — added a CRM icon button to desktop `EXTRA_ITEMS`
- `src/lib/capture/pipeline.ts` — added `syncCrmMirror()` call after every capture (§3a: "runs on
  CRM page load and after any capture"), wrapped in the same never-throws `.catch(console.error)`
  pattern as the other post-routing side effects

**§Gate — `npx tsc --noEmit && npm run lint && npm run build`:** all exit 0 (one lint fix needed
along the way: `CrmClient`'s initial localStorage read was a direct `setState` in a bare
`useEffect` body, which fails `react-hooks/set-state-in-effect` per AGENTS.md §3.2 exactly as
warned — fixed by wrapping it in a `setTimeout(fn, 0)` inside the effect, AGENTS.md's own
documented workaround, rather than a lazy `useState` initializer, which would have caused a real
SSR/client hydration mismatch since `window.localStorage` isn't available during SSR). Build's
route table includes `ƒ /life/crm`.

**§Gate — data-layer correctness, verified directly against the live production DB** (a `postgres`
script with its own single connection, bypassing the app's own pool — see below for why): seeded a
throwaway business + business task + Canvas course + Canvas assignment, ran the exact SQL from
`mirror.ts`, and confirmed: title/due-date/category (business name / course name via the join)
land correctly on the mirrored `tasks` row; marking the business task done and re-syncing sets
`completed_at`; re-syncing again with no change does **not** re-bump `completed_at` (the
`COALESCE` guard works); `queries.ts`'s batched `open`/`archived` split returns the right rows.
All test fixtures deleted afterward — zero residue in the live DB.

**§Gate — could not get a clean live-browser visual check this session.** `/life/crm` (and, while
checking, `/swim` — an untouched, unrelated pre-existing page) both intermittently hit
`src/lib/db/withRetry.ts`'s `DB call timed out after 8000/15000ms` this session, one `/swim`
request alone taking 46.6s. This is the exact pattern Phase 0's baseline already documented and
the user already explicitly accepted (`DECISIONS.md`: free-tier Supabase pool contention, "stay on
free tier" chosen over paying to fix it) — not something Phase 3 introduced. Restarted the dev
server mid-phase to rule out a leaked connection from the long test session; it didn't change the
pattern, confirming this is live Supabase/network flakiness right now, not a stale local pool.
Given the SQL is independently proven correct (above) and every static gate is green, I'm not
treating this as a Phase-3 bug or a reason to stop — but I have **not personally seen the Kanban
board render in a browser this session**, so treat the UI as code-reviewed-and-data-verified rather
than pixel-verified. Worth a 10-second glance next time the DB is responsive.

**Assumptions (judgment calls not explicitly spelled out in the spec):**
- **New mirror rows default to `urgency: 'someday'`, `priorityScore: 0`.** The spec gives no
  due-date-to-urgency mapping and explicitly says mirrored rows are user-classified ("the user can
  star them and change their urgency") — defaulting to unclassified rather than guessing felt more
  honest than inventing a due-date heuristic.
- **Canvas-sourced tasks have no source write-back on completion.** Spec §3c says "completing a
  mirrored row calls back through the existing business/school completion path" — but there is no
  school/Canvas completion path in this codebase (confirmed by research: `canvasAssignments` is a
  full delete-and-replace mirror from the Canvas API on every sync, with zero local write path
  anywhere). Business-sourced tasks DO call back to `business_tasks.done` (verified above);
  Canvas-sourced tasks can still be completed in the CRM, but it only ever sets the `tasks` row's
  own `completedAt` — nothing to write back to. Documented in both `mirror.ts`'s and
  `actions.ts`'s `completeTaskAction`'s doc comments.
- **Mirrored (business/canvas) tasks can't be deleted from the CRM.** They keep living in their own
  table per spec (§Decision 8); deleting the mirror would just have it reappear on the next sync.
  `deleteTaskAction` no-ops on a non-manual/non-capture `sourceKind`; the drawer never shows the
  delete button for one.
- **Archive is a 4th `SegmentedControl` option**, not a separate link/toggle — the spec names three
  views plus a separate mention of "an Archive view" without saying how it's reached; a 4th segment
  keeps everything in one discoverable control.
- **Delete-with-undo is a client-side deferred delete**, not a soft-delete column: the row is
  optimistically hidden from view and the real `deleteTaskAction` call is delayed 5s behind a
  `setTimeout`; tapping Undo just clears the timer, so nothing ever reaches the server unless the
  window elapses. No schema change needed for this.
- **No client-side optimistic reorder state.** Kanban drag calls `reorderTaskAction` and waits for
  Next's own revalidation to bring the new order back down, rather than keeping a separate local
  copy of the list that a later unrelated prop update could clobber — the exact bug class AGENTS.md
  §3.7 warns about, just one level removed from its original mount-time-GET framing. Trades a brief
  post-drop delay for correctness.
- **CRM reachability**: the spec doesn't say how a mobile user reaches `/life/crm` before Phase 8's
  rail nav exists — added a row on `/more` (reachable from both viewports today) plus a desktop
  `TopBar` icon, matching how Business/School are currently reached.

**Not finished:** nothing from Phase 3's own scope. The one gap is the live-browser visual check
above, which is an environmental blocker (documented, pre-existing, already accepted by the user),
not unfinished Phase 3 work.

**Next phase's manual steps:** none — Phase 4 (Habits/Goals) needs no new env vars or external
accounts.

---

## PHASE 4 — Habits and Goals

**Files created:**
- `scripts/seed-habits.mjs` — one-off, idempotent (skips by name), inserts the six spec-table
  habits with their exact category/subtask text; run once against prod, output below.
- `src/lib/habits/queries.ts` — `getHomeHabitsData(today, windowStartISO)`: one batched query
  (`analyticsQuery.ts`'s `json_agg` pattern) returning active habits + today's log joined, plus a
  30-day daily-completion aggregate; `getAllHabitsForEditor()` for Settings (active + archived).
- `src/lib/habits/streak.ts` — `buildHabitStreakDots()`: pure function turning the 30-day
  completion window into `DotStrip`-shaped `{status, label}[]`.
- `src/lib/goals/queries.ts` — `getHomeGoalsData()`: one batched query returning `{week, month}`,
  undone-first then done, ordered by `sort_order` within each group.
- `src/app/(app)/home/actions.ts` — new file (Home had none yet): `toggleHabitSubtaskAction`,
  `addGoalAction`, `toggleGoalAction`, `deleteGoalAction`, `reorderGoalAction`.
- `src/components/home/HabitsCard.tsx`, `src/components/home/GoalsCard.tsx`.
- `src/components/more/HabitEditor.tsx` — Settings' add/rename/reorder/archive/subtask editor.

**Files modified:**
- `src/app/(app)/more/actions.ts` — added `addHabitAction`, `renameHabitAction`,
  `updateHabitSubtasksAction`, `setHabitActiveAction`, `reorderHabitAction`.
- `src/app/(app)/home/page.tsx` — added `getHomeHabitsData`/`getHomeGoalsData` to the existing
  `Promise.all` inside `getCachedHomeData` (§3.1: joins the batch rather than firing separately);
  bumped the cache key `home-page-data-v4` → `v5` since the cached shape changed (same reasoning as
  the v3→v4 bump already documented in this file — the tag alone won't invalidate a same-day entry
  warmed before this deploy); rendered `<HabitsCard>`/`<GoalsCard>` as new grid children at
  `order-8`/`order-9`, `md:order-11`/`md:order-12` — appended after everything else, no existing
  order value touched.
- `src/app/(app)/more/settings/page.tsx` — added a "Habits" section (`SectionLabel` + `GlassCard` +
  `HabitEditor`), fetched via `withRetry(() => getAllHabitsForEditor())` alongside the page's
  existing `Promise.all`.

**§Gate — `npx tsc --noEmit && npm run lint && npm run build`:** all exit 0. One lint round-trip:
`HabitsCard`'s resync effect carried an `eslint-disable-next-line react-hooks/set-state-in-effect`
copied from the CRM precedent, but the rule didn't actually fire here (this effect setState is
`[habits]`-dependent, not an unconditional-on-mount localStorage read like `CrmClient`'s) — lint
flagged it as an *unused* disable directive, so I removed the comment rather than suppress a
non-issue. Build's route table is unchanged (no new routes — Habits/Goals live on existing pages).

**§Gate — seed script, run against the live DB:**
```
$ node scripts/seed-habits.mjs
OK    Morning (routine, 3 subtasks)
OK    Pool session (swim, 3 subtasks)
OK    Gym session (train, 2 subtasks)
OK    Fuel (fuel, 3 subtasks)
OK    School block (school, 2 subtasks)
OK    Evening wind-down (recovery, 3 subtasks)

Inserted 6/6 habit rows.
```
(First attempt hit the same `statement timeout` pool flakiness documented in Phases 0/3; retried
and it went through clean — the script is idempotent by name so the retry was safe.)

**§Gate — data-layer correctness, verified directly against the live production DB** (single-
connection `postgres` script, same method as Phase 3, deleted after use — confirmed via
`git status --short`, no residue): confirmed all 6 seeded habits present with correct
category/subtask counts and `active: true`; toggling one subtask via the exact upsert SQL
`toggleHabitSubtaskAction` uses leaves `completed: false`; toggling all of a habit's subtasks flips
`completed: true` (auto-complete-parent behavior, §4a); `getHomeHabitsData`'s exact batched
`json_agg` query shape reflects that completed state correctly; a full goals round trip (insert two
week goals → toggle one done, confirm `completed_at` stamps → swap `sort_order` via the same
mechanism `reorderGoalAction` uses, confirm the pair actually reordered → delete both, confirm zero
residue) all passed. All 10 checks green.

**§Gate — could not get a clean live-browser visual check this session**, same environmental
blocker as Phase 3 (documented, pre-existing, already accepted by the user): `/home` hit
`Still couldn't reach the database` across two navigation attempts plus an 8s wait in between. Not
treating this as a Phase-4 bug for the same reason as Phase 3 — SQL is independently proven correct
above and every static gate is green — but the Habits/Goals cards and the Settings habit editor are
code-reviewed-and-data-verified rather than pixel-verified this session. Worth a real glance next
time the DB is responsive, especially the 30-day `DotStrip` color mapping (next Assumption below)
and the subtask chip wrapping on a 390px viewport.

**Assumptions (judgment calls not explicitly spelled out in the spec):**
- **`DotStrip` color mapping for the 30-day habit streak.** `DotStatus` only has 3 values
  (`improved`/green, `declined`/red, `flat`/gray) and was designed for "did a metric improve," not
  habit completion. Mapped: all active habits done that day → green: nothing logged → gray
  (neutral, not "bad" — a genuine rest/no-data day); any partial completion → red, so an incomplete
  day is visually distinct from a day with no attempt at all. Denominator is the *current* active
  habit count, not a historical count for each day — if habits are added/archived later, past days'
  ratios will read against today's count, not the count that existed then. Acceptable for a 30-day
  rolling strip; would need real history-aware denominators to be exact.
- **Habit-toggle actions resolve "today" server-side via `todayManilaISO()`, never from a
  client-supplied date.** The spec doesn't say this explicitly, but §3.3's day-rollover rule plus
  the exact bug it's guarding against (a phone left open across midnight writing to the wrong day)
  made this the only defensible choice — `toggleHabitSubtaskAction` takes no `date` parameter at
  all.
- **Goals reordering is swap-with-neighbor (up/down), not drag-and-drop.** The spec says "check off,
  reorder, delete" for Goals without naming a mechanism, unlike CRM's Kanban, which explicitly
  requires native HTML5 DnD. Goals is a compact 5-item Home card list, not a dedicated drag surface,
  so up/down swap buttons are enough — logged as a real judgment call, not an oversight.
- **GoalsCard has no local optimistic state or `dirtyRef` guard**, unlike HabitsCard. §3.7's
  "optimistic-then-synced card needs a dirtyRef guard" language and the explicit localStorage-cache
  requirement both appear only in §4a (Habits), not §4b (Goals) — GoalsCard renders straight from
  props and waits for `revalidatePath`/`updateTag` after each action, the same choice `KanbanView`
  made in Phase 3 for the identical reason (nothing to clobber if there's no independent local copy
  to begin with).
- **Goals query returns every row per scope, not capped at 5** — the spec says "Home shows up to 5
  per scope," which I read as a *display* cap, not a storage/query cap, since a persistent
  never-auto-clearing list (Decision 10) needs somewhere for older completed/undone goals to live
  even if they're not always on-screen. `GoalsCard` slices `.slice(0, 5)` client-side (undone-first
  ordering means the 5 shown are always the most actionable ones); there's no dedicated goals page
  yet to see the rest, so an overflow goal only becomes visible again once one of the visible 5 is
  completed or deleted. No spec text asked for a full goals page, so I didn't build one.
- **New habits added via the Settings editor start with zero subtasks** (`subtasks: []`), added one
  at a time afterward via the same editor. The spec's seed table gives every habit 2-3 subtasks
  up front, but says nothing about what a *newly created* habit should start with — an empty list
  felt more honest than fabricating placeholder subtask text.
- **Archived habits are excluded from `getHomeHabitsData` (`active = true` filter) but still appear,
  dimmed, in the Settings editor** via `getAllHabitsForEditor()`'s unfiltered query — archive is
  reversible (`setHabitActiveAction(id, true)` un-archives) rather than a one-way delete, since the
  spec's own word is "archive," not "delete," and `habitLogs` rows reference `habitId` with
  `onDelete: cascade` — a real delete would erase history, which archiving intentionally avoids.

**Not finished:** nothing from Phase 4's own scope. The one gap is the live-browser visual check
above, same environmental blocker already accepted for Phase 3.

**Next phase's manual steps:** none for Phase 5 (Journal) itself, but it needs a self-generated
`CRON_SECRET` (same `openssl rand -hex 16` pattern already used for `TELEGRAM_WEBHOOK_SECRET`) for
the nightly rollup cron — will generate and store it without echoing the value, same as every other
secret this session.

---

## PHASE 5 — Journal

**Files created:**
- `src/app/api/journal/transcribe/route.ts` — `POST`: accepts multipart form data (an `audio` blob,
  typed `text`, or both), transcribes via Whisper if audio was given, generates a 3-5 sentence Groq
  summary from whichever text is available, inserts one `journal_entries` row (`source: "web"`),
  calls `rememberChunk`, `revalidatePath("/life/journal")`. Gated only by proxy.ts's normal session
  cookie (not in `PUBLIC_PATHS` — this is a browser-only feature, unlike the Telegram/capture/cron
  endpoints).
- `src/lib/journal/queries.ts` — `getJournalEntries()`, reverse-chronological.
- `src/components/journal/JournalRecorder.tsx` — `MediaRecorder` capture (mp4 on iOS Safari,
  webm/opus elsewhere, picked at runtime via `MediaRecorder.isTypeSupported`), a "or type instead"
  fallback always reachable, and an explicit denied/failed-transcription error path that leaves
  typing available (§Gate: "a failed transcription must still let the user save what they typed").
- `src/components/journal/JournalClient.tsx` — list + per-entry **Show raw** toggle.
- `src/app/(app)/life/journal/page.tsx`.
- `src/app/api/cron/journal-rollup/route.ts` — `GET`, `Authorization: Bearer $CRON_SECRET` (Vercel
  sends this automatically once the env var is set, no extra config needed). Rolls up the day that
  just ended (`addDaysISO(todayManilaISO(), -1)` — the cron fires just after Manila midnight, so
  "today" has already ticked over by the time it runs), one batched query for that date's journal
  text + training/fuel facts, one Groq call for a one-sentence summary, upserted into `ai_takeaways`
  under a new `journal-rollup` key (same `(date, key)` upsert pattern the athlete-model takeaway
  already uses — no new table needed).
- `vercel.json` — first cron config in this repo: `5 16 * * *` (00:05 Manila, UTC+8, no DST).

**Files modified:**
- `src/lib/ai/groq.ts` — added `transcribeAudio()`, a shared Whisper client. Deliberately did
  **not** refactor the Telegram webhook's own existing private `transcribeVoice()` to call this
  instead — same logic, but that function is already live in a working, deployed webhook, and
  touching it wasn't required by this phase (logged as an Assumption below).
- `src/proxy.ts` — added `/api/cron/journal-rollup` to `PUBLIC_PATHS` (cron calls carry a bearer
  token, never a session cookie, same treatment as the Telegram/capture entry points).
- `src/components/ui/icons.tsx` — added `IconJournal`.
- `src/app/(app)/layout.tsx` — added a Journal icon button to desktop `EXTRA_ITEMS`.
- `src/app/(app)/more/page.tsx` — added a Journal row (same reachability gap as CRM in Phase 3 —
  no rail nav until Phase 8).
- `.env.local` — added `CRON_SECRET` (self-generated via `openssl rand -hex 16` in a shell pipeline
  that never printed the value to any output I could see or echo, same method as
  `TELEGRAM_WEBHOOK_SECRET`).
- `.env.example` — added `CRON_SECRET=""` with the same blank-placeholder-plus-comment convention
  as every other secret in this file.

**§Gate — `npx tsc --noEmit && npm run lint && npm run build`:** all exit 0. Build's route table
includes `ƒ /life/journal`, `ƒ /api/journal/transcribe`, `ƒ /api/cron/journal-rollup`.

**§Gate — data-layer correctness, verified directly against the live production DB** (single-
connection script, deleted after use, confirmed via `git status --short`): inserted one typed-
fallback-shaped entry and one Telegram-excerpt-shaped entry for the same test date, confirmed
`getJournalEntries()`'s exact query returns both in the right order; confirmed the cron route's
exact batched query correctly aggregates that date's journal text + a seeded `food_logs` row's
kcal/protein totals + correctly finds zero training that day; confirmed the `ai_takeaways`
`(date, key)` upsert replaces the `journal-rollup` row rather than duplicating it on a second write
(covers the cron firing twice for the same night). All 8 checks passed, zero residue after cleanup.

**§Gate — could not get a clean live-browser visual check this session**, same environmental
blocker as Phases 3 and 4: two navigation attempts to `/life/journal` this time (one hit the
"couldn't reach the database" error page, one hit a 300s tool-level navigation timeout). Not
treating this as a Phase-5 bug for the same reason as the prior two phases — every static gate is
green and the data layer is independently proven correct above — but `JournalRecorder`'s actual
mic-permission/record/upload flow, and the real Whisper transcription round trip specifically, are
**code-reviewed against the Telegram webhook's already-proven-working pattern, not live-tested with
real audio this session**. This is the one piece of Phase 5 I'd most want a real device check on
before trusting it blind — recording + iOS Safari's `audio/mp4` `MediaRecorder` path in particular.

**Assumptions (judgment calls not explicitly spelled out in the spec):**
- **Did not consolidate `transcribeAudio()` with the Telegram webhook's existing private
  `transcribeVoice()`.** Both do the same thing (multipart upload to Groq Whisper, correct
  filename/content-type to avoid the silent-empty-transcript gotcha) but I left the webhook's
  function untouched rather than refactor a live, working, deployed webhook for an unrelated phase —
  the small duplication is a smaller risk than a regression in a route Telegram calls directly.
- **"Links it to that day's training and fuel data" (cron rollup) means the summary TEXT
  references those facts, not a new foreign-key/schema link.** There's no schema field for this in
  `ai_takeaways` (or anywhere) and the spec doesn't ask for one — the cron's Groq prompt is handed
  the day's training/fuel facts alongside the journal text specifically so the generated sentence
  weaves them together, which is the only reading that doesn't require an unrequested schema change.
- **Cron schedule picked as `5 16 * * *` UTC (00:05 Manila)** — the spec says "nightly" without a
  specific time; just-after-midnight Manila is the first moment the day being rolled up is fully
  over, so nothing from that day is still incoming when it runs.
- **No dedicated write-back for Telegram-sourced journal entries' `summary` field.** Phase 2 already
  intentionally left `transcript`/`summary` null on Telegram journal captures (documented in that
  phase's own log entry) since generating a summary was explicitly out of Phase 2's scope. Phase 5
  doesn't say to retroactively backfill those either — the nightly rollup now gives every day
  (Telegram or web-sourced) a summary line regardless, which reads as the intended fix for this gap
  rather than a per-entry summary being required on the Telegram path too.
- **Web-recorded entries with a successful transcription set `rawText: null`** (only `transcript` is
  populated) — matching the schema's implicit split from Phase 1 (`rawText` = user-typed original,
  `transcript` = ASR output) and Phase 2's own Telegram convention (`rawText` = classifier excerpt,
  `transcript` stays on the linked `raw_captures` row, not duplicated onto `journal_entries` for
  Telegram). The typed-fallback path is the mirror case: `rawText` set, `transcript` null.

**Not finished / blocked on you:** nothing outright blocked, but flagging clearly: the actual
recording flow on a real iPhone (mic permission prompt, `audio/mp4` capture, upload, transcript
appearing) has not been tested on a real device or a working browser session this phase — worth
doing before relying on it for a real entry. The live-browser gap above is the same root cause.

**Next phase's manual steps:** Phase 6 (Brain) needs no new env vars — `GEMINI_API_KEY` (embeddings)
and `GROQ_API_KEY` (the Ask endpoint) are both already live from Phase 1. The backfill script
(§6a) will take real, possibly-long-running time against the free embedding tier's rate limit —
flagging that up front so a long `npx tsx scripts/backfill-memory.mjs` run isn't mistaken for a hang.

---

## PHASE 6 — Brain

**Files created:**
- `scripts/backfill-memory.mjs` — one-off, resumable (skips rows already in `memory_chunks` by
  `sourceType`+`sourceId`). 16 source-type descriptors, each with its own query (with joins where a
  human-readable name needs one — `workout_logs`→`exercises`, `business_tasks`/`business_notes`→
  `businesses`, `canvas_assignments`→`canvas_courses`, `meet_events`→`meets`) and a one-sentence
  template. Duplicates `embed.ts`'s model-fallback embedding logic directly (can't import a
  `@/lib/...` TS path alias from a plain `.mjs` script) — same models/dimensions/batch size.
- `src/lib/memory/search.ts` — `searchMemory()`: a vector pass (pgvector `<=>` cosine distance) and
  a keyword pass (`ILIKE` + `to_tsvector`/`plainto_tsquery`, one combined query) merged and deduped
  by `(sourceType, sourceId)`, vector hits ranked first.
- `src/lib/memory/categories.ts` — the 8 `§6d` category tiles, a `sourceType → category` map
  covering every type that can ever land in `memory_chunks` (the 16 backfilled types plus the two
  live types `rememberChunk` already writes — `capture`, `journal`), and `resolveSourceHref()` so
  every Brain result is clickable through to a real page.
- `src/lib/memory/queries.ts` — `getChunksByCategory()`.
- `src/app/api/memory/search/route.ts` — `POST`, thin wrapper over `searchMemory()`.
- `src/app/api/brain/ask/route.ts` — `POST`: top-20 hybrid-search chunks (~800 chars/~200 tokens
  each, truncated), the exact spec system prompt verbatim, one Groq call, returns `{answer, sources}`.
- `src/app/(app)/life/brain/actions.ts` — `getCategoryDetailAction()`: chunks for a category + one
  on-demand Groq call for the "current state and open loops" summary (loaded per-tap, not
  pre-fetched for all 8 tiles on every page visit).
- `src/components/brain/BrainClient.tsx`, `src/app/(app)/life/brain/page.tsx` — a question box
  wired to `/api/brain/ask` (the Gate's example questions are natural-language, not keyword search,
  so the top box asks rather than greps — see Assumptions) with cited sources, plus the 8 tiles.

**Files modified:**
- `src/components/ui/icons.tsx` — added `IconBrain`, `IconJournal` (the latter was actually added in
  Phase 5 — noting here only because Phase 6 is the first phase to also add a nav entry for it via
  the same pattern).
- `src/app/(app)/layout.tsx`, `src/app/(app)/more/page.tsx` — added a Brain row (same reachability
  gap as CRM/Journal — no rail nav until Phase 8).

**§Gate — `npx tsc --noEmit && npm run lint && npm run build`:** all exit 0. Build's route table
includes `ƒ /life/brain`, `ƒ /api/memory/search`, `ƒ /api/brain/ask`.

**§Gate — backfill run against the live production DB:**
```
$ node scripts/backfill-memory.mjs
swim_session: 1, swim_time: 7, workout_log: 165, food_log: 120, sleep_log: 0, soreness_log: 0,
weigh_in: 2, meet: 1, meet_event: 5, business_task: 0, business_note: 0, canvas_assignment: 0,
coach_message: 43, knowledge: 15, daily_brief: 9, ai_takeaway: 6  (374 total new rows found)
```
First run: 374 texts to embed, only the first ~100 succeeded, the rest came back null. Diagnosed as
the free embedding tier's rate limit -- a bulk backfill sends far more requests/tokens per minute
than the live app's normal one-at-a-time `embed()` calls ever do, so batches after the first started
hitting real `HTTP 429`s (confirmed by logging the status). **Fix:** added retry-with-cooldown
(20s, up to 4 attempts) around a failed batch in the backfill script only -- not a change to
`embed.ts` itself, since the live app's usage pattern never triggers this. Re-ran twice more
(resumable -- each run only re-embedded what the previous run left missing); final run: **0 failed,
174/174 embedded.** `memory_chunks` now has **376 total rows** (0 → 376, a genuine non-zero count).

**§Gate — real end-to-end verification, live Gemini + Groq, against the now-backfilled DB** (a
temporary script exercising the exact `search.ts`/`brain/ask` logic, deleted after use, confirmed
via `git status --short`):
- *"what was my best 200 breast time this season"* → 20 chunks found, top matches were real
  `swim_time` rows → Groq answered **"Your best 200 breast time this season was 2:24.53, as stated
  in [swim_time:5]."** -- a real row, correctly cited, not fabricated.
- *"what did I say about my shoulder"* (this athlete has zero `soreness_log`/journal rows logged
  yet, by design of the test) → Groq answered **"There is no information in the provided context
  about your shoulder"** -- correctly declined to invent an answer rather than guessing (it did
  append a long list of `[type:id]` tags after that sentence, citing chunks that don't actually
  support the claim -- a mildly noisy LLM habit, not a factual error; left alone since the spec's
  system prompt is quoted verbatim and I didn't want to hand-tune around its exact wording).
All 3 of §6's Gate criteria (non-zero backfill count, a real grounded answer, an honest "I don't
have that" on a no-data question) are met with real data, not simulated.

**§Gate — could not get a clean live-browser visual check this session**, same environmental
blocker as Phases 3-5 (this time the Browser tool's own navigation call was denied/failed, not a DB
timeout) -- not treating it as a Phase-6 bug given the above is a genuinely stronger verification
pass than prior phases (real embeddings, real Groq answers, not just SQL shape checks). `BrainClient`
's actual UI (tile tap → detail panel, question box → cited answer) is code-reviewed and logic-
verified end-to-end, not pixel-verified.

**Assumptions (judgment calls not explicitly spelled out in the spec):**
- **The top search box on `/life/brain` asks (`/api/brain/ask`), it doesn't keyword-search
  (`/api/memory/search`).** §6d literally says "a search box," but the Gate's own example queries
  ("what was my best 200 free split this season") are natural-language questions expecting a
  synthesized, cited answer -- exactly what §6c's Ask endpoint is for. `/api/memory/search` still
  exists and is used internally (by both Ask and the category tiles), just not exposed as a second,
  separate raw-search UI the spec never described.
- **Category tile summaries are fetched on-demand per tap, not pre-computed for all 8 tiles on every
  page load.** Pre-fetching would mean 8 Groq calls (plus 8 DB queries) on every single visit to
  `/life/brain` whether or not the athlete opens a single tile -- wasteful and slow. On-demand costs
  one Groq call only when a tile is actually opened.
- **`resolveSourceHref()` links to each type's general page, not a hypothetical per-row detail
  view, for every type that doesn't already have one in this app** (e.g. `food_log` → `/fuel`, not
  a nonexistent `/fuel/log/:id`). Two exceptions where a real per-row page exists: `swim_session` →
  `/swim/session/:id`, `business_task`/`business_note` → `/business/:businessId` (via a `businessId`
  stored in the chunk's `metadata`, added specifically so this link works). `knowledge` (synced
  Obsidian notes) has no in-app viewer at all, so it's the one type with a `null` href by design.
- **`capture` chunks are categorized under "Life admin."** A capture's `memory_chunks` row is the
  *whole* raw text (which can span multiple domains at once -- "swam this morning, ate a big lunch,
  remind me to email coach"), so it doesn't cleanly belong to any single one of the other 7
  categories; whatever it routed to already shows up properly-categorized as its own structured row
  (a `swim_session`, a `food_log`, etc.) anyway, so the raw capture blob itself is more of an audit
  trail than a first-class category member.
- **`journal` chunks are categorized under "Health"**, not "Ideas" or "Life admin" -- a personal
  journal is closer to wellbeing/mood tracking than to notes/ideas, which is what `knowledge` (the
  synced Obsidian vault) already covers.
- **Business/Canvas rows: 0 found in the live DB** (`business_task`/`business_note`/
  `canvas_assignment` all backfilled 0 rows) -- not a bug, just genuinely empty tables in this
  account right now (confirmed by the backfill's own per-type counts above, which is exactly the
  DB's real current state, not a query mistake). The category tiles for Business/School will
  correctly show "Nothing here yet" until real data exists there.

**Not finished:** nothing from Phase 6's own scope. The live-browser UI check is the one gap, same
category as every prior phase's.

**Next phase's manual steps:** Phase 7 (Calendar) needs `GOOGLE_CALENDAR_ICAL_URL`, which is **not
yet supplied**. Per spec §7 this must degrade to a clean "connect your calendar" empty state when
unset, so Phase 7 will be built and gated in full without it, then genuinely need it later for a
live-events check -- flagging now rather than treating a missing calendar as a stopping condition.

---

## PHASE 7 — Calendar

**Files created:**
- `src/app/api/calendar/route.ts` — `GET`: no env var → `{events: [], connected: false}` (never an
  error, §7's own gate); env var set → fetch, parse via `ical.js` (§3.5 — never `node-ical`/`rrule`),
  expand recurrences via `event.iterator()` over a 14-day window from `todayManilaISO()`, 5-minute
  module-memory cache, `cache-control: no-store` on every response (the module cache is the actual
  caching layer, Next's own data cache must never touch this route). A fetch/parse failure also
  degrades to an empty list rather than a 500 -- same "never an error" spirit, different cause.
- `src/components/home/CalendarStripCard.tsx` — 7-day strip (today outlined), tap a day to expand;
  overlays this app's own known dates (meets, planned swim/gym — computed server-side in
  `home/page.tsx` from data Home already fetches, zero new DB queries) with the external feed
  (fetched client-side from `/api/calendar` on mount). A NOW marker renders in the expanded day's
  event list (today only) and auto-scrolls into view.

**Files modified:**
- `package.json`/`package-lock.json` — added `ical.js`.
- `src/app/(app)/home/page.tsx` — added `calendarStripDays` (derived from `allMeets`/`allPhases`/
  `seasonData`, all already in scope for the week map above it — no new query), rendered
  `<CalendarStripCard>` at `order-10`/`md:order-13` (next free slot after Phase 4's additions,
  same "append, don't renumber" rule).
- `.env.example` — added `GOOGLE_CALENDAR_ICAL_URL=""`.

**§Gate — `npx tsc --noEmit && npm run lint && npm run build`:** one real fix needed along the way —
`CalendarStripCard` originally called `Date.now()` directly in the component body to compute the
NOW-marker position, which is exactly §3.2's "impure function during render" trap (`react-hooks/
purity`, not just the set-state rule this time). Fixed by moving it into a `useEffect` — which then
tripped `react-hooks/set-state-in-effect` in turn, fixed with this app's own established
`setTimeout(fn, 0)` workaround — and split the scroll-into-view effect to depend on the *computed*
`nowMarkerIndex` rather than share the same effect as the `setNowMs` call, since the ref it targets
isn't attached until the render `nowMs` causes has actually happened. All three gates exit 0 after
that. Build's route table includes `ƒ /api/calendar`.

**§Gate — recurrence expansion, verified against a real synthetic ICS fixture** (a temporary script
running the exact `ICAL.parse`/`event.iterator()`/`getOccurrenceDetails()` sequence
`api/calendar/route.ts` uses, deleted after use): a `WEEKLY` `RRULE` event starting Mon Jun 1 2026
correctly expanded to **both** its occurrences (Jun 1 and Jun 8) inside a 14-day window, while a
plain one-off event in the same fixture appeared exactly once. This is the same logic the real route
runs, proven with a fixture I control rather than depending on an external calendar's actual content
existing or being reachable right now.

**§Gate — unset-env-var path.** `GOOGLE_CALENDAR_ICAL_URL` is genuinely still unset in `.env.local`
(flagged at the end of Phase 6's log, still true) -- confirmed via code review rather than a live
authenticated HTTP round-trip: the unset branch is a 3-line early return before any DB or network
call, so there's very little to go wrong; a full live test would need session-cookie plumbing through
`proxy.ts` disproportionate to that risk. **Genuinely not done:** a real live-events check with an
actual `GOOGLE_CALENDAR_ICAL_URL` — blocked on you supplying one (same "not blocking, just flagged"
treatment as every other missing-credential item this session).

**§Gate — could not get a clean live-browser visual check this session**, same category as every
prior phase (the Browser tool itself, not the app's DB, failed to navigate again this time). Not
treating it as a Phase-7 bug — the two pieces that actually needed verification (recurrence math,
the graceful-degradation branch) were both verified above by other means; what's unverified is purely
visual (strip layout, NOW-marker scroll behavior, expand/collapse), which needs an actual device or
a working browser tab I didn't have this session.

**Assumptions (judgment calls not explicitly spelled out in the spec):**
- **The calendar overlay fetches client-side, not folded into Home's own server-rendered
  `Promise.all`.** An external iCal fetch can be slow/unreliable (a third-party server, no SLA) --
  baking it into Home's critical render path would risk slowing down or (via `withRetry`'s timeout)
  even degrading the whole Home page for a card that's meant to fail gracefully on its own. A
  client-side fetch after first paint keeps a slow/down calendar feed from ever blocking Home itself.
- **NOW marker only renders for the expanded day when it's literally today**, not for any other day
  in the 7-day strip (an inherently meaningless concept for a future day). Only `expandedDate ===
  today` computes a marker index at all.
- **A fetch/parse failure (env var set but the feed is unreachable, malformed, or times out)
  degrades to the same empty-list shape as the unset-env-var case**, distinguished only by an
  `error` field the UI doesn't currently surface differently. The spec's gate only names the
  unset-var case explicitly; treating a live fetch failure the same way (never a 500, never an
  uncaught error) follows the same "never an error" principle stated right next to it.
- **7-day strip window is `[today, today+6]`**, not centered on today or including past days -- the
  spec says "7-day strip, today highlighted" without specifying which 7, and a forward-looking week
  matches how the rest of Home already frames "what's coming" (Today's Plan, Week Map) rather than
  a backward-looking log.

**Not finished / blocked on you:** `GOOGLE_CALENDAR_ICAL_URL` still isn't set — the calendar card is
fully built and gated, but only reachable at its "connect your calendar" empty state until you supply
one (Google Calendar → Settings → your calendar → "Secret address in iCal format").

**Next phase's manual steps:** Phase 8 (two-rail nav + operator Home) needs no new env vars or
external accounts -- it's a restructuring phase (ATHLETE/LIFE rail switcher, Home reorganized into 9
numbered sections) over data every prior phase already built.

---

## PHASE 8 — Operator home + two-rail navigation

**Files created:**
- `src/components/nav/AppNav.tsx` — client shell owning rail state (`athlete`/`life`), localStorage
  persistence (`rtd-rail`), pathname-based auto-rail-resolution (`railForPath`), the rail switcher
  (built on the existing `SegmentedControl`/`SlidingPillNav` primitives — zero new animation code,
  satisfying §8a's "sliding pill nav is a standing requirement"), and now also owns `TopBar`/
  `TabBar`/`CoachPanel`/`CaptureBar` rendering, promoted out of `layout.tsx`.
- `src/components/home/OperatorCard.tsx` — `01 // OPERATOR`.
- `src/components/home/KeyTasksCard.tsx` — `06 // KEY TASKS`.

**Files modified:**
- `src/app/(app)/layout.tsx` — reduced to a thin Server Component wrapper (`export const dynamic =
  "force-dynamic"` still lives here, since that export can't live in a `"use client"` file); all nav
  logic and JSX moved into `AppNav`.
- `src/components/ui/TabBar.tsx` — `TopBar` gained an optional `railSwitcher?: ReactNode` prop,
  rendered between the wordmark and the primary pill nav.
- `src/components/ui/icons.tsx` — added `IconSettings` (gear), needed for the LIFE rail's Settings
  extra (Settings was previously only reachable via the More page, never a top-level nav icon).
- `src/lib/crm/queries.ts` — added `getHomeKeyTasks()`, a lightweight dedicated query (is_key=true,
  completed_at is null, ordered by priority_score, limited) rather than reusing `getCrmData()`'s full
  open+archived batch, which Home doesn't need.
- `src/components/home/TodaysPlanCard.tsx`, `HabitsCard.tsx`, `GoalsCard.tsx`,
  `TrainingLoadCard.tsx`, `FuelRingCard.tsx`, `CalendarStripCard.tsx`, `NeedsAttentionList.tsx` —
  each card's internal label text updated to its numbered section name (`02 // SESSION` through
  `09 // ATTENTION`) and `colSpan` unified to 4 (one of three columns in the 12-col desktop grid),
  so the 9 sections literally read as 3-per-row on desktop with no per-item order classes needed.
- `src/app/(app)/home/page.tsx` — restructured: `CaptureBar` removed (now global via `AppNav`,
  pinned above the tab bar on every page per §8b); added `getHomeKeyTasks()` to the batched
  `Promise.all` (cache key bumped to `home-page-data-v6`); added `todaysFocus` (today's session
  title / "Swim" / "Rest day", the same logic `coachBriefBullets` already used); JSX reordered so
  the 9 numbered sections appear in the exact spec order with no `order-N`/`md:order-N` classes
  (mobile and desktop orders are now identical — a Phase 8 simplification over the old scheme, which
  needed per-breakpoint order overrides only because mobile and desktop sequences used to diverge).

**Gates run:**
- `tsc --noEmit` — clean.
- `eslint` — clean (one pre-existing unrelated warning in `src/lib/capture/executors.ts`, not
  touched this phase; one warning of my own — an unused `Link` import in `KeyTasksCard.tsx` — fixed
  immediately).
- `next build` — clean production build, all 33 routes compiled, no route regressions.
- **Not verified live in-browser**: the app is auth-gated behind a password screen and I don't have
  the password, so I could not click through the rail switcher, confirm the animation, or screenshot
  the 390px layout. This is a harder verification gap than prior phases' DB-timeout flakiness — it's
  a hard wall, not an intermittent failure. Flagging explicitly rather than claiming visual
  verification that didn't happen.

**Assumptions (logged per spec's own requirement, not asked about since each is a routine judgment
call within an already-approved scope):**
- **Deleting the pre-Phase-8 dashboard modules Phase 8b's table doesn't name — was flagged to you
  directly** (not silently assumed) since it read as a real product decision, not an implementation
  detail: taking the spec's 9-section table literally as "Home = only these 9" would have deleted the
  rule-engine alert banner, the AI daily brief, the readiness/season header, doorway dials, week map,
  recent PRs, and the month calendar from the live app. You said "do the recommended" — my
  recommendation, which I implemented, was: keep everything, treat the 9 sections as a required
  backbone in the exact specified order, and place the retained extras around them (`AlertCardList`
  stays above everything as safety-critical; `HomeHeroBand`/`HomeDoorwayDials` sit right after
  Operator since Operator's own fields don't duplicate their full readiness/season detail;
  `CoachBriefCard`/`MonthCalendarCard`/`WeekMapCard`/`RecentPRsCard`/the two `StatCard` tiles are
  kept in a "More today" section below the 9, same disclosure pattern as before).
- **"01 // OPERATOR"'s "role" field uses `seasonData.meta.athlete`** ("National-level competitive
  swimmer — 200 Breaststroke primary"), a real, already-seeded field — not fabricated text. "Days to
  December" uses the already-computed `daysToNcaa`, since NCAA Philippines' date (2026-12-04) *is*
  the season-end date the app's own name refers to. "Streak" reuses the existing
  `src/lib/analytics/streak.ts` consistency computation already computed once by Home as
  `consistency` (pct/done/planned) — matching the spec table's own "new + existing `streak.ts`"
  phrasing (a NEW section, built on the EXISTING streak file), rather than inventing a second,
  different streak metric.
- **"Desktop: three columns" implemented as `colSpan={4}` on every section** (4+4+4=12), so the 9
  sections literally flow 3-per-row via normal grid auto-placement — the simplest, most literal
  reading, and it lets mobile and desktop share one JSX order for the first time (no per-item
  `order-N` overrides needed for these 9 anymore).
- **The numbered "01 // SECTION" labels are rendered now**, not deferred to Phase 9. `BentoCard`
  already has a `label` prop rendering exactly this micro-label style, so there was no reason to
  wait — Phase 9's "terminal restyle" will change how `.rtd-micro-label` looks (font, tracking,
  color), not the label text itself.
- **NeedsAttentionList gained a `09 // ATTENTION` label** even though it's built on `GlassCard`, not
  `BentoCard` (which has no built-in label slot) — added as a manual `.rtd-micro-label` span at the
  top of its content, the same pattern `TodaysPlanCard` already used for its own custom header row.

**Not finished / blocked on you:** none — no new env vars, no external accounts, no schema changes.
The one real gap is the live-browser verification wall noted above (password-gated); if you can share
credentials or verify in your own browser, that would close the one thing this phase couldn't check
itself.

**Next phase's manual steps:** Phase 9 (Terminal design system restyle) needs no new env vars or
accounts either — it's a pure visual restyle (JetBrains Mono self-hosted font, new
`TerminalPanel`/`SectionHeader`/`DataRow`/`MonoStat`/`StatusChip` primitives) applied tab-by-tab, each
deployed to prod before the next tab starts, per the spec's own gate.

---

## PHASE 9 — Terminal design system (restyle)

### 9a. Tokens and primitives

**Files created:**
- `src/app/fonts/JetBrainsMono-Variable.woff2` — self-hosted variable weight (100-800), latin subset
  (covers digits). Obtained via a scoped `npm install @fontsource-variable/jetbrains-mono --no-save`
  (never added to `package.json`/lock — installed only to extract the file, then `npm uninstall
  --no-save` immediately after copying it into `src/app/fonts/`), rather than fetching from an
  arbitrary URL. Confirmed afterwards that `package.json`/`package-lock.json` only still show the
  pre-existing `ical.js` diff from Phase 7 — no residue from the temp install.
- `src/components/ui/SectionHeader.tsx`, `StatusChip.tsx`, `MonoStat.tsx`, `DataRow.tsx`,
  `TerminalPanel.tsx` — the five new primitives named in §9a.

**Files modified:**
- `src/app/layout.tsx` — wired `JetBrainsMono-Variable.woff2` through `next/font/local` beside the
  existing `InterVariable`, exposed as `--font-jetbrains-mono`, same self-hosted pattern (build never
  depends on a network font call).
- `src/app/globals.css` — `--rtd-radius-card` 20px → 4px; `.rtd-glass`'s `box-shadow` removed
  (`--rtd-shadow` itself untouched, still used by floating chrome — the tab dock, sheets, dropdowns);
  added `--rtd-font-mono`, `.rtd-mono` utility, and `--rtd-ok`/`--rtd-warn`/`--rtd-danger` aliases onto
  the existing green/orange/red.

**Assumption:** the radius/shadow token change and the new `.rtd-mono` utility class's *existence*
went out as one global commit (per §9a's own "do this first, in one commit"), applying instantly to
every panel app-wide. This is deliberately different from 9b's tab-by-tab work: 9b is about actually
*applying* `.rtd-mono` to each tab's numbers and swapping components, which stays gated one tab at a
time with its own deploy. I did not silently apply `.rtd-mono` to shared classes like `.rtd-nums`/
`.rtd-big-num` globally, since §9a exposes the utility without saying to auto-apply it everywhere —
that auto-apply-everywhere reading would have skipped 9b's whole point.

**Gates:** `tsc`/`eslint`/`next build` clean. Deployed: `npx vercel deploy --prod` →
`road-to-december.vercel.app`.

### 9b. Tab 1/11 — Home

**Files modified:** every Home-only card component (`TodaysPlanCard`, `HabitsCard`, `GoalsCard`,
`TrainingLoadCard`, `FuelRingCard`, `CalendarStripCard`, `KeyTasksCard`, `OperatorCard`,
`HomeHeroBand`, `RecentPRsCard`, `WeekMapCard`, `CoachBriefCard`, `MonthCalendarCard`) — `BentoCard` →
`TerminalPanel` (mechanical swap, same colSpan/rowSpan/label/href contract); every genuinely numeric
display (`AnimatedNumber` wrappers, `rtd-big-num`, `rtd-nums` spans) gained `rtd-mono` alongside its
existing class — the one exception left alone on purpose: `HomeHeroBand`'s readiness word
("Ready"/"Caution"/"Rest") sits in a `.rtd-big-num` span too but isn't a number, so it stayed on
Inter. Also converted `src/components/ui/StatCard.tsx` (a shared primitive, not Home-only — also used
by Analytics' `BodyweightSection`) since it's shared infrastructure like `TerminalPanel` itself, not
page content; its update is a strict visual improvement, not a structural change to Analytics' own
page, which still gets its own dedicated conversion turn later.

**Not converted this tab (out of scope for "Home"):** `NeedsAttentionList` — already uses `GlassCard`
`variant="open"`, which renders identically to `TerminalPanel`'s `variant="open"` (no box chrome
either way), so there's no visual difference to gain from renaming the wrapper; left as `GlassCard`.
`AlertCardList` and `HomeDoorwayDials` — neither uses `BentoCard`/`GlassCard`/`rtd-nums`/`rtd-big-num`
at all (custom markup), so nothing to swap in this pass.

**Gates:** `tsc`/`eslint`/`next build` clean. Deployed: `npx vercel deploy --prod` →
`road-to-december.vercel.app`.

**Not verified live in-browser:** same password-gate wall as Phase 8 — couldn't screenshot the actual
390px/1440px render or confirm the mono font/4px radius look correct in a real browser.

**Next:** CRM is next in §9b's order, then Train, Swim, Fuel, Analytics, School, Business, Learn,
More/Settings, Coach — each its own gate + prod deploy, same as Home just was.

### 9b. Tab 2/11 — CRM

**Files modified:** `src/app/(app)/life/crm/page.tsx` (`SectionLabel` → `SectionHeader`, page title
"CRM" — no number prefix, since Phase 8's `NN //` numbering is specific to Home's 9 defined sections
and there's no equivalent numbering scheme for other tabs' page-level titles); `TaskCard.tsx` (due
badge now a real `StatusChip` instead of hand-rolled pill markup — semantically what it always was;
radius token); `KanbanView.tsx`/`ArchiveView.tsx` (hardcoded `rounded-[12px]`/`rounded-[10px]` →
`rounded-[var(--rtd-radius-card)]`, so these now track the terminal radius instead of a stale
pre-Phase-9 value); `KanbanView.tsx`/`ListView.tsx`/`CategoryView.tsx`/`ArchiveView.tsx`/
`CrmClient.tsx` (task counts and the completed-date stamp gained `rtd-mono`).

**Not converted:** `TaskDrawer.tsx` — a slide-over sheet, not a panel; its radius is already an
explicit override (`rounded-t-[16px] md:rounded-[10px]`), not the `--rtd-radius-card` token, matching
the same "floating chrome keeps its own treatment" reasoning as the tab dock. Form inputs (due date,
est. minutes) stayed on Inter — they're user-entered text fields, not displayed stats.

**Gates:** `tsc`/`eslint`/`next build` clean. Deployed: `npx vercel deploy --prod`.

---

## WS3 — Miles OS design merge (supersedes Phase 9's own token values)

Backfilled retroactively (WS3d §11) from each commit's actual message/diff/stat, not from memory —
these 7 commits happened in an earlier session, between Phase 9's CRM tab (§9b tab 2/11 above) and
WS3d's own §1. Gate output quoted below is what each commit's own message documented at the time,
not re-run live today.

**The one fact every later WS3/WS3d entry depends on:** Phase 9 (§9a above) set its own terminal
tokens — `--rtd-radius-card: 4px`, a translucent glass panel background, `.14` border opacity. When
the user handed over `design/MILES-OS-UI-SPEC.md` (a newer, more specific spec — see `f801e0c`
below), it disagreed with Phase 9 on exactly 3 values: **panel radius 4px → 6px, panel background →
flat `#101010` (was a translucent glass tint that differed mobile vs desktop), border opacity
`.14` → `.055`.** The user's own instruction was "the spec wins" — all three were changed globally
in `f801e0c`, superseding Phase 9's values app-wide, not per-tab. Every `--rtd-mos-*` token added
after that point is new/additive, not a further override of the pre-existing `--rtd-green`/`red`/
`orange`/`blue` domain-color system.

**The second fact: those spec values are desktop-only.** The spec's own type scale and the above
three overrides are a dense desktop-dashboard recipe (8–8.5px labels, `.14`–`.16em` tracking, hairline
borders) that read as too small and low-contrast once actually used on a phone. `7efa672` (last commit
in this section) added a **mobile floor**: `:root` now holds larger/higher-contrast mobile values for
every Miles OS type/border token, overridden back to the spec's exact desktop numbers only inside the
existing `@media (min-width: 1024px)` block. So: **below 1024px, Miles OS tokens read their mobile
floor; at 1024px and up, they read the spec's literal values, unchanged.** Any future WS3d section
touching these tokens must preserve this split, not collapse back to one global value.

### Commit `3c0b6ba` — Give withRetry's timeout error a per-call label

**Files:** 20 files, every `withRetry(...)` call site across the app (`analytics`, `business` ×2,
`fuel`, `home`, `learn` ×2, `life/crm`, `life/journal`, `more/coach-ai`, `more/recovery`,
`more/settings`, `school`, `swim` ×3, `train` ×2, `api/mcp/route.ts`, `lib/db/withRetry.ts`).

**What/why:** `withRetry`'s timeout error message was a generic "DB call timed out" regardless of
which query actually stalled — the commit message cites two real debugging sessions lost tracing a
generic message back to the real query. Every call site now passes a label (e.g. "Home dashboard
data", `` `MCP tool ${name}` ``) so a production timeout points straight at the stalled call. Not a
Miles OS/visual change — an observability fix that happened to land in this stretch of commits.

### Commit `db36e0a` — Fix gym completion checkbox: require all prescribed sets, not just one

**Files:** `src/app/globals.css`, `src/components/train/ExerciseCard.tsx`,
`src/components/train/WorkoutSession.tsx`.

**What/why:** `WorkoutSession.tsx` computed an exercise as complete via `todaysSets.length > 0`, so
one logged set read as "done" even when `targetSets` prescribed 4. Now requires
`todaysSets.length >= targetSets`, falling back to `> 0` only when `targetSets` is null (legacy/
unprescribed exercises). An in-progress exercise now shows "2/4 sets" instead of sitting unchecked
with no explanation. Added a one-shot fill/pop animation (`rtd-check-fill`, ~300ms) gated strictly on
the false→true transition (never fires on mount or on uncomplete/undo), folded into the existing
`prefers-reduced-motion` override. `SessionCompleteSummary`'s entrance animation already existed from
an earlier pass — confirmed working, untouched. Explicitly did **not** touch `train/page.tsx`'s
`pctComplete` (a different variable — the phase's calendar-date progress, not exercise/set
completion); the session-level completion bar inherits the fix automatically since it derives from
the same corrected completion map. Also a non-visual bugfix, not a Miles OS change.

### Commit `f801e0c` — Miles OS design system: tokens + primitives (WS3 part 1/N)

**Files:** 17 files — `design/MILES-OS-UI-SPEC.md` and `design/Miles OS UI Kit.html` (copied into the
repo from Downloads, didn't exist here yet), `design/serve.js` (throwaway static server), `eslint.config.mjs`,
`src/app/fonts/InstrumentSerif-Italic.woff2` (new, self-hosted), `src/app/globals.css`,
`src/app/layout.tsx`, `src/components/ui/{DataRow,InsetField(new),LiveDot(new),MicroLabel(new),
MonoStat,PrimaryButton(new),SectionHeader,SerifAccent(new),Sparkline,StatusChip}.tsx`.

**What/why:** Ports the spec's color tokens/type scale/geometry into `globals.css`, resolving the
3 conflicts with Phase 9 described above in the spec's favor. Self-hosts Instrument Serif italic
(same latin-subset self-hosting pattern as the existing Inter/JetBrains Mono files — no runtime
Google Fonts network call, per the PWA's build-reliability requirement). New primitives —
`MicroLabel`, `InsetField`, `LiveDot`, `PrimaryButton`, `SerifAccent` — are exact recipes from the
spec's own Component Recipes section; `PrimaryButton`'s padding/radius were confirmed against the
live reference kit's own CAPTURE button rather than guessed (same "measure the kit, don't guess"
method WS3d §10 used later for the CRM board). `Sparkline` already existed and got tuned to the
spec's exact numbers (stroke-width 1.2, gradient stop `.28`, `preserveAspectRatio`) instead of a
duplicate component. `StatusChip` gained `hot`/`warm`/`cool` tones alongside its existing
`ok`/`warn`/`danger`/`live`/`neutral` set (additive — this is the exact infrastructure WS3d §10's
TaskCard due-badge discussion and Section 9's CSS-consumer analysis both later relied on being
already in place). `MonoStat` gained `small`/`large` size variants matching the spec's Metric-small/
Metric-large type scale (weight 300/200, not the legacy sizes' bold). `SectionHeader`/`DataRow` moved
to the spec's exact type scale/geometry, cascading to every existing caller immediately — the
intended effect per the task's own "token swap, most should move automatically" framing.

**Gate (per commit message):** tsc/eslint clean (1 pre-existing unrelated warning), `next build`
succeeds across all routes including the 5 tabs already converted by Phase 9. Visual confirmation on
those 5 tabs flagged as not done — password-gated, no live check that session.

### Commit `2748f12` — Rebuild Home to the Miles OS 3-column grid (WS3 part 2/N)

**Files:** `src/app/(app)/home/page.tsx`, `src/app/globals.css`,
`src/components/home/{FuelRingCard,NeedsAttentionList,OperatorCard,TodaysPlanCard,TrainingLoadCard}.tsx`,
`src/components/ui/TerminalPanel.tsx`, `src/lib/time.ts`.

**What/why:** Replaces Phase 8's "9 numbered sections" 12-col grid with the spec's 7-panel mapping:
left rail Operator(01)/Training Load(07, repurposed from the spec's Finance Pulse)/Needs Attention
(08, repurposed from the spec's Key Blockers); center Session(02)/Habits(03)/Calendar(04); right rail
Nutrition(06). Finance itself stays out of scope for this app (Decision 13). New `.rtd-mos-grid` CSS
is mobile-first: the spec's fixed `262px/1fr/262px` columns apply only at ≥1024px; a phone stacks all
three columns in one flow. `OperatorCard` drops its `md:flex-row` layout (now permanently a narrow
262px-rail card, not a full-width hero) and stacks vertically at every width. `TodaysPlanCard` gains
the spec's serif greeting line (`SerifAccent`, time-of-day via a new `greetingForHour()` in
`lib/time.ts`) — the spec's own capture bar is **not** duplicated, since `AppNav`'s global
`CaptureBar` already predates this task. Goals/KeyTasks/AI-daily-brief/month-calendar/week-map/
recent-PRs/bodyweight-stat aren't part of the spec's Home panel list — kept, not deleted, in their own
12-col grid below the new one (same "kept, placed around" call Phase 8 made for the pre-Phase-8
modules it superseded).

**Gate (per commit message):** tsc/eslint clean (1 pre-existing unrelated warning), `next build`
succeeds. Visual confirmation flagged as not done — same password-gate limitation.

### Commit `ef65810` — Stream Home behind Suspense boundaries; finish its Miles OS grid migration

**Files (new):** `src/app/(app)/home/{HomeSections,HomeSkeletons,data}.tsx`. **Modified:**
`src/app/(app)/home/page.tsx` (668 → mostly deleted, most of it moved into the 3 new files),
`src/app/globals.css`.

**What/why:** Home previously awaited a 19-query fetch + `evaluateAlerts` + `dailyBrief` sequentially
before sending any HTML — `withFallback` (§WS3d §1 material, but this predates that section number)
had already stopped the timeouts, but the page still rendered nothing until everything settled.
`HomePage` becomes a plain sync function with zero awaits; the data-dependent regions move into
Suspense-wrapped async components in the 3 new files. `getHomeViewModel` (`data.ts`) wraps the
existing cached+retried fetch and its whole derivation chain in React's `cache()` so
`HeaderActions`/`HomeMainContent`/`CoachBriefSection` can each await it independently without
tripling the query load against the 3-connection pool (§3.1) — **this assumption turned out to be
wrong; see `282c741` immediately below.** `dailyBrief` (the slowest piece — first request of the day
is a live LLM call) gets its own nested boundary so it never blocks the rest of the grid. Also
finishes the grid migration started in `2748f12`: Goals/KeyTasks/CoachBrief/MonthCalendar/WeekMap/
RecentPRs/StatCard move off the old 12-col `.rtd-home-grid` (which is deleted here — it had exactly
one remaining JSX consumer) onto the 3-column Miles OS model, with the WeekMap/RecentPRs/StatCard
group collapsed on mobile via `<details className="lg:contents">` (the exact pattern later reused —
and independently re-verified live — by WS3d §10's KanbanView columns). Skeletons use Miles OS
tokens only (panel bg, 6px radius, a pulse toward `--rtd-mos-panel-2` via new `.rtd-mos-skeleton`),
no shimmer sweep.

**Gate (per commit message):** tsc/eslint/`next build` clean. Could not get real browser TTFB
numbers — session-gated behind a signed JWT cookie, and the commit explicitly declined to mint a
session token to get past that gate ("would cross the same line as typing the account password").
Verified structurally instead: grepped `HomePage`'s function body has no `await`.

### Commit `282c741` — Fix Home streaming: React cache() wasn't deduping across boundaries

**Files:** `src/app/(app)/home/{HomeSections,HomeSkeletons,page}.tsx`.

**What/why:** Live-tested the previous commit's design with a temporary debug counter: the full
19-query fetch + derivation ran **3 times per request**, not once — `cache()`'s request memoization
didn't hold across the sibling/nested Suspense boundaries in practice, so it can't be trusted alone
to guarantee de-duplication. Restructured so that's a structural guarantee instead of a framework
assumption: `getHomeViewModel` is now called from exactly one place (`HomeMainContent`), grep-
verified. The header's action buttons (`QuickLogSheet`/`MoreMenuButton`) moved into that same
boundary rather than their own — splitting them out was what caused the duplicate call.
`CoachBriefSection` (which must stay independently streamable, since `dailyBrief` is genuinely
slower) now takes the already-resolved view model as a prop instead of re-fetching it.

**Gate (per commit message):** verified end-to-end against the dev server with a real session — TTFB
144ms, full response ~10s (dominated by a live cache-miss `dailyBrief` LLM call), confirming the
shell genuinely ships before the slow boundary resolves. Noted React's `$RC` reveal scripts appearing
not-yet-swapped in the rendered DOM well after load; attributed to the Browser pane's known non-
compositing-background-tab limitation (the same class of issue this session hit repeatedly —
`computer{screenshot}` failing, elements measuring `0×0` until the tab is fronted, both documented in
WS3d §10's log entry below) rather than a real defect, since `$RC` is stock `react-dom` streaming
machinery already used elsewhere in the app and the extracted text content was complete/correct —
flagged for a real spot-check rather than asserted outright.

### Commit `7efa672` — Phone-first pass: mobile type/border floor, pinch zoom, tap targets, SW race

**Files:** 28 files — `public/sw.js`, `src/app/globals.css`, `src/app/layout.tsx`,
`src/app/(app)/home/HomeSections.tsx`, `src/app/(app)/swim/{page,session/[sessionId]/page,
sessions/page}.tsx`, and 22 component files across analytics/crm/fuel/home/swim/train/ui.

**What/why:** the mobile-floor/1024px-override split described at the top of this section — added
here, five fixes in one commit:
1. **Type scale as tokens** — `SectionHeader`/`MicroLabel`/`StatusChip`/`PrimaryButton` plus
   `DataRow` and `MonoStat`'s "small" variant read font-size (and, for section/micro, letter-spacing)
   from CSS variables with a mobile floor in `:root`, overridden to the spec's exact values inside
   `@media (min-width: 1024px)`.
2. **Border contrast** — `--rtd-border`/`--rtd-mos-border-row`/`--rtd-mos-border-field` were desktop
   opacities (`.055`/`.04`/`.05`) applied globally, making panel edges disappear on a phone; same
   mobile-floor pattern (`.10`/`.07`/`.08` mobile).
3. **Pinch zoom** — removed `maximumScale: 1` from the viewport config; it was disabling pinch-zoom
   entirely.
4. **Touch targets** — audited every interactive element on Home/Train/Swim/Fuel/CRM at 390px, added
   `.rtd-tap-target` to ~32 controls under 44×44px. One deliberate judgment call flagged in the
   commit: the swim zone-distribution bar's segment buttons get it too even though adjacent thin
   segments' invisible hit zones now overlap — a wrong-zone tap there just re-opens a non-destructive
   detail panel, judged a better trade than a 12px-tall target most phones would miss outright.
5. **Service-worker perceived speed** — navigation requests were network-first with no timeout, so a
   slow-cellular PWA session showed a blank screen for as long as the server took. Added a 3s race:
   a cached copy serves immediately on timeout (network keeps updating the cache in the background);
   with no cached copy it keeps waiting rather than falling through to `/offline` while still online.
   Bumped `CACHE_VERSION` so installed clients pick up the new worker.

**Gate (per commit message):** verified live — computed `--rtd-mos-fs-*`/`--rtd-mos-ls-*`/
`--rtd-border*` token values at 390px match the mobile floor, and at 1280px match the original spec
exactly unchanged (the governing "nothing about desktop changes" rule). Viewport meta confirmed to no
longer carry `maximum-scale`. `.rtd-tap-target::after` confirmed live to expand a 20×14px probe to a
44×44px hit area. Home/Train/Swim/Fuel/CRM themselves stayed behind the login gate, not visually
confirmed that session — flagged for a real device/browser spot-check.

---

## WS3d — MILES OS SWEEP + CARRIED-OVER ITEMS

Full sweep converting old primitives (`GlassCard`/`BentoCard`/`SectionLabel`) to the primitives WS3
introduced above (`TerminalPanel`/`SectionHeader`), tab by tab, one commit per section, per-section
gate (lint/tsc/build/`smoke.mjs`), deploy after every tab-conversion section. §9 and §11 are cleanup/
documentation and don't get their own deploy. Detailed narration for §1–§10 (files, px/hex greps, full
gate output, live verification) already exists in each commit's own message — summarized here per
spec §8's log format rather than re-pasted in full; read `git show <hash>` for the complete text.

### §1 — commit `bca9b20` — spread withFallback to fuel/business/recovery/settings/coach-ai/learn

**Files:** `business/page.tsx`, `fuel/page.tsx`, `learn/[trackId]/page.tsx`, `more/coach-ai/page.tsx`,
`more/recovery/page.tsx`, `more/settings/page.tsx`, `lib/coach/context.ts`. Extended the
`withFallback` degrade-gracefully-under-pool-pressure pattern (already used elsewhere, §3.1) to 6
more pages that were still firing unguarded concurrent queries. Gates: lint/tsc/build clean, smoke
baseline-consistent. Deployed.

### §2 — commit `c578754` — Miles OS restyle — Analytics (5 sections + chart infra)

**Files:** `analytics/page.tsx` + 5 components (`BodyweightSection`, `ChartTooltip`,
`ImprovementMatrix`, `LoadSection`, `PowerSection`, `StrengthSection`) + `chart-theme.ts`. Converted
every Analytics section to `TerminalPanel`/`SectionHeader`; restyled `recharts` axes/grid/tooltips to
hairline mono per §9b's "charts keep recharts, restyle to hairline mono" rule. Gates: lint/tsc/build
clean, smoke baseline-consistent. Deployed.

### §3 — commit `2abf3a2` — Miles OS restyle — School

**Files:** `school/page.tsx` only. Straight `GlassCard`/`SectionLabel` → `TerminalPanel`/
`SectionHeader` swap. Gates: lint/tsc/build clean, smoke baseline-consistent (`/school` unchanged
~25s, the pre-existing Supabase-pool-contention pattern documented since Phase 0). Deployed.

### §4 — commit `33994d1` — Miles OS restyle — Business (8 files)

**Files:** `business/[businessId]/page.tsx`, `business/page.tsx`, and 6 `components/business/*.tsx`
files. Converted the transaction list/logger, task list, note list, business settings, and the
active/archived ventures lists on the index page. **Flagged, not fixed:** `business/[businessId]/
page.tsx` has its own unguarded multi-query `Promise.all` — same vulnerability class §1 addressed
elsewhere, but this file wasn't in §1's named list and wasn't in this section's restyle scope either.
Gates: lint/tsc/build clean, smoke baseline-consistent. Deployed.

### §5 — commit `c58a1af` — Miles OS restyle — Learn track detail

**Files:** `learn/[trackId]/page.tsx` only. **Flagged, not fixed:** `learn/page.tsx` (the Learn tab's
own index page, distinct from `[trackId]`) still uses `SectionLabel` — outside this section's named
scope. Gates: lint/tsc/build clean; this section's first smoke run was interrupted by an MCP
disconnect (task `bw3zqpkic`, no completion record) and re-run clean from a fresh build (`bbm02dw71`)
before committing — noted in the commit message for auditability. Deployed.

### §6 — commit `059619a` — Miles OS restyle — More/Recovery/Settings (7 files)

**Files:** `more/recovery/page.tsx`, `more/settings/page.tsx`, and 5 `components/more/*.tsx` loggers
(`CmjQuickLog`, `SettingsForm`, `SleepLogger`, `SorenessLogger`, `WeighInLogger`). Also fixed one
hardcoded hex found along the way: `SorenessLogger.tsx`'s `color: rating === r ? "#fff" : ...` →
`var(--rtd-text)`. Gates: lint/tsc/build clean, smoke baseline-consistent. Deployed.

### §7 — commit `0c9c2fd` — Miles OS restyle — Coach (verify + convert)

**Files:** `more/coach-ai/page.tsx` only (`SectionLabel` → `SectionHeader` on the page title;
`src/components/coach/*` confirmed clean via grep, needed no changes). The user's original brief had
flagged this tab as possibly needing no work — verified that assumption was wrong (the page-level
title did need converting). `/more/coach-ai` is not in `scripts/smoke.mjs`'s route list, so this
section was verified by grep + build + tsc only, not smoke. Deployed.

### §8 — commit `533d2da` — Miles OS restyle — Shells (error/loading/login/not-found/offline)

**Files:** `app/(app)/error.tsx`, `app/(app)/loading.tsx`, `app/login/page.tsx`, `app/not-found.tsx`,
`app/offline/page.tsx`. Converting these 5 wasn't literally named in the original section-8
instruction (which only asked for screenshot verification) — treated as a precondition for §9's
primitive deletion and flagged as an interpretive extension in the commit message. Screenshot
verification against production (substituting `get_page_text`/`read_page`/`javascript_tool` for the
`computer{screenshot}` tool, which fails in this Browser pane environment — see below) confirmed
`/login` and `/offline` clean at 390px/1440px, zero console errors, zero horizontal scroll.
`/not-found` could **not** be verified — the auth middleware redirects any unmatched/unauthenticated
path to `/login` before Next's own 404 routing resolves, so it's genuinely unreachable without
credentials, contradicting the original instruction's premise that these 5 were "the only
credential-free reachable screens." `error.tsx`/`loading.tsx` need an actual thrown error/slow
navigation to trigger, not live-verified. Deployed.

### §9 — commit `3190517` — delete dead GlassCard/BentoCard primitives

**Files:** deleted `components/ui/{GlassCard,BentoCard}.tsx`; edited doc comments in `globals.css`
(the `.rtd-open-section` block) and `TerminalPanel.tsx` to remove stale references to the deleted
components. Required precondition, done first: grepped `.rtd-glass`/`.rtd-glass-blur`/
`.rtd-glass-interactive`/`.rtd-open-section`/`.rtd-bento-card` across all of `src/` independent of the
two components being deleted — all five classes have live raw-`className` consumers elsewhere
(including `TerminalPanel.tsx` itself, `OverviewTile.tsx`, and `fuel`/`AnalyticsView`/
`FuelAdherenceCard`/`RecoveryOverlayCard`), so **no CSS was removed**, only the two `.tsx` files and
two stale comment blocks. Gates: lint/tsc/build clean, smoke baseline-consistent. No deploy — cleanup,
not independently user-facing.

### §10 — commit `3a9ba7f` — CRM layout rebuild (Miles OS board)

**Files:** new `lib/crm/buckets.ts`; modified `CrmClient`, `KanbanView`, `ListView`, `TaskCard`,
`TaskDrawer`, `SectionHeader`. Full detail already in this commit's own message (spec-conflict
resolution, exact kit-measured recipes, live manual verification since `/life/crm` isn't in
`smoke.mjs`'s route list) — see `git show 3a9ba7f`. Gates: lint/tsc/build clean, smoke baseline-
consistent. Deployed.

---

## WS4 §4d — close-out (2026-08-02)

WS4 (swim schema, the Analyst, parse reliability — §0 through §4c) ran commit-by-commit
(`c74fd6f`..`367688c`) without a section-by-section log entry each time, unlike WS3d; full detail
for each lives in its own commit message (`git show <hash>`). This entry closes out §4d, the last
two commits before WS5 begins:

- **`e70c075`** — WS4 §4c Part A (A1 only): added the bare trailing-multiplier rule ("4x100 3
  sets" reads identically to "4x100 x 3 sets") and the never-drop-a-block rule (an unconfident
  parse line must still emit a best-reading + ambiguities entry, never silently vanish) to
  `SWIM_SHORTHAND_RULES` — user-message only, `ANALYST_SYSTEM_PROMPT` untouched per the standing
  constraint. **§4c A2 verification (the 4-session regression fixture) was left PENDING by this
  commit's own message** — blocked mid-run by Groq's 100k-tokens/day cap. Not re-attempted since;
  WS5 §0 Task 5 (this session, Groq-quota permitting) is the next attempt.
- **`62f6945`** — WS4 §4d Task 2: `callGroqChat` converted from `string | null` to a discriminated
  `GroqChatResult` (`missing_key` / `rate_limited{scope: "tpm"|"tpd"|"unknown"}` / `http_error` /
  `network_error` / `parse_error`), every failure logged once centrally inside the function itself.
  All 13 call sites across 12 files updated mechanically (`if (!content)` → `if (!result.ok)`).
  Gates: lint clean (1 pre-existing unrelated warning), tsc clean, build clean, smoke unchanged
  from baseline (6 pre-existing `/analytics` timeout failures, zero regressions). Three sibling
  functions (`callGroqChatWithTools`, `streamGroqChat`, `transcribeAudio`) were explicitly left
  returning plain `null` — out of scope for that task, picked up in WS5 §0 Task 3D.

---

## WS5 §0 — spec transcription, diagnosis, audit, UI pass (begun 2026-08-02)

`SWIM_INTELLIGENCE_SPEC.md` added to the repo root: verbatim transcription of the swim
intelligence architecture spec (governing "code computes, the LLM interprets" decision, athlete
PBs with full split profiles, QT derivation rule, 2025 SEA Games reference times, QT stability
ratings per event, the 7-phase build plan 5.1–5.7). Every time value in the file was re-read after
writing and cross-checked digit-for-digit against the source spec text, including the worked-proof
arithmetic (31.0 − 30.46 = 0.54s; 31.0+36.7+37.1+36.7 = 2:21.5) — transcribed clean, no
corrections needed. This is WS5 §0's Task 1; the remaining tasks in this section (unhandled-
rejection diagnosis, full logging-surface audit + weight-entry fix, Home UI gap pass, and a
Groq-quota-permitting §4c A2 rerun) are tracked and reported in this session, each gated and
committed on its own per the section's own rules.

### Task 4C — "Today I will" intention input: schema gap, migration not applied

Every other Task 4 item (`d27155c`) landed. 4C needed a single-line, per-day, user-authored
intention that persists across reload. No existing column fits without repurposing something with
a different documented purpose (`ai_takeaways` is a per-day cache keyed by feature name for
*AI-generated* one-liners, explicitly to avoid re-costing a Groq call — using it for direct user
input would conflate two different concerns the table's own comment says are meant to stay
separate). Per the task's own instruction, showing the migration and stopping here rather than
building on top of a repurposed table:

```sql
CREATE TABLE daily_intentions (
  date       date PRIMARY KEY,
  text       text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

Drizzle (`src/lib/db/schema.ts`, alongside `dailyBriefs` which shares the same date-primary-key
shape):

```ts
export const dailyIntentions = pgTable("daily_intentions", {
  date: date("date").primaryKey(),
  text: text("text").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
```

Not applied — no `db:push`/`db:generate` run, no `getTodayIntention`/`setIntentionAction` written,
no input rendered on `TodaysPlanCard`. Next step if approved: add the table, a query + a server
action (upsert by `date`, mirroring `toggleHabitSubtaskAction`'s `onConflictDoUpdate` pattern), and
the input itself below the greeting on "02 // SESSION," gated behind the same four checks as
everything else in this pass.
