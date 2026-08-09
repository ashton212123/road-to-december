# LOOP PHASE 3 — execution-only prompt (paste everything below the line into Sonnet 5)

All thinking is done. Do not re-derive, re-decide, or ask. Execute phases in order; each phase ends with the verify-and-ship pipeline, its own `loop N:` commit (loops 14–19), and a LOOP_LOG.md entry. Repo: `C:\Users\Ashton\Documents\road-to-december`.

This plan was written AFTER a fresh code audit on 2026-07-21 (post-loop-13). Every "current state" claim below was verified by reading the file named. Where the old BACKLOG contradicted the code, the code won — those stale items are listed in "Backlog corrections" and you close them as already-done, not by re-implementing them.

---

## Environment rules (violating these is how past iterations broke)

- **Node PATH:** every shell command that needs node/npm/npx must prepend it: PowerShell `$env:Path = "C:\Program Files\nodejs;" + $env:Path`.
- **Commits:** PowerShell 5.1 mangles here-strings — always `git commit -F <msgfile>` with the message written to a temp file first. End messages with `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- **Pipeline per phase:** `npm run lint` → `npm run build` → `node scripts/smoke.mjs` (local, boots :3111) → `npx vercel deploy --prod --yes` → `Start-Sleep -Seconds 20` (alias propagation; smoking too early gives false FAILs) → `$env:SMOKE_BASE_URL="https://road-to-december.vercel.app"; node scripts/smoke.mjs` → phase-specific live assertions (throwaway `scripts/verify-*.mjs`, minted session via jose + AUTH_SESSION_SECRET from .env.local — NEVER print the secret or token — grep live HTML, then delete the script).
- **ZERO schema changes this entire run.** If you think you need one, you've misread the plan — stop and re-read. (`scripts/apply-migration.mjs` exists for future runs; do not use it now. NEVER `drizzle-kit push` or `drizzle-kit migrate`.)
- **No preview deploys, ever.** Prod only, self-verified. Never hand the user a preview URL.
- Never read/print `.env*` values, `mcp-token.txt`, or tokens. Never enter passwords into a browser.
- `redirect()`/`notFound()` inside Suspense stream a 200 with the UI in the body — assert on stream content, never on status.
- **Live-HTML assertion trap (bit 3 separate times in phase 2):** App Router responses embed every rendered string TWICE — once as real SSR HTML, once escaped inside the RSC flight payload. Count real-HTML occurrences by anchoring to markup only real HTML has (a literal `</span>` closing tag, a `class="..."` attribute). Also: React splits adjacent text children with `<!-- -->` comment nodes (`{a}/{b}` renders `0<!-- -->/<!-- -->30`). When an assertion fails, fetch the raw HTML and READ it before concluding the app is broken — all three phase-2 "failures" were test-script bugs.
- Update `BACKLOG.md` (tick/move items) and prepend a `LOOP_LOG.md` entry per phase.

## Backlog corrections (close these first, no code needed)

The audit found these BACKLOG items already satisfied by existing code. In P1's BACKLOG update, move them to Done with the note "verified already implemented (phase-3 audit)":

1. **"Fuel meal rows — delete affordance on mobile"** — `MealSlot.tsx` renders an always-visible ✕ with `rtd-tap-target` on every logged item, mobile and desktop, gated only by `readOnly`. Nothing to build.
2. **"Water +500ml verify"** — `QuickLogSheet.tsx` `logWater()` calls `logWaterAction(500)`, shows an inline ✓ for 1.5s, and does NOT close the sheet. Exactly the wished behavior. Nothing to build.
3. **"Import parser: kick/drill/pull excluded from pace"** — mostly done: `lib/swim/pace.ts` `EXCLUDE_MARKERS` already excludes drill/warm-up/warm-down from pace-per-100. Only `"kick"` and `"pull"` are missing from the list — that two-word fix happens in P4. Do not touch the parser/import flow otherwise.
4. **"Analytics month view: offset back past data start"** — deliberately DROPPED, not deferred: the matrix now uses trailing windows (offset-independent, always has data), and each detail chart already renders its own "Needs more data" state. Remove the item with that rationale.

## Non-goals (do not touch, even if tempted)

- No Nous/Hermes model-provider evaluation (needs an external account — stays in backlog).
- No per-card period toggles on Home (Fitonist backlog item — too much data plumbing for this run).
- No Telegram anything. No new npm dependencies. No schema changes. No touching `drizzle-kit`.
- recharts is USED (SwimSection, LoadSection, BodyweightSection, PowerSection) — do not remove it. P6 code-splits it instead.

---

## P1 — Reliability foundation (loop 14)

### 1a. Self-host Inter (kills the Google-Fonts build-time single point of failure)
Current: `src/app/layout.tsx` uses `Inter` from `next/font/google` (`variable: "--font-inter"`). One flaky network at build = failed deploy (it happened in loop 4).
- Download the official variable font: `curl -L -o src/app/fonts/InterVariable.woff2 https://rsms.me/inter/font-files/InterVariable.woff2` (create the folder). Sanity-check the file is >100KB and starts with the `wOF2` magic bytes.
- Replace the google import with `next/font/local`: `const inter = localFont({ src: "./fonts/InterVariable.woff2", variable: "--font-inter", display: "swap" })`. The `className` usage in `<html>` stays identical.
- If the download fails after 2 attempts: SKIP this item entirely (leave google font), note `[blocked: font download failed]` in BACKLOG, and continue — do not hunt for mirror URLs.

