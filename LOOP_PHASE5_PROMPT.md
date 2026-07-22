# LOOP PHASE 5 — execution-only prompt (paste everything below the line into Sonnet 5)

All thinking is done. Do not re-derive, re-decide, or ask. Execute phases in order; each phase ends with the verify-and-ship pipeline, its own `loop N:` commit (loops 26–31), and a LOOP_LOG.md entry. Repo: `C:\Users\Ashton\Documents\road-to-december`.

This plan was written after the athlete's second real day using the app (2026-07-21, evening review on iPhone + TV) and a research pass across their Obsidian vault (`Documents/Ashton OS` — the swim-science notes there are explicitly "the R&D lab for the product"), a Whoop UX teardown, and swim-performance literature. The five headline problems, each traced to a verified root cause:

1. **The app projected a race time from a practice swim.** The athlete logged a 2:56.20 training 200 BR and the meet-readiness card projected 2:57.10 "for NCAA Philippines." Root cause: `computeMeetReadiness` (`lib/swim/readiness.ts`) treats ALL logged times identically — practice and race — and the athlete's real PBs (50 BR 30.46 · 100 BR 1:05.87 · 200 BR **2:24.53** · 200 IM 2:10.87 · 400 IM ~4:47.0, confirmed in both the seed JSON's `PB_ROWS` and the athlete's message) exist only as display strings, never as rows in `swim_times`. Swimming reality (confirmed against coaching literature + the athlete's own vault): practice times do NOT predict race times by any universal formula — tapered/rested race swims are a different regime. The two series must be fully separated.
2. **The fuel ring renders as a blocky red square halo on desktop.** Root cause: `.rtd-ring-glow` (globals.css:426) infinitely animates `filter: drop-shadow` on the SVG stroke — Windows/Chromium promotes a filter region that rasterizes as a visible square. The codebase already documents the correct technique (`.rtd-hero-glow`: pre-blurred gradient layers, "soft stops do the blurring, no filter needed").
3. **Loop 22 fixed pill drift but killed the slide animation.** The athlete wants fluid motion everywhere — animated pill, page transitions, smooth scroll.
4. **"Everything is boxed."** Every section is a bordered GlassCard/BentoCard. Whoop's model (per its design teardowns + the athlete's own PULSE prototype in `Videos/pulse`): a few hero dials that are *doorways to dedicated detail pages*, then open sections divided by whitespace/hairlines — progressive disclosure (score → trend → detail), oversized type, and card chrome only where something is genuinely interactive.
5. **The data is behind reality.** The athlete has done every scheduled gym session since the program started (P1 "Rebuild" 2026-07-06 → 07-19, P2 from 07-20) and eaten to target daily, but couldn't log while the app was being built. Backfill both.

---

## Environment rules (violating these is how past iterations broke)

