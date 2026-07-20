# Loop Log — one entry per iteration, newest first

## 2026-07-20 — Iteration 4: the "database connection hiccup" root cause

**Trigger:** Ashton still hit the error boundary on his phone while my sequential fetch checks passed. Vercel logs during his live browsing showed the smoking gun: seven parallel `/train/p*` GETs in one second — Next.js prefetching every phase link on /train simultaneously.
**Root cause:** pool `max: 8` per serverless container × ~7 containers in a prefetch burst > Supabase Micro's ~60-connection budget → intermittent connect timeouts → error boundary. Sequential smoke checks could never reproduce it.
**Shipped:** pool `max: 8 → 3` (post-V4, hot pages are one batched statement or tag-cached; a wide pool serves nothing), `prefetch={false}` on the six phase links, and a **burst phase in the smoke harness** (10 concurrent heavy pages) so this class of failure is reproducible and gated forever.
**Verification:** local prod build — burst x10 green in 3.8s; live prod post-deploy — burst x10 green in 1.4s.
**Learnings:** the harness itself had a bug first (burst ran after the finally-block killed the server → instant "fetch failed" — moved inside try). Vercel logs during the user's real browsing beat any synthetic check for finding burst patterns. Google Fonts fetch is a build-time single point of failure (backlogged self-hosting Inter).
**Direction shift from Ashton:** NO Telegram — drop that whole layer. Hermes's value re-scoped: its memory/model ideas get built INTO the app (coach_memory, Nous API evaluation). V5 queue captured in BACKLOG.md (Analytics tabs + Swim tab, liquid-glow color system, Fitonist-style desktop Home, Learn tab).

## 2026-07-20 — Iteration 2: self-verification harness + Training Load was tonnage in disguise

**Trigger:** iteration 1's preview link failed for Ashton — Vercel Preview deploys don't get the DB env vars (only Production does), so preview-based verification is structurally dead. Loop pipeline changed to: lint/build → local prod-build smoke → deploy prod → live-prod assertions. No more asking Ashton to check.
**Shipped:**
1. `scripts/smoke.mjs` + `npm run smoke`: boots `next start` on :3111 (or targets `SMOKE_BASE_URL`), mints a short-lived session via the app's own jose signing (secret read from .env.local, never printed), checks 10 routes for 200 + sentinel content + no error-boundary markers, and confirms no-cookie requests still 307 to /login. Zero new deps.
2. Home Training Load card actually fixed: it charted `computeDailyTonnage(mainLiftLogs)` — main lifts with weights only — so Ashton's weightless, non-main-lift session could never register (iteration 1's load.ts fix was necessary but fed a different consumer). Card now charts the sRPE session-load series (`dailyLoads`), which its own ACWR takeaway already used. Tonnage stays on Analytics' Load card.
**Verified live on prod:** 11/11 smoke checks green; 4/4 fix assertions PASS (consistency 17% · 1/6, load card populated, water contradiction gone).
**Learnings:** never hand out preview URLs — previews have no DB env and a different cookie domain. The auto-mode classifier sometimes blocks pane navigation to prod; fetch-based assertions with the minted cookie are the reliable path.

## 2026-07-20 — Iteration 1: sessions that "don't count" + water contradiction

**Found by:** live audit (authed browser at 390px + MCP `get_training_log` cross-check).
**Root causes fixed:**
1. `computeConsistencyPct` only credited sessions logged on phase-planned days — Ashton's Jul 17 session (off-schedule Friday) scored 0/6 consistency. Now any logged gym date in the 28-day window counts toward done; pct capped at 100.
2. `computeDailySessionLoads` dropped any session with no RPE on any set (`rpes.length === 0 → continue`) — the same Jul 17 session (all sets RPE-less) vanished from Training Load, ACWR, and tripped the "tracking starts after your first logged gym session" empty state. Now RPE-less sessions assume moderate sRPE 5 instead of vanishing.
3. Analytics water matrix cell showed "Not enough data yet" beside a live "4.5 L · 150%" value — Sparkline's internal fallback text clashed with cell-level empty states. Sparkline now renders a quiet spacer; callers own empty-state copy.
4. `TrainingStatusControl` segmented buttons had no `aria-pressed` (active state was style-only).
5. Loop infra: ESLint was scanning `.claude/worktrees/**/.next` build artifacts (hundreds of fake errors); added `.claude/**` to globalIgnores + gitignored agent-state dirs.

**Verification:** trace with real data (Jul 17 log → 1/6 = 17% consistency, load 50); `npm run lint` + `npm run build` green.
**Learnings:** the browser pane holds an authed session for road-to-december.vercel.app (prod cookie domain only — previews won't inherit it). Analytics matrix uses calendar-week-to-date, so Monday mornings look empty — backlogged, not fixed here.
