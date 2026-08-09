# RETHINK — Phase 0

Decisions, not essays. Every claim below is grounded in code I actually read this pass, not guessed. One correction to your brief up front because it changes Phase 1's scope materially — read that first.

---

## Correction to a "verified root cause" — region is already fixed, don't re-break it

Your brief says: *"There is no vercel.json; Vercel functions run in the default US region while Supabase is in Singapore."* That was true, but `DECISIONS.md` (already in this repo, dated 2026-07-18 — yesterday) shows a full investigation already happened and closed differently than your prompt assumes:

- **The database was already migrated.** A new Supabase project (`road-to-december-use1`, `us-east-1`) was created to match Vercel's `iad1`, all data copied row-for-row, production cut over, confirmed working ("its working now" — your words, logged). The old Singapore project is untouched but unused.
- **`vercel.json` region-pinning to `sin1`/`hkg1` was tried three separate times and reverted every time** — it either broke every DB connection outright (100% failure, confirmed via Supabase logs showing the requests never arrived) or, on `hkg1`, worked once then failed 6/6 on a larger sample. Re-adding `{"regions": ["sin1"]}` now would very likely reproduce a dead app, not a fast one.
- **The actual, still-current bottleneck**: Supabase's free "Micro" compute tier (224MB shared_buffers, 60 max connections) under concurrent load — confirmed via `pg_stat_statements` that no individual query is slow (worst real query ~18ms), it's connection-admission contention. You were asked directly whether to pay ~$25/mo to remove this ceiling and **said no, stay free** — that's a standing decision, not a fallback.
- **A real, live bug I just found**: your local `.env.local` still points at the *old* Singapore project (`aws-0-ap-southeast-1...`), not the migrated one. Local dev has been silently running against stale infrastructure since the migration — this is very likely why I personally hit "Something went wrong — database connection hiccup" a few times testing locally these last two sessions. **Fixing this is a one-line env change, not exploratory work**, and it's in Phase 1.

**What this means for Phase 1**: no `vercel.json`. Instead — fix `.env.local` to match production, and put all the performance effort into the N+1/optimistic-UI work below, which is a pure application-layer win that helps *regardless* of compute tier (fewer, cheaper round-trips matter more on a constrained connection ceiling, not less). If you want the Micro-tier ceiling gone too, that's still your $25/mo call whenever you want it — I'm not re-raising it unless you ask.

---

## (a) Pain points, from reading the actual code paths

**Workout page — confirmed, all four of your complaints are real bugs, not vibes:**
- `train/[phaseId]/page.tsx`: `session.exercises.map(async ex => Promise.all([getLastSessionSetsForExercise, getTodaysSetsForExercise]))` — 2 separate DB round-trips per exercise, each pulling up to 60 rows and filtering client-side for one date. 7-exercise session = 14 queries, every render.
- `completeExerciseAction` runs, then `revalidatePath` re-runs the *entire* page (all 14+ queries again) before React re-renders. `ExerciseCard`'s `completed` is `todaysSets.length > 0`, a prop — there is no local state to flip instantly. The checkbox is genuinely inert for the whole round trip. This is the "laggy checkbox" you're feeling, precisely.
- No-weight bug, traced fully: `exercises` table has no prescribed load, only `prescription` (a free-text RPE string like `"3×8 @ RPE 6"` — confirmed in `data/road_to_december_data.json`, this is an RPE-autoregulated program by design, not %1RM-based). On checkbox-complete with no logging history, `defaultWeightKg` is `null`, `completeExerciseAction` inserts `weightKg: null`. Downstream, `bestSetE1RM()` (`e1rm.ts:10`) and `computeWeeklyTonnage`/`computeWeeklyHardSets` (`tonnage.ts:39,53`) both do `if (!log.weightKg) continue` — a checked-off exercise with no weight contributes **zero** e1RM and **zero** tonnage. You checked it; Analytics silently pretends you didn't lift. Confirmed, not assumed.
- `SetRow` edit and `ExerciseCard`'s add-set form always show kg/reps/RPE fields, always visually equal weight to the checkbox — there's no "prescribed, defaults applied, tap to override" hierarchy in the UI at all today.

**Home**: already decent (I redesigned its layout in the last engagement — desktop grid, quick stats, needs-attention). But it's still built from ~11 sequential query groups plus a live-alerts evaluation, and nothing on it is AI-generated — every insight is a hand-written rule (`rules/engine.ts`). No "why," only "what."