- **Node PATH:** every shell command that needs node/npm/npx must prepend it: PowerShell `$env:Path = "C:\Program Files\nodejs;" + $env:Path`.
- **Commits:** `git commit -F <msgfile>` with the message in a temp file. End messages with `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- **Pipeline per phase:** `npm run lint` → `npm run build` → `node scripts/smoke.mjs` → `npx vercel deploy --prod --yes` → wait 20s → `$env:SMOKE_BASE_URL="https://road-to-december.vercel.app"; node scripts/smoke.mjs` → phase-specific live assertions (throwaway `scripts/verify-*.mjs`, minted session via jose; NEVER print secrets) → delete throwaways.
- **ZERO schema changes.** The backfills in P2 and PB seeding in P1 are plain INSERTs into existing tables (`workout_logs`, `food_logs`, `swim_times`) — never `drizzle-kit push/migrate`.
- **No new npm dependencies.** All motion is CSS transitions/animations + direct DOM style mutation — NO framer-motion, NO GSAP. If you're tempted, re-read this line.
- **Connection-pool discipline (learned the hard way in loop 25):** the pool is capped at `max: 3` on purpose. Any new code path firing >3 concurrent queries must either batch into one round trip (see `analyticsQuery.ts`) or wrap each in `lib/db/withFallback.ts`. Backfill scripts run queries SEQUENTIALLY — they're one-offs, speed doesn't matter, and they share prod's connection budget.
- **React Compiler strict lint:** no synchronous setState in effect bodies. For the measured sliding pill in P3 this matters specifically: position the thumb by MUTATING ITS STYLE DIRECTLY (`ref.current.style.transform = ...`) inside `useLayoutEffect`/ResizeObserver callbacks — zero setState, zero re-render, compiler-clean by construction.
- **Live-HTML assertion traps** (all hit before): RSC flight payload duplicates strings — anchor to real markup; `&` renders as `&amp;`; substring collisions with other components' headings (check with a browser-less fetch FIRST when an assertion fails, before concluding the app broke); attribute order in serialized HTML ≠ source order.
- Update `BACKLOG.md` and prepend a `LOOP_LOG.md` entry per phase. No preview deploys. Never read/print `.env*` values.

## Facts you need (verified from repo + vault + athlete, do not re-derive)

- **PBs (the truth, from seed `PB_ROWS` + athlete confirmation):** 50 Breast 30.46 · 100 Breast 1:05.87 · 200 Breast 2:24.53 · 200 IM 2:10.87 · 400 IM 4:47.0 (the seed says "4:47 low" — use 4:47.00 and note it's approximate). The vault's Swimming Area note has a stale 2:24.83 for the 200 — the athlete explicitly said 2:24.53; trust 2:24.53.
- **Meet targets already in `meet_events`:** 50 BR 29.78 · 100 BR 1:05.49 · 200 BR 2:23.95 · 200 IM 2:09.96 · 400 IM 4:45.13 (NCAA Philippines, 2026-12-04).
- **Program:** P1 "Rebuild" 2026-07-06 → 2026-07-19 (RPE ≤7, re-entry); P2 "Muscle + Base" 2026-07-20 → 2026-08-30 (65–75% @ RPE 7–8, +2.5–5kg/week). Both phases train **Tue / Thu / Sun**. Sessions+exercises live in the DB (`phases`/`sessions`/`exercises` tables, seeded), with `pct1rmMin/Max`, `rpeMin/Max`, `targetSets`, `targetRepsMin/Max`, `isExplosive` per exercise.
- **1RM anchors (from seed `TARGETS`):** Back squat ~77.5kg ("~75–80"), Trap-bar deadlift 100kg, Weighted chin-up = bodyweight + ~7.5kg. Athlete bodyweight 63kg.
- **Fuel targets:** bulk window 3,300–3,500 kcal (mid 3,400); protein 1.8–2.0 g/kg × 63kg ≈ 113–126g (mid ~119g).
- **Vault race plans (`03 Knowledge/Race Strategy.md` — the athlete wants their own research productized):** 200 BR target shape for 2:20 = **32 / 35 / 36 / 37**, "the most commonly overspent 50 is the first"; 100 BR sub-1:04 shape = **30.5 / 33.5**, known issue = back-half fade; 50 BR = start + pullout are the highest-percentage gains; taper = volume −41–60% over 8–14 days, intensity maintained (Bosquet 2007); the 100 rewards stroke RATE, the 200 rewards stroke LENGTH — near-different skills.
- **Whoop interaction model (from design teardowns):** a small number of hero dials at top, each dial is "a doorway, not a destination" → tapping opens a dedicated detail page; progressive disclosure (single score → 7-day trend → deep detail); oversized primary numbers; one green/yellow/red vocabulary everywhere; detail pages are smooth-scrolling open sections, not card dumps.

## Non-goals (do not touch, even if tempted)

- No schema changes, no new deps, no Telegram, no preview deploys, no MCP-route/Hermes/Strava changes.
- Do NOT invent a composite readiness score (0–100 single number) — the transparent-signals rule stands. A dial may VISUALIZE the share of green signals, labeled as exactly that.
- Do NOT delete the glass aesthetic — "unboxed" means fewer bordered containers, not flat design. Keep the wallpaper glows, hairlines, and blur on floating surfaces.
- Do NOT touch the loop-25 coach tool loop or `withFallback` plumbing except where P1 changes `computeMeetReadiness`'s output shape (the coach context consumes it — update the call site types, keep the data flowing).

---

## P1 — Swim truth: practice ≠ race (loop 26)

The most trust-damaging bug in the app. Two series, two meanings, zero mixing.

### 1a. Seed the real PBs as race times
One-off script `scripts/backfill-swim-pbs.mjs` (postgres-js directly, DATABASE_URL from .env.local, SEQUENTIAL queries, keep the script committed with a header comment "one-off, applied 2026-07-21"):
- Insert into `swim_times`: the 5 PBs above, `date: "2026-05-31"` (pre-season, before the June gap — approximate by design), `meetName: "Pre-season PB"`, `isPb: true`, splits/strokeCounts null.
- Idempotency guard: skip any (event, timeMs) pair that already exists.
- Print inserted count. Run it once against prod.

### 1b. Readiness v2 — race-based projection, practice as its own signal
Rewrite `lib/swim/readiness.ts`:
- New input shape: `loggedTimes: { date, timeMs, isRace: boolean }[]` (caller derives `isRace = isPb || meetName !== null`).
- `currentBestMs` = min over RACE times only. New `practiceBestMs` = min over practice times (null if none).
- Projection (`projectedMs`, `gapToTargetMs`, `trendMsPerWeek`, `confidence`): computed over RACE times only, same regression as today. With <2 race points, `projectedMs = currentBestMs`, confidence "low".
- New `practiceTrendMsPerWeek`: regression slope over practice times (≥3 points, else null). This is a training signal, never a race prediction.
- Update ALL call sites (`lib/swim/viewModel.ts`, `lib/coach/context.ts`, meet-readiness card, SwimHero) to pass the `isRace` flag through. Type errors are your checklist — the build will find every consumer.

### 1c. UI honesty
- `SwimMeetReadinessCard`: each event row = **PB (race best) → target → gap chip computed from race best**. Where practice data exists, a quiet second line: `practice: 2:56.20 · trending −Ns/wk` (omit when no practice times). The gap chip goes back to being meaningful: 200 BR now reads 2:24.53 → 2:23.95 **+0.58**, not +32.
- `SwimHero`: the big number = race PB. Projection line only renders when derived from ≥2 race results, labeled "projected from race results". Practice best is a separate, smaller, clearly-labeled line. Kill any path where a practice time can render under a "PROJECTED" heading.
- `SwimTimeLogger`: add a Practice / Meet segmented toggle (default **Practice**). Practice saves `meetName: null`; Meet reveals the meet-name input. One-line caption: "Practice times track training. Only race results drive meet projections."
- Coach context (`lib/coach/context.ts` upcomingMeets): passes the flag; the coach now sees `raceBest` and `practiceBest` separately — update the JSON keys so the LLM can't conflate them.

### 1d. Race plans from the vault (Analysis view)
New `lib/swim/racePlans.ts` — static constants transcribed from the athlete's own research: per event: target splits (200 BR: [32, 35, 36, 37] for 2:20; 100 BR: [30.5, 33.5] for sub-1:04), a one-line strategy note each (200: "controlled first 50 — the most commonly overspent 50 in the sport; the race is decided in 50s 2–3"; 100: "fast but controlled first 50; the second 50 is the race — hold rate as length decays"; 50: "start + pullout are the highest-percentage gains"), and the two-dial note (100 = rate, 200 = length). Render in the swim **Analysis** view as a "Race plans" open section above the split autopsy: per event, target splits as pills + the strategy line +, when a logged race time has `splits`, actual-vs-plan deltas per 50. No chart library needed — text + existing pill/chip components.

### Verify & ship P1
Pipeline. Live assertions: `/swim?view=meets` HTML contains `2:24.53` (the seeded PB surfacing as current best) and a gap chip in the sub-second range for 200 BR (assert the string `+0.58` OR at minimum the absence of `+32`); contains "Pre-season PB" in recent times; `/swim?view=analysis` contains "Race plans". Commit `loop 26: swim truth — race vs practice separated, PBs seeded, race plans`.

## P2 — Backfill reality + train logic fixes (loop 27)

### 2a. Gym backfill (2026-07-06 → 2026-07-20)
One-off `scripts/backfill-gym-jul2026.mjs` (sequential queries, committed with "applied" header):
- Pull phases/sessions/exercises from the DB. Backfill dates: every Tue/Thu/Sun from 2026-07-06 through 2026-07-20 inclusive → P1: Jul 7, 9, 12, 14, 16, 19 · P2: none before Jul 21 (Jul 20 was Monday — no session). **Skip any date that already has ANY `workout_logs` row** (today Jul 21 has real logs — untouched).
- Per exercise per date, insert `targetSets` sets (fallback 3), `reps = targetRepsMax ?? targetRepsMin ?? 8`.
- **Weights** (store kg; round to 2.5):
  - `isExplosive` or plank/carry-free bodyweight movement → `weightKg: null`.
  - Has `pct1rm`: midpoint% × 1RM anchor — Back squat 77.5 · Trap-bar deadlift 100 · Weighted chin-up 7.5 (added load). But note P1 is technique/re-entry: cap P1 mains at 65% of anchor regardless of pct fields.
  - Otherwise use this table (week-1 values; add +2.5kg on week-2 dates Jul 14/16/19 for the first four listed, per the P1 note "week 2: small load bumps"): Goblet box squat 20 · DB Romanian deadlift 36 (pair total) · Rear-foot split squat 24 (pair total) · ½-kneel landmine press 20 · Trap-bar deadlift (technique) 70 · DB bench press 32 (pair total) · Lat pulldown 45 · Barbell glute bridge 60 · Straight-arm pulldown 25 · Face pull 15 · Pallof press 15 · Suitcase carry 24 · Chin-up (band if needed) null · everything else (tempo push-up, Copenhagen, dead bug, calf/tibialis, slider leg curl, side plank, Y-T-W, Spanish squat iso) null.
  - `rpe`: mains 7.0, accessories 6.5 (P1 caps at 7 — never above). `restSeconds: null`, `notes: null`.
- Print per-date insert counts. Run once. Expected effect: consistency jumps from 29% toward ~100% for the window, training-load charts populate, ACWR baseline starts genuinely building.

### 2b. Food backfill (2026-07-06 → 2026-07-20)
Same script or sibling `scripts/backfill-food-jul2026.mjs`:
- For each date in the window where total logged kcal < 1000 (i.e., effectively unlogged — do NOT top up days with real substantial logs): insert 4 rows into `food_logs` summing to ~3,400 kcal / ~119g protein: breakfast ~900 kcal/30g ("Rice, eggs, chicken tocino + banana"), lunch ~1,000/35 ("Rice, chicken adobo, vegetables"), snack ~500/20 ("Protein shake, oats + peanut butter"), dinner ~1,000/34 ("Rice, grilled bangus/pork, soup"). `source: "manual"`. Vary kcal ±50 per day so charts don't render a suspicious flat line.
- Skip Jul 21 (real logs exist).

### 2c. Bodyweight exercises stop asking for weight
`ExerciseCard.tsx`: derive `isBodyweight = exercise.isExplosive || (resolvedDefaultWeightKg === null && no pct1rm fields && last-session sets have no weight)` — practically: pass a new `hasLoad` boolean from the server page (exercise has pct1rm OR defaultWeightKg OR any historical logged weight). When bodyweight: the Add-set grid drops the weight column (3 cols: reps/rpe/button), SetRow never shows a weight part (already handled by loop 23's formatSetParts), and checkbox-complete logs weight null (already does). A box jump should read as: reps, done. Nothing asks for kg.

### Verify & ship P2
Pipeline. Live assertions: `/home` consistency well above 29% (assert the specific recomputed value after running the script locally against the same math, or at minimum assert `29%` is gone); `/analytics?tab=train` no longer shows the gym-sessions needs-data hint; train page for `/train/p2` HTML contains no weight input for the Box jump card (assert by structure: the box-jump section lacks the kg micro-label — scope the check to the card's markup). Commit `loop 27: backfill Jul 6–20 gym + food, bodyweight exercises drop the weight field`.

## P3 — Fluid motion, drift-proof (loop 28)

The loop-22 fix was right about drift, wrong to lose the slide. Bring back one animated thumb, positioned by MEASUREMENT, not formula — measured position includes gaps, so it cannot drift.

### 3a. `components/ui/SlidingPillNav.tsx`
One client component used by every selector. Contract:
- Renders a relative container; children are the items (Links or buttons, passed via a render-prop or cloned children with refs); plus one absolutely-positioned thumb div styled `.rtd-pill-active` (the glass pill from loop 22 — unchanged visual).
- Positioning: `useLayoutEffect` + `ResizeObserver` on the container; find the active item's `offsetLeft`/`offsetWidth`; set `thumbRef.current.style.transform = translateX(...)` and `.style.width` DIRECTLY (no setState — compiler rule). Transition: `transform 250ms cubic-bezier(0.16,1,0.3,1), width 250ms` — same spring feel as before. First paint: no transition (set, then enable via a data attribute after a frame) so load doesn't animate from 0.
- Active item text stays `#fff`, inactive `var(--rtd-text-secondary)` (items themselves no longer carry `.rtd-pill-active`).
- Reduced-motion: transition none.
- Refactor all five: `SegmentedControl` (this also covers `SwimViewSelector`/`DaySelector`), `AnalyticsTabs`, `PeriodSelector`, mobile `TabBar` dock, desktop `TopBar` nav. For the server-rendered Link selectors, `SlidingPillNav` is the client shell and the Links stay children.

