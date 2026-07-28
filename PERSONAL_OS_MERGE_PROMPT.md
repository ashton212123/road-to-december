# Road to December → Personal OS — Merge Build Spec

**For: Sonnet 5, executing in a fresh chat inside `C:\Users\Ashton\Documents\road-to-december`.**
**Planned by: Opus 5. Decisions are already made. Your job is execution, not design.**

---

## 0. READ THIS FIRST — HOW TO USE THIS DOCUMENT

This file merges the "Personal OS" architecture (Miles Deutscher / AI Edge build cheat sheet) into
the existing **Road to December** app, without losing a single thing the app already does.

**Rules for you, the executing agent:**

1. **Do not re-plan.** Every architectural choice below was made deliberately by the user. If you
   think something is wrong, **stop and say so in one sentence** — do not silently substitute your
   own approach.
2. **Execute ONE PHASE PER SESSION.** The user pastes "Run Phase N". Do that phase only. Do not
   run ahead.
3. **Never delete or migrate existing user data.** This is a live app with a real training season
   logged in it. Additive schema changes only, unless a phase explicitly says otherwise.
4. **Never invent a preference.** If a detail is genuinely not covered here, pick the option most
   consistent with the surrounding code, and list it under "Assumptions" in your final report.
5. **Finish the phase completely.** No stubs, no `TODO: implement later`, no placeholder handlers.
   If you cannot finish something, say exactly what and why.
6. Read `AGENTS.md` before writing any Next.js code — this repo runs **Next.js 16.2.10**, which has
   breaking changes from what you were trained on. The guides are in `node_modules/next/dist/docs/`.

---

## 1. WHAT THIS APP ALREADY IS (do not break any of it)

Road to December is a personal athlete command centre for a teenage competitive swimmer, live at
`https://road-to-december.vercel.app`, in daily use during a real season.

**Stack:** Next.js 16.2.10 (App Router, Turbopack) · React 19.2.4 · Tailwind v4 · Drizzle ORM +
`postgres` against Supabase Postgres (`us-east-1`, ref `heshaprgtpuhamravban`) · `jose` for auth ·
Groq for all AI · `recharts` · `mcp-handler` · deployed CLI-only to Vercel.

**Existing tabs:** Home, Train, Swim, Fuel, Analytics, Business, School, Learn, More
(More → Coach AI, Recovery, Settings).

**Existing domain logic that is the whole point of the app — PRESERVE ALL OF IT:**

| Area | Location | What it holds |
|---|---|---|
| Swim science | `src/lib/swim/` | `criticalSpeed`, `taper`, `racePlans`, `dps`, `bottlenecks`, `imModel`, `zones`, `pace`, `readiness`, `sessionAnalysis`, `evidence` |
| Fuel plan | `src/lib/fuel/` | `carbPeriodization`, `energyModel`, `targets`, `scheduleFromWeek`, `food-library` |
| Gym plan | `src/lib/train/` | `e1rm`, `progression`, `transfer`, `phaseWeek`, `parse-prescription`, `importSession` |
| AI coach | `src/lib/coach/` | `athleteModel`, `context`, `dailyBrief`, `tools`, `quickPrompts`, `strengthTakeaway` |
| Analytics | `src/lib/analytics/` | `improvementMatrix`, `load` (ACWR), `periodCompare`, `tonnage`, `streak`, `takeaways` |
| Rules engine | `src/lib/rules/` | `engine`, `readiness`, `readinessTone` |

**29 existing tables** in `src/lib/db/schema.ts` — phases, sessions, exercises, workoutLogs,
weighIns, cmjTests, jumpTests, swimTimes, timeTo15m, foodLogs, waterLogs, sleepLogs, sorenessLogs,
settings, businesses, businessTransactions, businessTasks, businessNotes, canvasCourses,
canvasAssignments, meets, meetEvents, swimSessions, sessionLoads, dailyBriefs, aiTakeaways,
learnProgress, coachMessages, knowledge.

**Existing write-tool layer** — this is important, you will reuse it, not duplicate it:
- `src/lib/coach/tools.ts` — `log_water`, `log_meal`, `log_sleep`, `log_weigh_in`, `log_soreness`,
  `log_swim_session`, `log_swim_time`, `log_gym_set`, `update_water_target`,
  `update_training_status`, `update_coach_memory`, `undo_last`, `get_today_summary`
- `src/app/api/mcp/route.ts` — the same surface exposed over MCP (25 tools)

**Single-user app.** There is no `user_id` column anywhere. Keep it that way.

---

## 2. THE DECISIONS (locked — do not revisit)