**Analytics**: five tabs of real charts (e1RM, tonnage, ACWR, CMJ, swim splits, meet readiness) but zero synthesis — you have to read four charts yourself to answer "am I plateauing." Swim readiness projection is a plain linear regression (documented as such, appropriately labeled "estimate" — that part's honest and fine, keep it).

**AI**: there is no in-app AI today. The entire "AI" surface is an MCP server (`/api/mcp`, 25 tools, solid and comprehensive) that only works if you separately open claude.ai and ask it things there. `more/coach-ai/page.tsx` is a static instructions card, not a chat. This is the single biggest gap versus what you're asking for now — "the AI IS the app" requires a genuinely new, embedded surface, not a redesign of an existing one.

**Nutrition Quick Log**: I rebuilt this last session (Groq AI estimation, portion chips, rethink-with-hint, recent-food chips) — it's already close to the bar you're setting now. Leave it mostly alone; wire it into the new AI context layer instead of rebuilding.

**Business / School**: functional, low-traffic (you use these far less than Train/Fuel by your own account). Not touching structurally — moved into "More" already last session per the 5-tab nav work. No further IA change needed; they're not where your pain is.

**Settings/Recovery/More**: fine as-is, low click-count, not a source of friction per your complaint. Leaving alone.

**Cross-cutting**: zero skeleton loaders anywhere (`loading.tsx` doesn't exist for any route group) — every navigation is either instant (cache hit) or a blank flash. Zero `useOptimistic` usage anywhere in the codebase despite React 19 (already installed) supporting it natively. No motion system beyond the `rtd-fade-in`/`rtd-stagger`/`rtd-pulse` keyframes I added last session — real, but modest; nothing spring-based, no view transitions, no glass-material layering beyond the flat `.rtd-glass` card.

---

## (b) New information architecture

Keeping the 5-tab mobile / 7-item desktop nav (Home, Train, Fuel, Analytics, Business, School, More) — it's not what's broken. Per-screen purpose, restated with intent:

- **Home** — "what do I do right now and how am I trending." One-tap into today's session/swim, readiness, countdowns, streaks, PRs, AI daily brief. Not a link list.
- **Train** — phase/day browsing stays for planning ahead; but the *common case* (today's session) is reachable in one tap from Home without going phase→day first.
- **Fuel** — unchanged shape, gets AI-context wiring only.
- **Analytics** — same five tabs, each gains a one-line computed takeaway at the top, AI-generated where judgment is needed (plateau diagnosis), rule-computed where it's pure math (volume deltas).
- **Coach (new)** — promoted out of More. Full-screen chat, replaces the static `coach-ai` page. This is the "AI is the app" surface.
- **Business / School / More** — unchanged.

---

## (c) Workout-flow redesign

One checkbox is the entire primary interaction, exactly as you specified. Concretely:

1. **New field**: `exercises.defaultWeightKg` (nullable numeric, additive migration — existing logged sets untouched). Backfilled once from the most recent logged top-weight per exercise where history exists; `null` where it doesn't (never fabricated, never nagged).
2. **Fallback chain on checkbox-complete**: `defaultWeightKg` → progression-suggested weight (`suggestNextLoad`, already computes this for P2/wave phases) → last session's top weight → `null`. `null` is a legitimate, permanent, silent outcome — the set logs with no weight and nothing downstream ever treats that as an error state again (see point 4 below). First-time-ever exercises with truly no signal get `null` until you optionally add a weight once; that value then becomes the new `defaultWeightKg` for next time.
3. **One query, not fourteen**: replace the per-exercise `Promise.all` loop with two queries total for the whole session — one `workoutLogs` fetch scoped to `exerciseId IN (...session's exercise ids...)` for "today," one windowed query (or a single `DISTINCT ON` per exercise) for "last session per exercise." Computed once server-side, passed down.
4. **Optimistic checkbox**: `ExerciseCard` becomes the owner of `completed` local state (`useOptimistic` seeded from server props). Tap → instant green + haptic-style scale, fire-and-forget server action, no `revalidatePath` on this path (targeted cache invalidation only where something else genuinely must reflect it — e.g., Home's streak — via a narrower `revalidateTag`, not a full page re-render).
5. **Analytics/Home never see a "no weight" case as absence** — `bestSetE1RM`/tonnage functions get a documented, deliberate decision: sets with `weightKg === null` are excluded from load-based metrics (that's mathematically correct — you can't compute tonnage without a number) **but never surfaced as "you didn't lift."** Completion streaks, "today's session" status, and Home's needs-attention all key off "a workoutLog row exists for today," never off weight presence. This is the actual fix to your complaint: not forcing a fake weight into the math, but making every *other* part of the app stop conflating "no weight logged" with "didn't train."
6. **Today-first entry**: Home's "today's workout" card links straight to `/train/{currentPhaseId}?day={todayKey}` (route already supports the `day` param) — already close, just needs to be the primary Home CTA instead of a secondary line.
7. **Session-complete moment**: when the last exercise in a session flips to completed, a summary card (sets done, tonnage, any PRs vs. last session, streak) — new, small, worth the delight.

---

## (d) AI-coach architecture

- **Keep the MCP server as-is.** It's comprehensive (25 tools) and is how *your own Claude subscription* already acts as a coach today at zero marginal API cost. Nothing here replaces it — it stays reachable from Settings or a footer link on the new Coach page.
- **New, separate surface: in-app Groq chat**, because MCP only works from claude.ai, not inside this app on your phone. Free tier, `llama-3.3-70b-versatile`-class model (I already wired the same engine into Quick Log last session — same pattern, new surface).
- **Context assembly module** (`src/lib/coach/context.ts`, new): one function building a token-budgeted JSON snapshot — goals/countdowns, current phase + today's session, recent training/swim/nutrition/sleep/soreness summaries (not raw rows — pre-aggregated, or the token budget blows out fast), PRs, e1RMs, active alerts. Cached per day (regenerating every keystroke would be wasteful and slow); reused by chat, the daily brief, and Analytics' takeaways.
- **Obsidian**: local sync script (`npm run sync:vault`) reading an explicit include-list from `C:\Users\Ashton\Documents\Ashton OS` — **I need you to name the folders** before I build this (default guess: training/goals/journal-adjacent, excluding anything that reads as private; I will not guess wrong here and silently sync something sensitive). Chunks to a new `knowledge` table (path, modified date, text), simple keyword/title/recency retrieval into the context budget — no embeddings infra, this is the right scale for one user.
- **Chat**: new full-screen route, streaming, persisted history (new `coachMessages` table), a few quick-prompt chips seeded from what's actually true today (not generic placeholders).
- **Daily brief**: generated once per day on first Home load, cached, short and coach-voiced — feeds Home's command-center per (b).

---

## (e) Kill list

- **Static `more/coach-ai` page → deleted**, replaced by the Coach chat route. Its "how to connect MCP" content moves to a collapsed section on Settings, not gone, just not a whole nav destination anymore.
- **The current N+1 workout query pattern → deleted**, replaced by the two-query batch in (c).
- **`completeExerciseAction`'s silent-null-weight-as-if-fine behavior → not deleted, but reclassified**: still inserts `null` when there's truly no signal, but every consumer of that data gets fixed to stop treating it as "nothing happened" (see (c)5). I'm not adding a fake weight to make charts look populated — that would be lying with data, worse than a gap.
- **Nothing else is getting deleted.** Business/School/Settings/Recovery aren't where your pain is, per your own account, and there's no code-level evidence they're broken. Cutting them would be "delete for the sake of looking thorough," which the brief itself warns against.

---

## (f) Assumptions I'm replacing

1. Your prompt's belief that region-pinning is the fix → replaced with: region is already fixed, re-pinning is a proven regression, fix the stale local env instead.
2. "Prescribed weight" as a static program value → replaced with a *learned* per-exercise default that starts from history/progression and updates itself, because this program is intentionally RPE-autoregulated, not %1RM-prescribed — a hardcoded weight in the seed data would contradict the program's own design.
3. "AI bolted on" framing → the MCP surface isn't bolted on, it's a legitimately different (and already good) integration model for when you're on claude.ai; the new Groq chat is additive for when you're in the app itself, not a replacement of working infrastructure.
4. `revalidatePath` as the default mutation pattern → replaced with optimistic local state + targeted background saves for every hot-path interaction (checkboxes, quick logs); `revalidatePath` stays for slow-path/planning actions where a full refresh is fine (e.g., editing a past set's notes).

---

## Open question before I start Phase 1

**Obsidian include-list** — which folders in `Ashton OS` should the coach actually read? I won't guess on this one.

Everything else above I'm confident enough to just execute once you say go.