### 3b. Page transitions
`src/app/(app)/template.tsx` (new): `export default function Template({ children }) { return <div className="rtd-page-enter">{children}</div>; }` — templates remount per navigation, so a CSS entry animation runs on every route change. `.rtd-page-enter`: opacity 0→1 + translateY(8px)→0, 240ms, `cubic-bezier(0.22,1,0.36,1)`, reduced-motion-guarded. Remove now-redundant per-page `rtd-fade-in` wrappers where they'd double-animate (grep and sweep).

### 3c. Micro-motion audit
- `html { scroll-behavior: smooth }` under `prefers-reduced-motion: no-preference`.
- Sheets/modals (QuickLogSheet, ImportSessionButton dialog, coach panel): slide-up/slide-in entry (~240ms) if not already animated.
- Interactive rows/buttons missing `active:scale` feedback: sweep Home more-row, matrix rows, swim session list rows.

### Verify & ship P3
Pipeline. Live assertions: `/home` HTML contains the template's `rtd-page-enter` wrapper and the dock contains exactly ONE thumb element (a single `.rtd-pill-active` node per selector, as a sibling of the items rather than on the active item — assert by class occurring once inside the `<nav>` block). Animation itself is client-runtime: verify wiring by code-read, note athlete's phone confirms feel. Commit `loop 28: motion restored — measured sliding pill, page transitions, micro-interactions`.