### 1b. Coach panel loses chat history (real bug, found in audit)
Current: `/more/coach-ai/page.tsx` server-fetches `getRecentCoachMessages(20)` and passes them in — but `CoachPanel.tsx` (the desktop slide-over) hardcodes `initialMessages={[]}`, so every open starts visually blank even though the DB has full history and the POST route builds prompt history from it. Fix:
- Add a `GET` handler to `src/app/api/coach/chat/route.ts`: returns `Response.json` of `getRecentCoachMessages(20)` mapped to `{role, content}`. Confirm the middleware/proxy protects GET on this path the same as POST (check `src/middleware.ts` or wherever the auth proxy lives; if API routes are covered, nothing more needed — do NOT invent a second auth layer if it's already covered).
- In `CoachPanel.tsx`: on first open, fetch that endpoint into local state (`history`, `historyLoaded`), render `<CoachChat initialMessages={history} ...>` only after the fetch settles (failure → `[]`, current behavior). Keep quick prompts exactly as they are — CoachChat already only shows them when messages are empty.

### 1c. Service worker: bound the runtime cache
Current: `public/sw.js` puts every navigation and API response into `RUNTIME_CACHE` forever — unbounded growth on a daily-driver PWA. After each `cache.put` in the runtime paths, trim: open the cache, `keys()`, and if length > 60 delete oldest entries down to 60 (helper function, both call sites). Bump `CACHE_VERSION` to `"rtd-v2"` so old caches get purged by the existing activate handler.

### Verify & ship P1
Pipeline. Live assertions: `/home` HTML contains `/_next/` font preload for a **local** woff2 (no `fonts.gstatic.com` anywhere in the HTML — grep for `gstatic` must find 0); `GET /api/coach/chat` with minted cookie returns JSON array (assert `Array.isArray`); fetch `/sw.js` live and assert `rtd-v2`. Commit `loop 14: self-hosted Inter + coach panel history + SW cache bound`.

## P2 — Coach reachability + visible memory (loop 15)

The coach is the app's marquee feature and its persistent memory shipped in loop 13 — but on mobile the coach is buried (avatar menu → full page) and the memory is invisible. Fix both.

### 2a. Mobile coach FAB
`CoachPanel.tsx`'s floating trigger is `hidden md:flex`. Add a mobile sibling: a `md:hidden` **Link** to `/more/coach-ai` styled identically (same sparkle icon, same glass circle, w-11 h-11), fixed `right-4`, `bottom: calc(env(safe-area-inset-bottom) + 92px)` (clears the dock), `z-40`, `aria-label="Open coach"`. Desktop behavior unchanged.

### 2b. Coach everywhere the other sections are
Add `{ href: "/more/coach-ai", label: "Coach", icon: "✨" }` to all three lists (they are three separate arrays — phase-2 learned this the hard way):
- `home/page.tsx` `MORE_ROW_ITEMS` → 6 items: change the more-row grid from `grid-cols-5` to `grid-cols-3` (two clean rows, bigger touch targets).
- `MoreMenuButton.tsx` `ITEMS` (put Coach first).
- `/more/page.tsx` `LINKS`.

### 2c. Coach memory card in Settings
`/more/settings/page.tsx`, between the SettingsForm and the MCP card:
- Server-fetch `getAthleteModel()` (from `lib/coach/athleteModel.ts`).
- New `SectionLabel`: "Coach memory". New client component `src/components/more/CoachMemoryEditor.tsx`: shows the model text in a read-only view with an "Edit" button → textarea (maxLength 900) + Save/Cancel. If no model yet: caption "The coach builds a persistent picture of you from your daily logs — the first entry appears after tomorrow's brief." and no editor.
- Save = new server action `updateAthleteModelAction(message: string)` in `more/actions.ts`: trim, cap at 900 chars, reject empty, then `db.insert(aiTakeaways).values({ date: todayManilaISO(), key: "athlete-model", message }).onConflictDoUpdate({ target: [aiTakeaways.date, aiTakeaways.key], set: { message } })`, then `revalidatePath("/more/settings")`. (Newest-dated row wins in `getAthleteModel()`, so a manual edit today immediately becomes the live memory. No schema change — this is the existing table and unique index.)
- Caption under the editor: "Updated daily by the coach. Edits here overwrite today's version."

### 2d. QuickLogSheet keyboard a11y (small)
`QuickLogSheet.tsx`: add an Escape-key listener while open (close, same cleanup pattern CoachPanel uses). Nothing else.

### Verify & ship P2
Pipeline. Live assertions: `/home` HTML contains exactly one `aria-label="Open coach"` FAB link with href `/more/coach-ai` (real-HTML anchored); more-row contains "Coach" and grid is `grid-cols-3`; `/more/settings` contains "Coach memory" (and, since no model row exists yet, the "first entry appears after tomorrow" caption). Commit `loop 15: coach reachable everywhere + memory visible in Settings`.

## P3 — Train: rest timer v2 (loop 16)

Current (audited): `ExerciseCard.tsx` starts a count-UP timer after "Add set" (`restElapsed` local state, under/on-target/over coloring vs `restSecondsPrescribed`). Two real gaps: it counts up (you do the math against target yourself mid-set), and it's invisible the moment the card collapses or you scroll. Checkbox-complete flow doesn't start it (correct — leave that).

- **Lift rest state to the session.** `WorkoutSession.tsx` owns `activeRest: { exerciseId: number; exerciseName: string; startedAt: number; targetSec: number | null } | null`. `ExerciseCard` gets `activeRest` + `onRestStarted(exercise)` props; `handleAddSet` calls `onRestStarted` after a successful log (replacing the local `lastLogAt`/`restElapsed` pair — but KEEP the existing behavior where the next set's `restSeconds` is computed from the previous log time: derive it from `activeRest.startedAt` when `activeRest.exerciseId === exercise.id`).
- **Countdown display.** Where a target exists show `remaining = targetSec - elapsed`: green while >0, at ≤0 flip to `+m:ss over` (orange→red past 1.3× target, matching the current thresholds). No target → count up exactly as today. The inline per-card row keeps living in the expanded card, driven by the lifted state.
- **Sticky RestPill.** New client component rendered by `WorkoutSession` while `activeRest` is non-null: fixed pill, mobile `left-1/2 -translate-x-1/2 bottom-[calc(env(safe-area-inset-bottom)+84px)]`, desktop `md:left-6 md:bottom-6 md:translate-x-0`, `z-40`, glass style; text `{exerciseName} · {m:ss}` (remaining or elapsed per above), tap = dismiss (clears activeRest display but not the restSeconds bookkeeping — keep `startedAt` in a ref for that). Auto-dismiss when a new set is logged (state replaced) or 5 minutes past target.
- **Buzz at zero.** When a countdown crosses 0: `navigator.vibrate?.(200)` (guarded — iOS Safari lacks it, fine) + a one-time CSS pulse on the pill. Static under `prefers-reduced-motion`.
- One tick interval owned by WorkoutSession (1s), not one per card.

### Verify & ship P3
Pipeline (train pages are in smoke + burst already). Live assertion: fetch `/train/p1` — no error boundary, page renders (the timer is interaction-gated so HTML-level assertions are limited; rely on build + lint + smoke). MANUAL sanity hook for the log: note in LOOP_LOG that the pill is interaction-only and was verified by code-path reading. Commit `loop 16: rest timer v2 — countdown, sticky pill, buzz at zero`.

## P4 — Swim: meet readiness on the swim page (loop 17)

The user is a competitive swimmer 136 days from NCAA; `computeMeetReadiness` + meets/events data exist and feed the coach — but `/swim` never shows them.

- **Meet readiness card on `/swim`.** Read `swim/page.tsx` + `lib/swim/viewModel.ts` first to reuse the existing data plumbing (add `getAllMeetsWithEvents()` + swim times to the page's fetch if the view model doesn't already carry them — follow `getCoachAppContext()`'s exact usage of `computeMeetReadiness` in `lib/coach/context.ts` as the reference implementation). Card: label "Meet readiness", one block per upcoming meet (max 2): meet name + `{n}d out` chip, then one row per event: event name, current best (formatted via existing `lib/swim/format.ts` helpers), target time, and the gap styled like a DeltaChip (green when at/under target, red otherwise, `rtd-nums`). No upcoming meets → omit the card entirely (no empty shell). Place it directly under the weekly-volume card. Desktop `/analytics` swim redirect etc. untouched.
- **Pace exclusion completeness:** `lib/swim/pace.ts` `EXCLUDE_MARKERS` — add `"kick"` and `"pull"`. Nothing else in the file changes.
- **Swim empty states get CTAs:** in `SwimTrainingBlock.tsx`, wherever a card renders an empty/no-data state, the message becomes (or gains) a link/button routing to the import affordance on `/swim` (or `/train` import if that's where ImportSessionButton lives on this page — read the page first). Every swim empty state must end in an action, not a dead sentence.

### Verify & ship P4
Pipeline. Live assertions: `/swim` renders "Meet readiness" IF `get_meet_readiness` MCP tool (or a direct fetch of the page) shows an upcoming meet exists — check first with the MCP tool `get_meet_readiness`; if no upcoming meet exists in the DB, assert instead that "Meet readiness" is ABSENT (the no-empty-shell rule) and say which branch ran in LOOP_LOG. Assert "kick" exclusion via a unit-style throwaway node script calling `computeSessionPacePer100` with a kick interval (import the TS via tsx: `npx tsx -e "..."`). Commit `loop 17: meet readiness on /swim + kick/pull pace exclusion`.

## P5 — Readiness honesty + chart glow + empty-state sweep (loop 18)

### 5a. Soreness becomes the 4th readiness signal
Current: `lib/rules/readiness.ts` has exactly three transparent signals (sleep, CMJ trend, ACWR). Soreness logs exist (`soreness_logs`: date, rating 1–5, area) and are ignored by readiness.
- `computeReadinessSignals` gains optional input `recentSoreness: { rating: number; area: string; date: string } | null`. Rules: `null` → NO signal emitted (soreness isn't logged daily; a nag-yellow would train him to ignore the panel). rating ≥4 → red `"{area} soreness {rating}/5 — logged {date}"`; rating 3 → yellow; rating ≤2 → green `"Mild — {area} {rating}/5"`. Label: "Soreness".
- Call sites (there are exactly two — `home/page.tsx` and `/more/recovery/page.tsx`): pass the most recent soreness log if its date is today or yesterday, else null. Home's cached data fetch (`getCachedHomeData`) must add the soreness query (a `getSorenessLogs`-style query exists for the recovery page — find and reuse it; if none exists, add one to `queries.ts` following the existing patterns). The overall readiness derivation (any red→red, any yellow→yellow) picks the new signal up automatically in both places — verify by reading, don't assume.

### 5b. Liquid-glow endpoint dots (the last flat-chart holdouts)
- `ComparisonLine.tsx`: the current series' last non-null point gets a filled circle r=3 in `color` with `filter: drop-shadow(0 0 4px {color})` — the Fitonist glowing-endpoint look. Previous (butter) series: no dot.
- `Sparkline.tsx`: new optional `endDot?: boolean` prop (default false, purely additive): filled circle r=2.5 at the last point, same color, subtle glow. Enable it at exactly two call sites: `StatCard`'s sparkline and `ImprovementMatrix`'s row sparklines.

### 5c. Empty-state CTA sweep
Every empty card must route somewhere actionable. Audited list (verify each, fix where dead):
- `TrainingLoadCard` "Tracking starts after your first logged gym session" → wrap in Link to `/train`.
- `RecentPRsCard` "PRs surface here once a few sessions are logged" → Link to `/train`.
- `StatCard`'s internal "tracking starts after 2+ days of logs" → leave (generic component, no single destination).
- Grep `src` for remaining empty-state strings (`"Not enough"`, `"starts after"`, `"surface here"`, `"no data yet"`, `"Needs more data"`) and for each SECTION-level one (not chart-internal fallbacks), add the obvious logging-surface link. Chart-internal fallbacks (ComparisonLine's "Needs more data") stay as-is.

### Verify & ship P5
Pipeline. Live assertions: `/home` — if a soreness row was logged today/yesterday a "Soreness" signal renders in the hero (check `get_dashboard_summary` / the soreness MCP data first to know which branch; log which one ran), else assert hero still renders its 3 signals; TrainingLoad empty state (if currently empty) contains an `href="/train"`. Commit `loop 18: soreness readiness signal + endpoint glow + empty-state CTAs`.

## P6 — Performance: code-split recharts + wrap-up (loop 19)

### 6a. recharts off the Overview tab
All four recharts sections (`SwimSection`, `LoadSection`, `BodyweightSection`, `PowerSection`) are statically imported by the analytics view, so the Overview tab (matrix + takeaway cards, zero recharts) still ships the whole recharts bundle. Convert those four imports to `next/dynamic` (keep SSR enabled — `dynamic(() => import(...))` with no `ssr:false`; the win is the split chunk only loading when the section renders) with a `loading:` fallback of a card-shaped div (`rtd-glass`, fixed height ~220px). NOTE: `SwimSection` is also used by `/swim` — dynamic-import it there too, same pattern, or leave `/swim` static if the import graph already splits it; decide by reading, state the decision in LOOP_LOG.
- **Measure honestly:** record the `next build` route-size table BEFORE the change (it prints per-route first-load JS) and AFTER, and put both numbers for `/analytics` in LOOP_LOG. If first-load JS for `/analytics` doesn't drop, say so plainly and keep the change only if it's neutral-or-better.

### 6b. Final wrap-up
- Best-effort Lighthouse: `npx lighthouse https://road-to-december.vercel.app/login --preset=desktop --quiet --chrome-flags="--headless"` — login page only (unauthed). If Chrome/lighthouse isn't runnable in this environment within one attempt, skip silently (the build-size numbers above are the real gate).
- BACKLOG: tick everything shipped, apply the four Backlog corrections from the top of this prompt if not already done in P1, add any new debts discovered.
- Final LOOP_LOG entry summarizing loops 14–19 (the phase-2 wrap entry is the format reference).
- Report to the user: `git log --oneline -8`, the before/after `/analytics` bundle numbers, and the live URLs worth a glance: `/home`, `/swim`, `/train/p1`, `/more/settings`, `/analytics`. No preview links — everything already deployed and self-verified.

Commit `loop 19: code-split recharts + phase-3 wrap`.

---

## Current-state cheat sheet (audited 2026-07-21, trust this over memory)

- Train logging: ghost values (weight→progression→last session chain), progression suggestion banners, count-up rest row, session progress bar, completion summary — all exist. P3 only lifts/inverts the timer.
- `MealQuickLog` already takes `recentFoods` (14-day chips via `getRecentFoodChips`) — repeat-meals exists, don't rebuild it.
- `getRecentCoachMessages`/`saveCoachMessage` in `lib/coach/messages.ts`; POST `/api/coach/chat` builds history from DB; only the PANEL's initial render is blank.
- `ai_takeaways` unique index is `(date, key)` — the P2 upsert target.
- Coach chat auto-send via `?q=` exists (`CoachChat` `autoSend` prop) — Learn's ask-coach buttons depend on it; don't regress it when touching CoachChat/CoachPanel.
- Home is single-render (`.rtd-home-grid`, explicit `order-N md:order-M` on every child, `md:contents` fuel cluster). Any new Home child needs BOTH order classes or it lands at the end of both sequences.
- Smoke suite: 18 routes + no-cookie 307 check + 10-route concurrent burst. Add new routes there if you create any (this plan creates none).
- The athlete model's first row appears with the first freshly-generated daily brief after loop-13's deploy — if `getAthleteModel()` returns null during P2, that's expected, not a bug.