| # | Decision | Chosen |
|---|---|---|
| 1 | Visual language | **Adopt the Personal OS terminal aesthetic everywhere** — monospace numerals, `01 // SECTION` headers, hairline-bordered panels, dense data. **Mobile = same aesthetic, single-column stacked layout, existing sliding pill nav retained.** |
| 2 | Restyle rollout | **Straight swap, tab by tab.** No theme toggle. Each restyle phase converts its tabs permanently. |
| 3 | Voice capture | **New dedicated Telegram bot → Vercel webhook.** Independent of the existing Hermes agent, which stays exactly as it is. |
| 4 | Transcription | **Groq `whisper-large-v3-turbo`** (free tier — the app's zero-developer-cost rule). |
| 5 | Classification | **Groq** via the existing `src/lib/ai/groq.ts` client. |
| 6 | Memory / Brain | **pgvector on Supabase + Google Gemini embeddings** (free tier). |
| 7 | Capture routing | **Routes into the real athlete tables** through the existing tool executors — a voice note can create a swim session, a meal, a gym set, a task, and a journal entry in one shot. |
| 8 | CRM scope | **New universal task layer.** Business tasks and Canvas assignments are mirrored into it read-only and starrable; they keep living in their own tables and tabs. |
| 9 | Habits | **Seeded with swimmer defaults, fully editable in-app.** |
| 10 | Goals | Week + month lists. **Use a real `goals` table** — do NOT use the cheat sheet's sentinel-date hack. |
| 11 | Calendar | **Google Calendar private iCal feed**, `ical.js` only. User will supply `GOOGLE_CALENDAR_ICAL_URL`. |
| 12 | Navigation | **Two rails: ATHLETE and LIFE**, with a shared Home. |
| 13 | Finance | **Excluded entirely.** Build nothing finance-related. |

---

## 3. NON-NEGOTIABLE CONSTRAINTS (these have all already cost this project real time)

Read every one. Each is a bug that has actually happened in this repo or is documented in the
Personal OS cheat sheet.

### 3.1 Database connection pool is capped at 3
`src/lib/db/index.ts` sets `max: 3` deliberately (Supabase free-tier Micro budget). **Any function
that fires more than ~3 truly concurrent queries via `Promise.all` will starve one query
indefinitely under load** — this hung `/api/coach/chat` past the 60s Vercel limit three times.

Therefore:
- Batch multi-round-trip work into ONE joined/batched query. The model to copy is
  `src/lib/db/analyticsQuery.ts` (one big `json_agg` query).
- Wrap any remaining concurrent query in `src/lib/db/withFallback.ts`, which degrades to an
  empty/null value after 10s instead of hanging.
- **The Telegram webhook and the capture pipeline must be sequential**, not `Promise.all`.

### 3.2 ESLint here runs the React Compiler's strict hooks rules
Stricter than stock `eslint-config-next`. Two traps that will fail your build:
- `setState` called synchronously in a `useEffect` body fails `react-hooks/set-state-in-effect`,
  even for legitimate ticking timers. Move the `setState` **inside** the `setInterval`/`setTimeout`
  callback.
- `Date.now()` inside a component-body function reachable only through a prop-wrapper arrow
  (`onClick={() => handler(x)}`) is flagged as impure-during-render. Compute `Date.now()` at the
  JSX-wired event handler and pass the timestamp down as an argument.

### 3.3 Day rollover — use the helper that already exists
`src/lib/time.ts` exports `todayManilaISO()` (Asia/Manila). **Use it for every "what day is it"
question** — habit reset, journal date, capture date, daily log anchor. Do NOT write a new
date helper, do NOT use the server's clock, do NOT use UTC. (This is the cheat sheet's "habits
reset at 4am" bug, already solved in this repo.)

### 3.4 Telegram will retry your webhook if you are slow
If the webhook does not return 200 within a few seconds, Telegram redelivers the same update and
you get duplicate logs. Therefore:
- Return `200` **immediately**, then do the work in Next.js 16's `after()` from `next/server`.
- **Dedupe on `update_id`**: persist it and no-op on a repeat. This is mandatory, not optional.

### 3.5 iCal parsing
Use **`ical.js`** (Mozilla's parser). **Never `node-ical` or `rrule`** — Next's bundler mangles
their BigInt usage and they break only on production Vercel, not locally
(`o.BigInt is not a function`). Expand recurrences with `event.iterator()`.

### 3.6 Never swallow errors
`.catch(() => {})` is banned in anything that writes. Every failed write must log a real error and
surface a visible failure state. The cheat sheet's "silent POST failure" bug and this repo's
history both trace to empty catch blocks and missing NOT NULL columns on first INSERT.

### 3.7 Mount-time GET must not clobber a fresh local edit
Any card that optimistically updates then syncs needs a `dirtyRef`: once the user has edited,
ignore the in-flight mount-time GET response.

### 3.8 Deploy and env-var mechanics
- Deploys are **CLI-only**: `npx vercel deploy --prod`. Pushing to GitHub does NOT deploy.
- **Never pipe into `vercel env add` from PowerShell** — it silently stores an empty string. Use the
  Bash tool: `printf '%s' "$v" | npx vercel env add NAME production`.
- `vercel env pull --environment=production` returns **empty values**. Pull `development` to verify.
- `drizzle-kit push` needs `--force` in a non-TTY shell.
- `next build` here runs Turbopack and prints **no** first-load-JS table. Don't report bundle sizes.

### 3.9 Never commit secrets. Never run destructive git or SQL without asking.
Schema changes: run `npm run db:generate`, **read the generated SQL**, and if it contains any
`DROP`, `ALTER ... TYPE`, or `NOT NULL` added to an existing populated column — **stop and ask the
user before pushing.** Additive `CREATE TABLE` / `ADD COLUMN` you may push yourself.

---

## 4. NEW ENVIRONMENT VARIABLES

Add to `.env.example`, `.env.local`, and Vercel production. The user performs the manual steps.

| Var | Source | Used by |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | @BotFather → `/newbot` | Capture webhook |
| `TELEGRAM_WEBHOOK_SECRET` | `openssl rand -hex 16` | Webhook auth |
| `TELEGRAM_USER_ID` | @userinfobot | Locks bot to the user only |
| `GEMINI_API_KEY` | aistudio.google.com | Embeddings |
| `GOOGLE_CALENDAR_ICAL_URL` | Google Calendar → Settings → Secret address in iCal format | Calendar card |
| `CRON_SECRET` | `openssl rand -hex 16` | Nightly rollup cron auth |

Already present: `DATABASE_URL`, `AUTH_SESSION_SECRET`, `GROQ_API_KEY`.

**Manual checklist for the user (surface this at the start of Phase 2):**
1. Telegram → @BotFather → `/newbot` → save token.
2. Telegram → @userinfobot → save numeric ID.
3. aistudio.google.com → create API key.
4. Google Calendar → Settings → your calendar → copy the **secret** iCal address.

---

## 5. PHASES

Run in order. Each ends with a **gate** that must pass before the next phase starts.

---

### PHASE 0 — Recon and baseline (no code)

**Goal:** prove the app is green before touching anything, and confirm you've read the ground truth.

1. Read, in full: `src/lib/db/schema.ts`, `src/lib/db/index.ts`, `src/lib/coach/tools.ts`,
   `src/lib/ai/groq.ts`, `src/lib/time.ts`, `src/app/(app)/layout.tsx`,
   `src/app/globals.css`, `src/components/ui/` (all of it), and `DECISIONS.md`.
2. Run and record the output of:
   ```bash
   npm run lint && npx tsc --noEmit && npm run build
   ```
3. Run `node scripts/smoke.mjs` and record the result.
4. Create `PERSONAL_OS_LOG.md` at the repo root. Every phase appends: what changed, files touched,
   what you verified, and any assumption you had to make.

**Gate:** lint + typecheck + build all pass on the untouched tree. If any already fail, report the
failures and **stop** — do not start Phase 1 on a broken baseline.

---

### PHASE 1 — Schema, pgvector, embeddings

**Goal:** every table the rest of the build needs, plus a working embedding function.

#### 1a. Enable pgvector
Create `scripts/enable-pgvector.mjs` — connects with `DATABASE_URL` via `postgres`, runs
`CREATE EXTENSION IF NOT EXISTS vector;`, prints confirmation, exits. Run it.

#### 1b. New tables — append to `src/lib/db/schema.ts`
Follow the file's existing conventions exactly (naming, `timestamp` defaults, index style).
No `user_id` columns.

```
rawCaptures        id · source ('telegram'|'web'|'ios') · telegramUpdateId (unique, nullable)
                   · rawText · transcript · audioFileId · classification (jsonb)
                   · model · routedTo (text[]) · routedIds (jsonb)
                   · status ('pending'|'routed'|'failed'|'discarded') · error · createdAt

tasks              id · title · notes · urgency ('today'|'week'|'month'|'someday')
                   · isKey (bool, default false) · priorityScore (real, default 0)
                   · timeEstimateMin (int) · tags (text[]) · dueDate (date) · rail ('life'|'athlete')
                   · category · sourceKind ('manual'|'capture'|'business'|'canvas')
                   · sourceId (text) · captureId (fk rawCaptures, nullable)
                   · completedAt · createdAt · updatedAt
                   UNIQUE (sourceKind, sourceId) WHERE sourceKind <> 'manual'

habits             id · name · category · sortOrder · subtasks (jsonb: {id,label}[])
                   · active (bool default true) · createdAt

habitLogs          id · habitId (fk) · logDate (date) · doneSubtaskIds (text[])
                   · completed (bool) · createdAt · updatedAt
                   UNIQUE (habitId, logDate)

journalEntries     id · entryDate (date) · rawText · transcript · summary (text)
                   · mood (int, nullable) · tags (text[]) · source ('telegram'|'web')
                   · captureId (fk, nullable) · createdAt

goals              id · scope ('week'|'month') · text · done (bool default false)
                   · sortOrder · createdAt · completedAt

memoryChunks       id · sourceType · sourceId · sourceDate (date, nullable) · text
                   · embedding (vector(768)) · metadata (jsonb) · createdAt
                   UNIQUE (sourceType, sourceId)

auditLog           id · action · resourceType · resourceId · metadata (jsonb) · createdAt
```

Use Drizzle's `vector` type from `drizzle-orm/pg-core` with `dimensions: 768`.

#### 1c. Index
Add an **HNSW** index, not ivfflat: `USING hnsw (embedding vector_cosine_ops)`. HNSW needs no
training pass, which matters because this table starts empty. Add it in the generated migration SQL
if drizzle-kit won't emit it.

#### 1d. Embeddings client — `src/lib/ai/embed.ts`
Mirror the defensive shape of `src/lib/ai/groq.ts`: never throws, returns `null` on missing key or
failure, callers must have a non-AI fallback.

```ts
export async function embed(text: string): Promise<number[] | null>
export async function embedBatch(texts: string[]): Promise<(number[] | null)[]>
```

Google Generative Language API, `:embedContent`, `outputDimensionality: 768`.
**Model names move — probe before hardcoding.** Try `text-embedding-004` first, fall back to
`gemini-embedding-001`. Write a one-off script that curls both, use whichever returns 200, and
record the winner in `PERSONAL_OS_LOG.md`. Batch with `:batchEmbedContents` where available.
Free tier is rate-limited: cap `embedBatch` at 100 items per call with a 1s pause between batches.

#### 1e. Memory writer — `src/lib/memory/write.ts`
```ts
export async function rememberChunk(input: {
  sourceType: string; sourceId: string; sourceDate?: string;
  text: string; metadata?: Record<string, unknown>;
}): Promise<void>
```
Embeds, upserts on `(sourceType, sourceId)`. **Never throws** — a failed embedding must never fail
the write that triggered it. Log the error, move on.

**Gate:**
- `npm run db:generate` → **read the SQL**, confirm it is purely additive → `npm run db:push -- --force`
- `npx tsc --noEmit && npm run lint && npm run build` all pass
- A scratch script embeds "test" and prints a 768-length array
- Existing tables and row counts unchanged — verify with a `SELECT count(*)` on `swim_sessions`,
  `food_logs`, `workout_logs` before and after

---

### PHASE 2 — Capture pipeline (the backbone)

**Goal:** speak into Telegram from anywhere → it lands in the right table within ~5 seconds.
Build this before any UI. Everything downstream reads what this writes.

#### 2a. Extract the tool executors — `src/lib/capture/executors.ts`
Right now the write logic lives inside `src/lib/coach/tools.ts`'s tool loop. **Refactor** so each
executor is an exported pure async function taking a typed payload:

```ts
logSwimSession(p) · logSwimTime(p) · logGymSet(p) · logMeal(p) · logWater(p)
logSleep(p) · logWeighIn(p) · logSoreness(p) · updateCoachMemory(p)
```

`src/lib/coach/tools.ts` and `src/app/api/mcp/route.ts` must both be rewired to call these same
functions. **This is a pure refactor — the coach's and MCP's behaviour must not change at all.**
Verify by exercising the coach chat before and after.

Then add the new-table executors alongside them:
`createTask(p)` · `createJournalEntry(p)` · `createNote(p)`.

#### 2b. Classifier — `src/lib/capture/classify.ts`
```ts
type Route = { kind: RouteKind; payload: Record<string, unknown>; confidence: number };
type Classification = { routes: Route[]; summary: string; urgency: Urgency; tags: string[] };
```
`RouteKind` = `swim_session | swim_time | gym_set | meal | water | sleep | weigh_in | soreness |
task | journal | note | coach_memory`.

Call Groq in JSON mode via `callGroqChat`. The system prompt must:
- state today's date from `todayManilaISO()` and the athlete's context (competitive swimmer,
  goal meet in December);
- allow **multiple routes from one capture** ("swam 6x100 free on 1:30, felt heavy, then chicken and
  rice" → `swim_session` + `soreness` + `meal`);
- return **only** JSON matching the schema above;
- set low confidence rather than guessing when unsure.

Fallbacks, in order: Groq → a regex/keyword matcher (`/\b\d+x\d+\b/` → swim, "ate|had" → meal,
"remind|need to|todo" → task) → route everything to `note` so nothing is ever lost.

**Validate every payload with `zod` before it reaches an executor.** Drop routes that fail
validation, record them in `rawCaptures.error`, keep the rest.

#### 2c. Webhook — `src/app/api/telegram/webhook/route.ts`
1. Verify header `x-telegram-bot-api-secret-token` === `TELEGRAM_WEBHOOK_SECRET` → else 401.
2. Verify `message.from.id` === `TELEGRAM_USER_ID` → else 200 with no action (do not leak).
3. Dedupe on `update_id` (§3.4). Already seen → return 200, do nothing.
4. **Return 200 now.** Everything below runs inside `after()`.
5. Voice/audio → `getFile` → download → POST to
   `https://api.groq.com/openai/v1/audio/transcriptions`, model `whisper-large-v3-turbo`.
   Telegram sends **OGG** — set the multipart filename to `voice.ogg` and the correct content type,
   or transcription returns an empty string.
6. Text → use as-is.
7. Insert `rawCaptures` row (status `pending`) **first**, so a later crash still leaves the raw text.
8. Classify → execute each route **sequentially** (§3.1) → collect `routedTo` / `routedIds`.
9. `rememberChunk` for the capture.
10. `auditLog` row.
11. Update the `rawCaptures` row to `routed` (or `failed` with the error text).
12. Reply in Telegram: a confirmation listing exactly what was written, plus an inline keyboard —
    `Today · This Week · This Month · Someday · ★ Key · Undo`. Urgency buttons patch the created
    task; **Undo** deletes everything this capture wrote (that's what `routedIds` is for) and marks
    the capture `discarded`.
13. Callback handler for those buttons (same route, `callback_query` branch).

**Maximum resilience rule:** the raw text must survive every failure mode. A crashed classifier, a
rejected payload, a dead Groq key — the `rawCaptures` row still exists and the user still gets a
Telegram reply saying what went wrong.

#### 2d. Web capture — `src/app/api/capture/route.ts` + floating capture bar
Same pipeline, `source: 'web'`. Auth via the existing session cookie **or** an `x-api-secret` header.
UI: a capture bar pinned above the tab bar on Home. Focus expands it. Submit → optimistic "captured"
toast → shows the parsed routes when the response lands.
**It must never cover an interactive control** — this app has a standing rule about floating
elements blocking buttons. Verify against the tab bar and the coach FAB on a 390px viewport.

#### 2e. Register the webhook
```bash
curl -F "url=https://road-to-december.vercel.app/api/telegram/webhook" \
     -F "secret_token=$TELEGRAM_WEBHOOK_SECRET" \
     "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook"
```
Add `/api/telegram/webhook` and `/api/capture` to the **middleware auth bypass list** — Telegram
cannot present a session cookie. They are protected by their own secrets instead. Double-check
`middleware.ts` actually excludes them, or every capture 302s to `/login`.

**Gate:**
- Deploy to prod. Send a **text** message → correct table gets a row → Telegram confirms.
- Send a **voice note** describing a swim set → `swim_sessions` row appears with sane fields.
- Send one voice note mixing a set + a meal → **two** rows, one capture.
- Send gibberish → lands as a `note`, nothing crashes, reply explains.
- Tap **Undo** → the written rows are gone.
- Send the same `update_id` twice (replay the JSON with curl) → exactly one set of rows.
- Coach chat and every MCP tool still behave identically to Phase 0.

---

### PHASE 3 — CRM

**Goal:** one task system for the whole life, at `/life/crm`.

#### 3a. Data layer — `src/lib/crm/`
- `queries.ts` — single batched query (copy `analyticsQuery.ts`'s `json_agg` pattern) returning all
  open tasks grouped by urgency, plus counts. **One round trip.**
- `mirror.ts` — syncs `businessTasks` and `canvasAssignments` into `tasks` as rows with
  `sourceKind='business'|'canvas'` and `sourceId`, upserting on the unique constraint. Runs on CRM
  page load and after any capture. Mirror rows are **read-only for title/notes** but the user can
  star them and change their urgency. Completing a mirrored row calls back through the existing
  business/school completion path so the source stays authoritative.
- `priority.ts` — `priorityScore` from urgency tier, key flag, due-date proximity and age. Used for
  default ordering and for the Home key-tasks list.

#### 3b. Server actions — `src/app/(app)/life/crm/actions.ts`
`createTask`, `updateTask`, `completeTask`, `uncompleteTask`, `deleteTask`, `reorderTask`,
`toggleKey`, `setUrgency`. Follow the existing actions files' shape exactly (`"use server"`,
`revalidatePath`).

#### 3c. UI
Three views behind a `SegmentedControl`, persisted to `localStorage`:
- **Kanban** — four columns (Today / This Week / This Month / Someday). Desktop: native HTML5 drag
  between and within columns, persisting `priorityScore` on drop. **Mobile: no drag** — tapping a
  task opens the drawer, which has a "move to" segmented control. Do not add a drag-and-drop
  dependency.
- **List** — flat, sorted by `priorityScore`, grouped by urgency with sticky headers.
- **Category** — grouped by `category` / `rail`.

Task drawer: slide-over, inline edit of every field, delete with an undo toast.
New tasks insert at the top of their tier. Completed tasks move to an Archive view.
★ starred tasks feed Home's `06 // KEY TASKS`.

**Gate:** create / edit / complete / delete / reorder all persist across a hard refresh. A business
task appears mirrored, can be starred, and completing it from the CRM marks it done on the Business
tab. Kanban drag persists on desktop; mobile move-via-drawer works on a 390px viewport. Zero console
errors.

---

### PHASE 4 — Habits and Goals

#### 4a. Habits — `/life` home section + `src/lib/habits/`
Seed migration inserts six grouped habits (all editable/deletable in Settings afterwards):

| # | Habit | Category | Subtasks |
|---|---|---|---|
| 1 | Morning | routine | Hydrate · Weigh in · Check today's plan |
| 2 | Pool session | swim | Warm-up · Main set · Log the session |
| 3 | Gym session | train | Session complete · Log the sets |
| 4 | Fuel | fuel | Hit protein target · Hit water target · Pre-session carbs |
| 5 | School block | school | Homework done · Assignments checked |
| 6 | Evening wind-down | recovery | Journal · Log sleep · Screens off |

Behaviour:
- Ticking every subtask auto-completes the parent.
- Home shows `done / total` and a `%` for the day.
- Day key is `todayManilaISO()` (§3.3).
- `localStorage` cache for instant feedback, synced to `habitLogs` on every tap, reconciled on mount
  with the `dirtyRef` guard from §3.7.
- A 30-day streak strip using the existing `DotStrip` component.
- Settings gets a habit editor: add / rename / reorder / archive habits and subtasks.

#### 4b. Goals — `src/lib/goals/` + Home card
Two sections, THIS WEEK and THIS MONTH, each a list plus an add input. Check off, reorder, delete.
Persistent — nothing auto-clears (real table, §Decision 10). Home shows up to 5 per scope.

**Gate:** tick a subtask on the phone, hard refresh, still ticked. Tick all subtasks → parent
completes → % updates. Add a goal, wait past midnight Manila (or fake the date), goal still there,
habits reset. Habit editor round-trips.

---

### PHASE 5 — Journal

**Goal:** speak your day, get it summarised, keep the raw text forever.

- `/life/journal` — reverse-chronological list of days. Each entry shows the AI summary; a
  **Show raw** toggle reveals the full transcript.
- In-app recording: `MediaRecorder` → POST to `/api/journal/transcribe` → Groq whisper → Groq
  summary (3-5 sentences, second person, factual, no therapy voice) → save `journalEntries`.
  Must work in iOS Safari — request the mic explicitly and handle denial with a visible message and
  a text-entry fallback. **A failed transcription must still let the user save what they typed.**
- Telegram: captures classified `journal` land here automatically.
- Every entry calls `rememberChunk` so the Brain and the coach can see it.
- Nightly cron `/api/cron/journal-rollup` (Vercel cron, auth `Authorization: Bearer ${CRON_SECRET}`)
  writes a one-line day summary and links it to that day's training and fuel data.

**Gate:** record on the phone → transcript + summary appear. Deny mic permission → clear message,
typing still works. Telegram journal note lands on the right date. Raw toggle shows full text.

---

### PHASE 6 — Brain

**Goal:** ask a question in plain English, get an answer grounded in your own logged season.

#### 6a. Backfill — `scripts/backfill-memory.mjs`
**This is the part that makes the app's existing memory portable — do not skip it.**
Embed everything already in the database into `memoryChunks`:
swim sessions · swim times · workout logs · food logs · sleep · soreness · weigh-ins · meets and
meet events · business notes and tasks · Canvas assignments · coach messages · `knowledge` rows ·
daily briefs · AI takeaways.

Each row becomes one canonical sentence of text plus metadata (date, type, source id).
Batch through `embedBatch`, respect the free-tier rate limit, resumable (skip rows already chunked),
and print progress. Run it once and record the chunk count in `PERSONAL_OS_LOG.md`.

#### 6b. Search — `src/lib/memory/search.ts` + `POST /api/memory/search`
Embed the query → `ORDER BY embedding <=> $1 LIMIT 20` → join back to source rows → return with
dates and types. Hybrid: also run a Postgres `ILIKE`/tsvector pass and merge, so exact terms like a
lift name or a split time are never missed by the vector alone.

#### 6c. Ask — `POST /api/brain/ask`
Top-20 chunks (truncated ~200 tokens each) + question → Groq, with this system prompt:

> You are Ashton's personal operating system. Answer using ONLY the provided context. Cite sources
> inline by their `[type:id]` tag. If the context does not contain the answer, say so plainly — do
> not guess about training data.

#### 6d. `/life/brain` page
A search box at the top. Below it, category tiles: **Swim · Gym · Fuel · School · Business · Health ·
Ideas · Life admin**. Tapping one lists everything in that category with an AI summary of the
current state and any open loops. Every result is clickable through to its source page.

**Gate:** backfill completes with a non-zero chunk count. "what was my best 200 free split this
season" returns real rows from the DB. "what did I say about my shoulder" surfaces the actual
soreness log or journal entry. A question with no supporting data gets "I don't have that" rather
than an invention.

---

### PHASE 7 — Calendar

- `npm i ical.js` (§3.5 — **not** `node-ical`).
- `GET /api/calendar` — fetch `GOOGLE_CALENDAR_ICAL_URL`, parse, expand recurrences via
  `event.iterator()` over a 14-day window, 5-minute module-memory cache, respond
  `cache-control: no-store`.
- Home card: 7-day strip, today highlighted, tap a day to expand its events, auto-scroll to a NOW
  marker. Overlay the app's own known dates — meets from `meets`, planned sessions from `sessions` —
  so school and training appear in one place.
- No env var set → a clean "connect your calendar" empty state, never an error.

**Gate:** real events render. A recurring weekly class appears on every occurrence. Unset env var
degrades gracefully.

---

### PHASE 8 — Operator home + two-rail navigation

#### 8a. Two rails
A rail switcher in the header — `ATHLETE | LIFE` — persisted to `localStorage`, animated
(motion in this app is non-negotiable; the sliding pill nav is a standing requirement).

| Rail | Mobile tab bar (5) | Extra on desktop sidebar |
|---|---|---|
| ATHLETE | Home · Train · Swim · Fuel · Analytics | Recovery, Learn |
| LIFE | Home · CRM · Brain · Journal · School | Business, Settings |

Home is shared and identical in both rails. `More` remains the overflow on both.
Deep-linking into a tab must auto-select the correct rail — don't leave the user on the wrong one.

#### 8b. Home = the operator dashboard
Numbered sections in the Personal OS style. Desktop: three columns. **Mobile: one column, in this
exact order.**

| # | Section | Source |
|---|---|---|
| `01 // OPERATOR` | Name, role, days to December, today's focus, streak | new + existing `streak.ts` |
| `02 // SESSION` | Today's plan | existing `TodaysPlanCard` |
| `03 // HABITS` | Habit grid + % | Phase 4 |
| `04 // CALENDAR` | 7-day strip | Phase 7 |
| `05 // GOALS` | Week + month | Phase 4 |
| `06 // KEY TASKS` | ★ starred, ranked | Phase 3 |
| `07 // LOAD PULSE` | ACWR / training load | existing `TrainingLoadCard` |
| `08 // FUEL` | Rings, macros left | existing `FuelRingCard` |
| `09 // ATTENTION` | Needs-attention list | existing `NeedsAttentionList` |

The capture bar from Phase 2d is pinned above the tab bar, on every page.
Keep the existing coach FAB and panel exactly as they are.

**Gate:** every section renders real data on a 390px viewport with no horizontal scroll and nothing
overlapping the tab bar. Rail switch animates and persists. Deep links resolve to the right rail.

---

### PHASE 9 — Terminal design system (restyle)

**Goal:** the whole app looks like the Personal OS mock, on every screen size.

#### 9a. Tokens and primitives — do this first, in one commit
In `src/app/globals.css`, **extend** the existing `--rtd-*` tokens (do not rename them — hundreds of
usages depend on them):
- Monospace numeral face for every number, stat, time and score. Inter stays for prose.
  Use **JetBrains Mono** (variable `.woff2`, subset to latin + digits). Download it into
  `src/app/fonts/` and wire it through `next/font/local` beside `InterVariable` — self-hosted, no
  Google Fonts network call. Expose it as `--rtd-font-mono` and apply via a `.rtd-mono` utility.
- Panel treatment: `1px` hairline border, near-black translucent fill, **`--rtd-radius-card` drops
  to 4px**, drop shadow removed. Terminal, not iOS.
- Semantic OK / WARN / DANGER mapped onto the existing green / orange / red.
- Section header primitive: `NN // TITLE` in uppercase mono with letter-spacing, a hairline rule to
  the right, and an optional status chip pinned right (`LIVE`, `0/6 · 0%`, `7 ACTIVE`).

New components in `src/components/ui/`:
`TerminalPanel.tsx` · `SectionHeader.tsx` · `DataRow.tsx` · `MonoStat.tsx` · `StatusChip.tsx`.

**Keep** `SlidingPillNav`, `AnimatedNumber`, `ProgressRing`, `Sparkline`, `DotStrip` — restyle them,
don't replace them. The pill animation stays; removing it has been called out before.

#### 9b. Convert tab by tab, one commit each, in this order
`Home → CRM → Train → Swim → Fuel → Analytics → School → Business → Learn → More/Settings → Coach`

For each tab: swap `GlassCard`/`BentoCard` for `TerminalPanel`, convert headings to `SectionHeader`,
route every number through `MonoStat`, verify at 390px and 1440px, commit.

**Constraints while converting:**
- **Nothing is removed.** Every metric, chart, control and piece of copy on a tab must still be
  there afterwards. This is a reskin, not a redesign.
- Charts keep `recharts`; restyle the axes, grid and tooltips to hairline mono.
- Tap targets stay ≥44px even where the visual density increases.
- Preserve every existing animation and page transition.

**Gate per tab:** side-by-side check against the pre-restyle version — same data, same actions, no
console errors, no horizontal scroll at 390px. Ship each tab to prod before starting the next.

---

## 6. DEFINITION OF DONE (whole build)

- [ ] Voice note from Telegram, phone locked, laptop off → correct rows in the DB inside ~5s
- [ ] One capture can write to several tables at once
- [ ] Undo removes exactly what a capture wrote
- [ ] CRM: create, star, reorder, complete, archive — all survive a refresh
- [ ] Business tasks and Canvas assignments visible and starrable in the CRM
- [ ] Habits reset at midnight **Manila**, not UTC
- [ ] Goals never auto-clear
- [ ] Journal: voice → transcript → summary, raw always retrievable
- [ ] Brain answers real questions about the real season, with citations, and says "I don't know"
      when it doesn't
- [ ] Calendar shows Google events + meets + planned sessions
- [ ] Two rails, shared Home, animated switching, deep links land correctly
- [ ] Every one of the 11 surfaces wears the terminal look at 390px and 1440px
- [ ] **Every pre-existing feature still works**: swim science, taper, race plans, critical speed,
      fuel plan, carb periodization, gym progression, e1RM, transfer, analytics, ACWR, coach chat,
      MCP server, Strava, Canvas, exports
- [ ] `npm run lint`, `npx tsc --noEmit`, `npm run build`, `node scripts/smoke.mjs` all green
- [ ] No secret committed anywhere

---

## 7. WHAT NOT TO BUILD

- Anything finance: no net worth, no Google Sheets, no `exceljs`, no finance pulse, no snapshots.
- Multi-user, RLS, or auth beyond the existing single password.
- Demo mode.
- A new coach. The Groq coach stays exactly as it is; it just gains the new tables as context.
- Any change to the Hermes agent. It is a separate system living outside this repo.
- Push notifications (Hermes covers that).
- New dependencies beyond `ical.js`, without asking first.

---

## 8. REPORTING

At the end of every phase, append to `PERSONAL_OS_LOG.md` and reply with:
1. **Files created / modified** (paths).
2. **Gate results** — each check, and whether it passed. Paste real command output; do not
   summarise a build you did not run.
3. **Assumptions** you had to make.
4. **Anything you could not finish**, and exactly why.
5. **The next phase's manual steps** for the user (env vars, Telegram, Google) — surfaced *before*
   they run it, not after.

Do not report a phase as complete unless every gate item actually passed. If something is broken,
say so plainly with the output.