## P4 — Ring fix + the unboxing (loop 29)

### 4a. Kill the filter-glow artifact
- Delete the `filter: drop-shadow` animation from `.rtd-ring-glow`/`rtd-ring-breathe`. New approach: `ProgressRing` (when `glow`) renders a sibling absolutely-positioned div BEHIND the svg: `border-radius: 50%`, `background: radial-gradient(closest-side, transparent 55%, <glowColor at 30% alpha> 72%, transparent 100%)`, animating only `opacity` 0.6→1 on the same 3.2s breathe (reduced-motion: static). Zero SVG filters anywhere. Same visual intent, artifact-proof, cheaper.
- While in there: `FuelRingCard` legend — the mobile screenshot shows clipped, gapless text ("Protein205," / "Water0.0/3"). Fix the legend rows: proper `gap`, `min-w-0`, value on its own line or `justify-between` row per macro; verify at 375px width.

### 4b. The unboxing — open sections, cards only when earned
New CSS primitive in globals: `.rtd-open-section` — no background, no border, `padding: 20px 0`, separated by `border-top: 0.5px solid var(--rtd-hairline)` between consecutive siblings (`.rtd-open-section + .rtd-open-section`). SectionLabel stays as the section header.
- **Home:** keep chrome ONLY on the hero band (glow) and Today's Plan (interactive checklist). Convert to open sections: coach brief, training load, week map, recent PRs, needs-attention, more-row. Charts run full-bleed to the content edge.
- **Swim (all three views):** weekly volume, month dots, meet readiness, latest session, session list, pace, race plans, PBs → open sections. Loggers/import hero keep their card (interactive surfaces).
- **Fuel:** ring block and macro breakdown open; quick-log card stays a card.
- The bento grid survives on desktop as a LAYOUT (column placement) — what changes is the per-cell chrome. `BentoCard` gains a `variant="open"` (no bg/border/shadow) so desktop keeps its grid without every cell being a box.
- Bigger primary numbers: each open section's headline stat uses the `rtd-big-num` scale.

