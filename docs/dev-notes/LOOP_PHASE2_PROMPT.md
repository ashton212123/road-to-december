# LOOP PHASE 2 — execution-only prompt (paste everything below the line into Sonnet 5)

All thinking is done. Do not re-derive, re-decide, or ask. Execute phases in order; each phase ends with the verify-and-ship pipeline, its own `loop N:` commit, and a LOOP_LOG.md entry. Repo: `C:\Users\Ashton\Documents\road-to-december`.

---

## Environment rules (violating these is how past iterations broke)

- **Node PATH:** every shell command that needs node/npm/npx must prepend it: PowerShell `$env:Path = "C:\Program Files\nodejs;" + $env:Path`.
- **Commits:** PowerShell 5.1 mangles here-strings — always `git commit -F <msgfile>` with the message written to a temp file first. End messages with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- **Pipeline per phase:** `npm run lint` → `npm run build` → `node scripts/smoke.mjs` (local, boots :3111) → `npx vercel deploy --prod --yes` → `Start-Sleep -Seconds 20` (alias propagation; smoking too early gives false FAILs) → `$env:SMOKE_BASE_URL="https://road-to-december.vercel.app"; node scripts/smoke.mjs` → phase-specific live assertions (write a throwaway `scripts/verify-*.mjs` that mints a session with jose + AUTH_SESSION_SECRET from .env.local — NEVER print the secret or token — greps live HTML, then delete it).
- **NEVER:** `drizzle-kit push` (crashes: TypeError on CHECK introspection) or `drizzle-kit migrate` (hangs; ledger table doesn't exist). Schema flow is: edit schema.ts → `npx drizzle-kit generate` → apply the generated SQL manually (P1 creates the script for this). No schema changes are needed in this prompt beyond what's already applied.
- **No preview deploys, ever** (previews have no DB env vars — they always error). Prod only, self-verified.
- Never read/print `.env*` values, `mcp-token.txt`, or tokens. Never enter passwords into a browser.
- `redirect()` inside a Suspense boundary streams a 200 (NEXT_REDIRECT in body), not a 307 — assert on stream content, not status.
- Update `BACKLOG.md` (tick/move items) and prepend a `LOOP_LOG.md` entry per phase.

## Current uncommitted state (P1 finishes this — do not redo it)

Already in the working tree, already correct: `learnProgress` table in schema.ts + `getLearnProgress` in queries.ts; `src/lib/data/learn-tracks.ts` (5 tracks, all URLs verified real); `src/app/(app)/learn/actions.ts` (+page.tsx, +[trackId]/page.tsx); `src/components/learn/LearnLevelRow.tsx`; `IconBook`; Learn added to TopBar EXTRA_ITEMS, Home MORE_ROW_ITEMS (grid now cols-5), MoreMenuButton ITEMS, /more LINKS; smoke.mjs has `/learn` + `/learn/python` checks. **The `learn_progress` table + unique index already exist in the production DB** (applied manually; drizzle/0010_clammy_martin_li.sql is the record). Migration ledger is empty by design — do not try to backfill it.

## P1 — Ship the Learn tab (finish the in-flight iteration)

1. Create `scripts/apply-migration.mjs`: takes a filename arg (e.g. `0011_foo.sql`), loads DATABASE_URL via dotenv from .env.local, splits the file on `--> statement-breakpoint`, applies each statement via the `postgres` package (`prepare: false`), logs only the first line of each statement + OK/ERROR, exits 1 on failure. This institutionalizes the manual schema flow. Do NOT run it now (0010 is already applied).
2. Run the full pipeline. Expected new-route checks already in smoke: `/learn` (sentinel "30 Days of Python"), `/learn/python` (sentinel "Day 1").
3. Live assertions: `/learn` shows all 5 track cards with `0/N` chips; `/learn/python` renders 30 rows; `/learn/cyber` renders 11 rows; `/learn/nope` → 404; toggling is NOT asserted live (needs a POST — skip, the unique index + onConflictDoNothing make it idempotent-safe).
4. Commit `loop 8: Learn tab — 5 leveled GitHub tracks with check-off progression`.

## P2 — Learn progression polish + coach hook

1. **Up-next ring:** in `/learn/[trackId]`, the FIRST incomplete level's check-circle gets `outline: 1.5px solid rgba(255,255,255,0.8); outlineOffset: 2px` and its title stays full-white while later incomplete levels' titles drop to `var(--rtd-text-secondary)`. No hard locking — levels stay clickable (it's reference content; locks would only add friction).
2. **Track card "up next" line:** on `/learn`, under the progress bar, one caption line: `Up next: {title — sub}` of the first incomplete level (or `Track complete 🎉` when done === total).
3. **Ask-coach link per level:** in LearnLevelRow, add a small sparkle button (w-7 h-7, same quiet style as the ↗) linking to `/more/coach-ai?q=${encodeURIComponent(`Teach me "${level.sub ?? level.title}" from ${track title}. Explain it simply, then give me one exercise to do tonight.`)}`. Pass the track title down as a prop. The coach page already accepts ?q=.
4. Pipeline + live assertions (up-next markup present; coach-ai href present on /learn/python). Commit `loop 9: Learn progression polish + ask-coach per level`.

## P3 — Improvement matrix: trailing windows (the Monday-morning fix)

Problem: matrix uses calendar-period-to-date, so Monday mornings show "needs more data — log a gym session" even after a Friday session.

1. In `buildImprovementMatrix` (src/lib/analytics/improvementMatrix.ts): the CURRENT window becomes trailing — week period: `today-6 .. today`; month period: `today-27 .. today`. PREVIOUS window is the equal-length block immediately before. `offset` no longer affects the matrix (it still drives the detail charts + sparkline/dot history, which keep using `periodStarts` exactly as today). Implement by computing the two trailing windows inside the builder from `todayISO` + `period`; only `current`, `previous`, `deltaPct`, `progressPct`, and `needsDataHint` switch to them.
2. UI: the matrix card label becomes `Improvement matrix · last {7|28} days vs previous`. PeriodSelector stays where it is (it governs the detail sections).
3. Pipeline + live assertion: fetch `/analytics` and assert the new label text; assert the gym-sessions row does NOT contain "needs more data" (a session was logged Jul 17 — if today is >7 days past that and no new session exists, assert instead that the row RENDERS a numeric 0 current value rather than the hint; pick whichever the data supports by checking `get_training_log` MCP or the page itself first). Commit `loop 10: matrix trailing windows`.

## P4 — Home renders once (kill the double DOM)

Home currently renders every module twice (desktop `.rtd-bento-grid` + mobile `md:hidden` stack) — double hydration on phones.

1. Merge into ONE container: `class="rtd-home-grid"` — in globals.css: below md it's `display:flex; flex-direction:column; gap:10px`; at md+ it becomes the existing 12-col grid (copy `.rtd-bento-grid`'s md rules; leave `.rtd-bento-grid` itself untouched for other pages).
2. Mobile ORDER must be (top→bottom): HeroBand, TodaysPlan, CoachBrief, fuel/stat cluster, NeedsAttention, WeekMap, TrainingLoad, RecentPRs, more-row grid. Desktop order is the current grid order (Hero, Calendar, FuelRing, BW, Consistency, Plan, Brief, Needs, WeekMap, Load, PRs). Reconcile with Tailwind `order-N md:order-none` classes on the children — write the mapping out in the code as comments.
3. The fuel/stat cluster: wrap FuelRingCard + Bodyweight StatCard + Consistency StatCard in a wrapper div that is `grid grid-cols-2 gap-2.5 md:contents` — `md:contents` dissolves it on desktop so the three keep their own col-spans; on mobile it's the compact 2-col cluster (FuelRing spans both: give FuelRingCard `col-span-2 md:col-span-6`).
4. MonthCalendarCard is desktop-only: `hidden md:flex` via its className prop. More-row grid is mobile-only (`md:hidden`, as now).
5. Delete the entire old `md:hidden` mobile stack block. Every module must appear in the page source EXACTLY once.
6. Pipeline + live assertion: `/home` HTML contains exactly ONE occurrence of "Days to NCAA · Dec 4"'s hero marker (`grep -c "137"` is flaky — count occurrences of `Today's plan` label instead: must be 1, was 2). Playwright-free visual check: smoke still green at both breakpoints is acceptance. Commit `loop 11: Home single render`.

## P5 — Typography + PWA polish

1. HeroBand countdown number and readiness word: apply `rtd-big-num` to the big countdown digits (keep existing color/glow); StatCard's `numericValue` display gets `rtd-big-num` at md+ only (mobile keeps 28px per V4 density — implement as `text-[28px] md:text-[44px]` equivalent via the existing class + a md override, not a new scale).
2. PWA audit: manifest.webmanifest must have 192+512 maskable icons and `theme_color`/`background_color` `#000000`; `<meta name="theme-color" content="#000000">` in root layout; confirm `/offline` route still 200s in smoke (add check). If icons are missing from /public, generate solid-black-bg PNGs with the lilac "R2D" wordmark via a tiny node canvas-free script (write raw with sharp? NO new deps — if icons already exist, just verify; if not, SKIP generation, note it in BACKLOG as needs-asset).
3. Pipeline + assertions (manifest fetch: 200 + contains "maskable" if icons existed). Commit `loop 12: type scale + PWA hygiene`.

## P6 — Coach memory (the Hermes-memory ask, no Telegram, no new tables)

Persistent athlete model, zero schema changes — reuses the existing `ai_takeaways` table (date+key unique).

1. New `src/lib/coach/athleteModel.ts`: `getAthleteModel()` returns the newest `ai_takeaways` row with key `athlete-model` (any date); `refreshAthleteModel(ctx)` — called from `getDailyBrief`'s generation path (so it runs at most once/day, piggybacking the existing daily Groq call site): one extra Groq call that takes the previous model text + the same daily context the brief gets, and returns an UPDATED model. Prompt (verbatim): *"You maintain a persistent athlete model for Ashton (63kg swimmer, 200 breast focus, NCAA Dec 4). Merge today's data into the existing model. Keep ONLY durable facts: recurring soreness patterns, exercise preferences/aversions, schedule constraints, nutrition habits, injury history, what motivates him. Drop day-noise. Max 10 bullet lines, max 900 chars total. Output only the bullets."* Store via `onConflictDoNothing` insert with today's date + key `athlete-model` (same pattern as strengthTakeaway).
2. Inject into BOTH `lib/coach/context.ts` (chat) and the daily-brief prompt: a section `ATHLETE MODEL (persistent):\n{model}` when a model exists.
3. Failure handling: Groq error → keep previous model, skip silently (never block the brief).
4. Pipeline (no live HTML assertion possible for prompt internals — assert instead that /home still renders the brief and build is green; add a LOOP_LOG note that first model appears after tomorrow's first brief). Commit `loop 13: persistent coach memory via ai_takeaways`.

## When all six phases are green

Final LOOP_LOG entry summarizing the run, tick everything shipped in BACKLOG.md, `git log --oneline -8` in the report, and list: every live URL to glance at (/learn, /learn/python, /analytics, /home) — no preview links, everything already deployed and self-verified.