### Verify & ship P4
Pipeline. Live assertions: `/home` HTML contains `rtd-open-section` (≥4 occurrences) and the ring-glow markup no longer contains `rtd-ring-glow` on an svg circle (the class moves to the div layer — assert `rtd-ring-breathe`/`drop-shadow` gone from the served CSS); `/fuel` loads clean. Visual sign-off needs the athlete's screens (note in LOOP_LOG). Commit `loop 29: filter-free ring glow + open-section design language`.

## P5 — Home becomes Whoop-shaped (loop 30)

Progressive disclosure with what this app actually has (no strain/recovery hardware — don't fake any):

- **Three hero dials** directly under the hero band, each a `Link` (whole dial tappable, `active:scale-95`):
  1. **Readiness** → `/more/recovery`. Ring % = share of green readiness signals (transparently labeled: sub-line "3/4 signals green" — this is NOT a composite score, it's a count made visual). Ring color = green if all green, yellow if any yellow, red if any red. Center: the existing readiness word.
  2. **Fuel** → `/fuel`. Ring = kcal % of target mid, center = kcal remaining (or "+N over"), existing gradient.
  3. **Consistency** → `/train`. Ring = 4-week consistency %, center = the %.
  Dial size ~96–104px mobile, evenly spaced in one row, no card boxes around them — they sit on the wallpaper.
- Order below the dials (mobile): Today's Plan (card) → coach brief (open) → training load (open) → week map (open) → recent PRs (open) → more-row. Desktop bento keeps its grid with the same components.
- Every ring anywhere in the app becomes a doorway: audit remaining `ProgressRing` call sites (water ring on Fuel → stays put, it IS the page; any ring on Analytics tiles links to its tab).
- The 3-color vocabulary check: readiness word, dial colors, gap chips, adherence chips all draw from the same green/yellow-orange/red tokens — sweep for one-off colors in these surfaces and align.

### Verify & ship P5
Pipeline. Live assertions: `/home` HTML has ≥3 `<a` elements wrapping ProgressRing markup (dials as links — assert `href="/more/recovery"`, `href="/fuel"`, `href="/train"` each appearing in a link that contains an svg circle); "signals green" text present. Commit `loop 30: Whoop-shaped home — three doorway dials, progressive disclosure`.

## P6 — Analytics becomes Whoop-shaped + wrap (loop 31)

- **Overview tab = 4 doorway tiles** (Train / Swim / Fuel / Recovery), replacing the takeaway-cards-plus-giant-matrix dump. Each tile (this is the one place NEW light card chrome is allowed — tiles are tappable): domain color accent, ONE oversized headline stat (Train: weekly tonnage or sessions; Swim: 200 BR race-best gap to target; Fuel: 7-day kcal adherence; Recovery: last sleep), a 7-day sparkline, the existing one-line takeaway underneath, chevron → its tab. Whole tile is the Link.
- **Improvement matrix** moves below the tiles as an open section (`.rtd-open-section`, rows separated by hairlines — no bento border), unchanged data/logic.
- **Detail tabs** (train/fuel/recovery): convert each chart card to open sections in the same pass — SectionLabel + full-bleed chart, hairline between sections. Charts/data untouched.
- Check the Overview stays recharts-free (tiles use `Sparkline`, not recharts — keep the loop-19/24 code-split win).

### Verify & ship P6
Pipeline. Live assertions: `/analytics?tab=overview` HTML contains 4 tile links (`href="/analytics?tab=train..."` etc.) and ≥1 `rtd-open-section`; the overview still omits recharts-only markup (reuse the loop-19 `detail-strength` absence check). Commit `loop 31: Whoop-shaped analytics — doorway tiles + open sections + phase-5 wrap`.

Then: prepend the LOOP_LOG.md phase-5 wrap-up entry (loops 26–31 summary, mirroring prior wrap format — include the honest note that backfilled gym/food rows are reconstructions at the athlete's request, inserted 2026-07-21, distinguishable by their created_at timestamp). Report to the user: `git log --oneline -8`, one line per loop, and the live URLs worth a glance on their phone: `/home`, `/swim?view=meets`, `/swim?view=analysis`, `/train/p2`, `/analytics?tab=overview`, `/fuel`. No preview links — everything already deployed and self-verified.
