# LOOP_PHASE6_PROMPT.md — "The Sports-Science Rebuild"

> **Execution contract.** You are Sonnet 5. This document was authored by Opus 5 after a full read of the codebase and a grounded literature pass. Execute it loop by loop, in order, without asking questions and without re-planning. Every loop ends in the full ship pipeline. If a loop is already done when you read this, continue from the next one. Standing instruction from the athlete: **"execute all phases now and don't ask me anything."**

---

## 0. What this phase is

Phases 1–5 made the app *look* right and *log* reliably. It is still, underneath, a generic fitness tracker with swimming vocabulary painted on. This phase makes the app's **logic** actually swimming-specific for one athlete:

- 17 y/o male, Philippines, breaststroke specialist + serious 400 IM
- Events: 50/100/200 Breast, 200 IM, 400 IM
- Bests: 30.73 / 1:05.87 / 2:24.83 / 2:10.86 / ~4:47 low
- **Trains SCM, races LCM** — the app currently has no concept of this at all
- 9 swims + 3 lifts per week; Wed/Fri 5–7 AM race-pace; Sat double; Sun heavy gym

Three non-negotiables carried from prior phases, still binding:
1. **Race-only projection math.** Practice times never touch meet projections.
2. **Never fabricate a number.** Missing data renders as "—" plus the reason, never as 0 or an invented estimate.
3. **Truth over polish.** If a metric can't be computed honestly, delete the metric.

New non-negotiable for this phase:
4. **Every claim the app makes must carry its evidence strength.** Where the science is strong, say so. Where it's a coaching convention or an extrapolation, say *that* — in the UI, not just in a code comment.

---

## 1. Scientific audit of the current app — the gaps you are fixing

Read this once. It is the *why* behind every loop. Do not re-derive it.

### G1 — SCM/LCM is completely absent (severity: critical, actively misleading)
`swim_times` has no course column. `computeMeetReadiness` fits one regression through every logged time for an event. The athlete trains SCM and races LCM. SCM times are systematically faster (turns are the fastest part of a breaststroke race, and SCM has twice as many). Mixing them produces a regression slope that is an artifact of which pool he happened to be in, not fitness. **Every projection currently on `/swim?view=meets` is untrustworthy.**

### G2 — No training-intensity classification (severity: critical)
`swim_sessions` stores one subjective `loadRating` 1–10 and a free-text blob. There is no concept of aerobic vs threshold vs VO2 vs race-pace vs speed vs recovery. `computeSessionPacePer100` averages pace across *all* timed intervals in a session — so an EN1 10×100 and an SP1 4×50 get blended into a single meaningless "pace per 100" that the Log view plots as a trend line. That chart is currently noise presented as signal.

### G3 — Distance parsing is wrong and the athlete has hit it (severity: high, reported bug)
`estimateDistanceM` regex-sums `NxD` patterns. When he writes the session and then states "4.5km total", the stated total is ignored and the sum of matched patterns under-counts (~3k). The AI import path (`importSession.ts`) has the same hole: `totalDistanceM` is always `sum(reps × distance)` with no field for a stated total.

### G4 — Training load monitoring is gym-only (severity: high)
`computeDailySessionLoads` reads `workout_logs` exclusively. For a swimmer doing 9 swims and 3 lifts a week, **~75% of his training load is invisible to ACWR, to the Load card, and to the readiness signal.** The load number on Home is currently a lifting number wearing a training-load label.

### G5 — ACWR is presented as an injury-risk traffic light (severity: high, misleading)
`computeReadinessSignals` turns ACWR into a red/yellow/green light with copy like "above 1.5, trim volume." Impellizzeri et al. (2020, *IJSPP*) showed ACWR suffers mathematical coupling (the acute window is inside the chronic window), no established causal link to injury, and poor standalone predictive ability. Presenting it as a risk light is not evidence-based. It must be demoted to a descriptive load-trend readout with no injury claim.

### G6 — Breaststroke technique has zero representation in the logic (severity: high)
`stroke_counts` is captured but only ever displayed. The strongest, most actionable breaststroke finding in the literature is that over a 100 BR, **clean speed falls because stroke length collapses while stroke rate holds** (Coventry thesis; consistent with the Sports Medicine – Open systematic review on elite breaststroke). That means **distance-per-stroke decay across the race is the single most diagnostic number available from data he already logs** — and the app doesn't compute it.

### G7 — Breaststroke kick volume is untracked (severity: high, injury)
73–86% of breaststroke specialists develop breaststroker's knee; risk tracks with breaststroke-kick volume and years of exposure. He does whip-kick sets several times a week and nothing in the app counts them.

### G8 — The 400 IM does not exist in the app's logic (severity: high)
There is no IM split model, no leg-by-leg analysis, no aerobic-support metric, no fatigue-resistance metric. `racePlans.ts` covers 50/100/200 Breast only. His second-priority event is invisible.

### G9 — Static seed data contradicts the database (severity: medium, truth bug)
`data/road_to_december_data.json` hardcodes `PB_ROWS` (50 BR "30.46", 200 BR "2:24.53", 200 IM "2:10.87") which disagree with the athlete's stated bests (30.73 / 2:24.83 / 2:10.86) *and* with whatever is in `swim_times`. `SPLIT_BARS` shows 28/31/34/37 = 130s, which is a **200 IM** split shape rendered inside a breaststroke narrative. The Analysis view presents both as fact.

### G10 — Fuel plan is a fixed band with a cliff (severity: medium — the athlete asked about this directly)
`computeKcalTarget` returns a hardcoded 3300–3500 until 2026-08-30, then returns *the same numbers* plus a nag banner. Answer to his question "will my fuel plan change automatically when my bulk phase is gone?" — **no, it will not.** Fat is pinned at 25% of kcal every day, which leaves carbs at ~8.2 g/kg on Monday (full rest) and on Saturday (double session) alike. There is no carb periodization, no per-meal protein distribution target, and the "meal timeline" prescribes six slots the athlete never asked for.

### G11 — Workout tab bugs the athlete hits every session (severity: high, reported)
- `handleAddSet` calls `onRestStarted` unconditionally — **the rest timer restarts after the final prescribed set of 3×8 and keeps counting.**
- Auto-dismiss only fires when `restSecondsPrescribed` is non-null; with no prescribed rest, `targetSec` is null and the pill **never auto-dismisses**.
- Nothing stops a 4th set being logged against a 3-set prescription.
- The add-set grid has three inputs (weight / reps / RPE). He wants two.
- No indication of *which week of which phase* he is in.

### G12 — Session RPE is inferred from timestamps (severity: medium)
`computeDailySessionLoads` derives "duration" from the spread between first and last set `createdAt` and averages per-set RPE. That is a proxy for a proxy. Foster's session-RPE method wants **one whole-session RPE, collected ~30 min post-session, multiplied by actual duration.**

---

## 2. Evidence base — cite these, with these strength labels

Every user-facing scientific claim must carry one of: **[strong]**, **[moderate]**, **[coaching convention]**, **[extrapolated]**. Put the label in the UI copy where the claim appears. Store the canonical list in `src/lib/swim/evidence.ts` so copy never drifts.

| # | Claim | Strength | Source |
|---|---|---|---|
| E1 | Taper: reduce volume 41–60% over 8–14 days, hold intensity and frequency | **strong** (meta-analysis) | Bosquet et al. 2007, *MSSE* |
| E2 | Over a 100 BR, clean speed falls via loss of stroke length; stroke rate is preserved | **moderate** (single thesis + consistent review) | Coventry thesis; Sports Med Open 2022 systematic review |
| E3 | Breaststroke has the highest intra-cyclic velocity variation and lowest mean velocity of the four strokes | **strong** | Sports Med Open 2022 systematic review |
| E4 | Breaststroker's knee affects 73–86% of specialists; risk tracks breaststroke-kick volume and exposure years | **moderate** (observational) | Breaststroker's knee epidemiology; Mayo Clin Proc swimming injuries |
| E5 | ACWR has mathematical coupling, no demonstrated causal link to injury, poor standalone prediction | **strong** (methodological critique) | Impellizzeri et al. 2020, *IJSPP* 15(6):907 |
| E6 | Critical swim speed approximates MLSS and is a usable threshold anchor | **moderate** — **validated in front crawl only; breaststroke application is [extrapolated]** | Wakayoshi et al. 1992/1993 |
| E7 | Combined dryland + in-water beats either alone for 25/50/100 m, stroke rate and stroke length | **moderate** (network meta-analysis) | Front Physiol 2025 two-tier NMA |
| E8 | Plyometrics 2–4×/wk, 20–25 min, 6–10 wks improves turn performance | **moderate** (systematic review) | IJERPH 2021 dryland-and-turns review |
| E9 | Carbohydrate 5–12 g/kg/day; 8–10 g/kg for >12 h/wk moderate-to-high training | **strong** (consensus) | IOC / contemporary CHO reviews |
| E10 | Protein 1.2–2.1 g/kg/d for athletes; youth ~1.5 g/kg; distribute ~0.3 g/kg × 4–5 feedings | **strong** (consensus) | IOC consensus; youth-athlete nutrition reviews |
| E11 | SCM→LCM conversion is event- and stroke-specific and is an estimate, not a measurement | **coaching convention** | Standard federation conversion tables |
| E12 | 7-zone energy classification (REC/EN1–3/SP1–3) is a coaching framework; boundaries are conventions, not measured thresholds | **coaching convention** | USA Swimming energy zones |
| E13 | For maximal efforts of ~4–5 min, aerobic contribution is roughly 75–85% | **moderate**, **[extrapolated]** to 400 IM specifically | AOD literature on comparable-duration efforts |

**Rule:** never present E6, E11, or E13 without its qualifier visible in the UI.

---

## 3. Global constraints (violating these is how prior loops broke)

- **Node PATH.** Every shell call needing node/npm/npx must prepend it.
  Bash: `export PATH="/c/Program Files/nodejs:$PATH"`. PowerShell: `$env:Path = "C:\Program Files\nodejs;" + $env:Path`.
- **Schema changes ARE authorized this phase** (the first phase where they are). Procedure, exactly: edit `src/lib/db/schema.ts` → `npx drizzle-kit generate` → `node scripts/apply-migration.mjs <generated>.sql`. Never `drizzle-kit push`, never `drizzle-kit migrate` — both are broken on this machine.
- **All new columns are nullable or have defaults.** Existing rows must keep working with zero backfill required. Any backfill is a separate, idempotent, committed one-off script following `scripts/backfill-swim-pbs.mjs` exactly (dotenv → `postgres(url, {prepare:false, max:1})` → guard → print counts).
- **No new npm dependencies.** Motion stays CSS + direct DOM style mutation.
- **DB pool is `max: 3`.** Any path firing >3 concurrent queries must batch into one round trip (see `lib/db/analyticsQuery.ts`) or wrap each in `lib/db/withFallback.ts`. A 9-way `Promise.all` hung the coach endpoint past Vercel's 60s cap in loop 25 with no surfaced error.
- **React Compiler strict ESLint.** Never `setState` synchronously in an effect body — only inside a timer/event callback. `Date.now()` / `navigator.vibrate` must be called at the actual JSX-wired handler site, never through an arrow-wrapper prop.
- **AI calls.** All through `lib/ai/groq.ts` (`callGroqChat`, jsonMode). Free tier — **cache anything that would otherwise re-cost per page load.** Per-day one-liners → `ai_takeaways` (date+key unique index). Per-session analysis → stored on the session row, generated once at save time. Never throw; every AI path resolves to `null` and has a non-AI fallback.
- **Commits.** `git commit -F <tmp msgfile>`, one commit per loop, never amend, message ends:
  `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`
- **Full pipeline every loop, no shortcuts:**
  `npm run lint` → `npm run build` → `node scripts/smoke.mjs` → `npx vercel deploy --prod --yes` → wait ~20s → `SMOKE_BASE_URL="https://road-to-december.vercel.app" node scripts/smoke.mjs` → loop-specific live assertions via a throwaway `scripts/verify-*.mjs` (mint the cookie with `jose`'s `SignJWT` + `AUTH_SESSION_SECRET` from `.env.local`; **never print the secret**) → delete the throwaway → commit → append to `BACKLOG.md` + `LOOP_LOG.md`. **No preview deploys, ever.**
- **Live-HTML assertion traps** (all previously hit — check raw HTML before concluding anything is broken):
  - The RSC flight payload duplicates strings backslash-escaped (`\"key\":\"value\"`). Strip backslashes from a *slice* before matching, or search the escaped literal.
  - `&` renders as `&amp;`.
  - The same `href` appears many times per page. Scan every occurrence, not `indexOf`'s first.
  - `BentoCard variant="open"` does **not** emit the string `rtd-open-section` — it only omits `rtd-glass`. Assert via `count("rtd-bento-card h-full") − count("rtd-glass rtd-bento-card h-full")`. Only `GlassCard variant="open"` carries the literal class.

### Design-system facts (do not re-derive)
- `.rtd-glass` = card surface. `.rtd-pill-active` = shared translucent active pill — **never solid white** (called out twice by the athlete).
- `.rtd-open-section` = no bg/border, `padding: 20px 0`, hairline `border-top` only *between* consecutive open-section siblings.
- `SlidingPillNav.tsx` is the one component behind every tab/segmented selector. Items carry `data-pill-key` + `relative z-10`; only the thumb carries `.rtd-pill-active`.
- `HomeHeroBand.tsx` exports `LIGHT_COLOR` / `LIGHT_WORD` — reuse, never redefine the readiness vocabulary.
- `ProgressRing`'s `glow` uses `.rtd-ring-glow-layer`. **Never** reintroduce `filter: drop-shadow` on an animated SVG element.
- Domain colors `--rtd-domain-{train,fuel,swim,recovery}` are used as text/dot/sparkline color — **never as a colored left border on a card** (flagged as an AI-generated-UI tell and removed once already).
- `DeltaChip`/`GapChip` deliberately use `#4ade80`/`#f87171`, distinct from `--rtd-green`/`--rtd-red`. Intentional. Don't "fix" it.

---

## 4. The loops

---

## LOOP 32 — Swim science core library + schema

**Goal:** every downstream loop reads its physiology from one place. No UI in this loop.

### 32.1 — `src/lib/swim/evidence.ts` (create)

Export a frozen record of the E1–E13 table above:

```ts
export type EvidenceStrength = "strong" | "moderate" | "coaching convention" | "extrapolated";
export type EvidenceNote = { id: string; claim: string; strength: EvidenceStrength; source: string; caveat?: string };
export const EVIDENCE: Record<string, EvidenceNote> = { /* E1..E13 */ };
export function evidenceLabel(id: string): string; // e.g. "[strong] Bosquet 2007"
```

Every user-facing scientific string in this phase pulls its label from here.

### 32.2 — `src/lib/swim/course.ts` (create)

```ts
export type Course = "SCM" | "LCM";
export const COURSES: Course[] = ["SCM", "LCM"];

/** Estimated SCM→LCM conversion. Federation tables are event- and stroke-specific
 * and are ESTIMATES, never measurements (EVIDENCE.E11). Returns null for events we
 * don't have a factor for rather than guessing. */
export function scmToLcmMs(event: string, scmMs: number): number | null;
export function lcmToScmMs(event: string, lcmMs: number): number | null;
export function isConvertible(event: string): boolean;
```

Per-event additive offsets over the SCM time (turn-count driven — breaststroke gains the most per turn):
`50 Breast +1.0s`, `100 Breast +2.2s`, `200 Breast +4.5s`, `200 IM +3.5s`, `400 IM +7.0s`. Anything else → `null`.
Every consumer must render conversions with the literal string **"estimated conversion"** adjacent.

### 32.3 — `src/lib/swim/zones.ts` (create)

```ts
export type Zone = "REC" | "EN1" | "EN2" | "EN3" | "SP1" | "SP2" | "SP3" | "TECH";
export type ZoneMeta = { zone: Zone; label: string; purpose: string; whenToUse: string; whenNotToUse: string; color: string };
export const ZONES: Record<Zone, ZoneMeta>;
export type ZoneDistance = Partial<Record<Zone, number>>; // metres per zone
```

Content — this is the copy that ships, write it exactly:

| Zone | label | purpose (physiology) | whenToUse | whenNotToUse |
|---|---|---|---|---|
| REC | Recovery | Blood flow without added metabolic stress; clears the previous session rather than adding to it | Day after a hard SP session; between Sat's double | When you haven't done enough hard work to need recovering from |
| EN1 | Aerobic base | Builds capillary density, mitochondrial volume and stroke economy at sustainable cost — the aerobic floor the 400 IM sits on | The bulk of weekly volume, especially Jul–Sep | As a substitute for quality when a race-pace session was planned |
| EN2 | Threshold | Trains at/near maximal lactate steady state — raises the pace you can hold before lactate accumulates | 1–2×/week; the highest-yield aerobic work for the 400 IM | Twice in one day, or the day before a race-pace session |
| EN3 | VO2 / overload | Maximal aerobic power; short rest, high oxygen demand | Sep–Oct build; 1×/week max | During taper, or when readiness is red |
| SP1 | Race pace | Rehearses the exact velocity and stroke rate you intend to race, under accumulating fatigue | Wed/Fri AM race-pace sessions; the core of Oct–Nov | On tired legs — a slow "race-pace" set rehearses the wrong pace |
| SP2 | Lactate power | Maximal 25–75 m efforts; trains peak power and lactate production | 1–2×/week in speed blocks | In volume blocks with no recovery built around it |
| SP3 | Alactic speed | ≤15 m bursts, starts, breakouts, turns — creatine-phosphate system, full recovery between reps | Year-round, small doses, always fresh | Ever, when fatigued — fatigued speed work trains slow speed |
| TECH | Technique / drill | Motor pattern work at low metabolic cost | Every session, especially before quality | As the *only* content of a session that was supposed to build fitness |

Also export:

```ts
/** Breaststroke-kick metres in a session — the injury-relevant number (EVIDENCE.E4). */
export function breastKickMetres(intervals: SwimSessionInterval[]): number;
```

Count an interval's `reps × distanceM` when `stroke` normalises to breast **and** `note`/`stroke` indicates kick, plus the kick fraction of whole-stroke breaststroke sets (count whole-stroke breast metres at 0.5× weight, documented in-code as a modelling assumption, labelled `[coaching convention]`).

### 32.4 — `src/lib/swim/sessionType.ts` (create)

The AI proposes a zone per interval. **The session's type is then computed deterministically in code, never by the model** — so the same session always classifies the same way and the athlete can audit it.

```ts
export type SessionType = "speed" | "race_pace" | "vo2" | "threshold" | "aerobic" | "recovery" | "technique" | "mixed";
export type SessionClassification = {
  type: SessionType;
  label: string;             // "Race-pace session"
  why: string;               // "1,200m of 3,900m (31%) at SP1 — the largest quality block."
  qualityM: number;          // metres in EN2..SP3
  totalM: number;
  zoneDistance: ZoneDistance;
  supports: ("breaststroke-sprint" | "breaststroke-middle" | "400IM-aerobic" | "400IM-fatigue-resistance" | "recovery")[];
};
export function classifySession(zoneDistance: ZoneDistance, totalM: number): SessionClassification;
```

Precedence (first match wins; percentages are of `totalM`):
1. `SP2+SP3 ≥ 12%` → `speed`
2. `SP1 ≥ 18%` → `race_pace`
3. `EN3 ≥ 18%` → `vo2`
4. `EN2 ≥ 22%` → `threshold`
5. `TECH ≥ 40%` → `technique`
6. `REC ≥ 60%` **and** `totalM < 3000` → `recovery`
7. `EN1 ≥ 50%` → `aerobic`
8. otherwise → `mixed`

`supports` mapping — this is what makes the app answer "why does this session matter for *my* events":
- `speed`, `race_pace` (with breast volume ≥ 40% of quality) → `breaststroke-sprint`
- `race_pace`, `threshold` → `breaststroke-middle`
- `aerobic`, `threshold`, `vo2` → `400IM-aerobic`
- `race_pace`, `vo2` → `400IM-fatigue-resistance`
- `recovery` → `recovery`

Thresholds live in one exported const block with a comment stating they are **[coaching convention]**, tuned to this athlete's 9-swims-a-week schedule, not measured cut-points.

### 32.5 — `src/lib/swim/dps.ts` (create) — the breaststroke technique engine

```ts
export type LengthMetrics = { index: number; splitSec: number; strokes: number; dps: number; strokeRate: number | null };
export type DpsAnalysis = {
  lengths: LengthMetrics[];
  dpsDecayPct: number | null;      // last length vs first, % LOSS (positive = length collapsing)
  rateDeltaPct: number | null;     // last vs first stroke rate
  signature: "length-collapse" | "rate-collapse" | "both" | "held" | "insufficient-data";
  interpretation: string;
};
export function analyzeDps(params: {
  event: string; course: Course; splits: number[]; strokeCounts: number[];
}): DpsAnalysis;
```

- `dps = poolLength / strokes` where `poolLength` is 25 (SCM) or 50 (LCM). **Course-aware — this is why G1 blocks G6.**
- `strokeRate = (strokes / splitSec) × 60` strokes/min.
- `signature`:
  - `dpsDecayPct ≥ 6` and `|rateDeltaPct| < 5` → `length-collapse`
  - `rateDeltaPct ≤ -6` and `dpsDecayPct < 6` → `rate-collapse`
  - both → `both`; neither → `held`
- `interpretation` copy for `length-collapse`, verbatim:
  > "Classic breaststroke fatigue signature: stroke rate held but distance-per-stroke fell {X}%. In a 100 BR, clean speed drops through loss of stroke length, not rate [moderate]. The fix is force reserve and back-half length, not turning the arms over faster."
  For `rate-collapse`:
  > "Stroke rate fell {X}% while length held — this is a pacing/effort-distribution pattern, not a length problem. Check whether the first 50 was overspent."
  For `held`:
  > "Length and rate both held across the swim. On this race, fatigue resistance was not the limiter."
  For `insufficient-data`: state exactly what's missing ("needs stroke counts for all {n} lengths").

Return `signature: "insufficient-data"` whenever `splits.length !== strokeCounts.length` or either is empty. **Never interpolate a missing stroke count.**

### 32.6 — `src/lib/swim/criticalSpeed.ts` (create)

```ts
export type CriticalSpeed = {
  metresPerSec: number; pacePer100Sec: number;
  basis: { shortEvent: string; shortMs: number; longEvent: string; longMs: number; course: Course };
  method: "race-anchored" | "test-set";
  caveat: string;
};
export function computeCriticalSpeed(times: { event: string; timeMs: number; course: Course; isRace: boolean }[]): CriticalSpeed | null;
```

Two-point CS: `CS = (D₂ − D₁) / (T₂ − T₁)`. Prefer 100 BR + 200 BR **from the same course**, race rows only. Return `null` if either is missing — do not fall back across courses, do not mix practice into it.

`caveat` is mandatory and fixed:
> "Critical speed was validated in front crawl against maximal lactate steady state (Wakayoshi 1992) [moderate]. Anchoring it on breaststroke race bests is an extrapolation [extrapolated] — treat this as a self-consistent anchor for tracking change, not a measured lactate threshold."

Also export `zonePaceTargets(cs: CriticalSpeed)` returning suggested per-100 pace bands for EN1/EN2/EN3 as % of CS pace (EN1 108–115%, EN2 98–103%, EN3 93–97% of CS pace-per-100), each tagged `[coaching convention]`.

### 32.7 — `src/lib/swim/imModel.ts` (create) — the 400 IM engine

```ts
export type ImLeg = "fly" | "back" | "breast" | "free";
export type ImSplitModel = {
  event: "200 IM" | "400 IM";
  legs: { leg: ImLeg; targetSec: number; actualSec: number | null; deltaSec: number | null }[];
  totalTargetSec: number;
  strongestLeg: ImLeg | null; weakestLeg: ImLeg | null;
  aerobicNote: string;
};
export function buildImSplitModel(params: {
  event: "200 IM" | "400 IM"; targetTotalMs: number;
  loggedSplits: number[] | null; course: Course;
}): ImSplitModel;
```

Leg distribution for the 400 IM, as fractions of total (`[coaching convention]`, from the standard elite IM split shape — document that in-code):
`fly 0.243`, `back 0.262`, `breast 0.283`, `free 0.212`.
For the 200 IM: `fly 0.232`, `back 0.263`, `breast 0.285`, `free 0.220`.

`aerobicNote`, verbatim:
> "A 400 IM at this level is a ~4½-minute maximal effort, which is roughly 75–85% aerobically supplied [moderate, extrapolated to the 400 IM specifically]. That is why EN1/EN2 volume — not more sprint work — is what moves this event."

If `loggedSplits` is null, `actualSec`/`deltaSec` are null and the UI must say "no logged 400 IM splits yet" rather than showing target-only bars as if they were results.

### 32.8 — Schema migration

Edit `src/lib/db/schema.ts`:

**`swimTimes`** — add:
- `course: text("course").$type<"SCM" | "LCM">()` (nullable)
- `strokeRates: jsonb("stroke_rates").$type<number[]>()` (nullable)
- `notes: text("notes")` (nullable)

**`meets`** — add:
- `course: text("course").$type<"SCM" | "LCM">()` (nullable)

**`swimSessions`** — add:
- `course: text("course").$type<"SCM" | "LCM">()`
- `sessionType: text("session_type")`
- `zoneDistanceM: jsonb("zone_distance_m").$type<Record<string, number>>()`
- `strokeDistanceM: jsonb("stroke_distance_m").$type<Record<string, number>>()`
- `statedTotalDistanceM: integer("stated_total_distance_m")`
- `breastKickM: integer("breast_kick_m")`
- `durationMin: integer("duration_min")`
- `sessionRpe: numeric("session_rpe", { precision: 3, scale: 1 })`
- `aiSummary: text("ai_summary")`
- `aiAnalysis: text("ai_analysis")`

**New table `sessionLoads`** — the unified sRPE store for G4 + G12:
```ts
export const sessionLoads = pgTable("session_loads", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  kind: text("kind").notNull().$type<"gym" | "swim">(),
  sourceId: integer("source_id"),          // swim_sessions.id when kind='swim'; null for gym
  rpe: numeric("rpe", { precision: 3, scale: 1 }).notNull(),
  durationMin: integer("duration_min").notNull(),
  load: integer("load").notNull(),         // rpe × durationMin, stored so it never re-derives differently
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("session_loads_date_kind_source_idx").on(t.date, t.kind, t.sourceId)]);
```

**`settings`** — add:
- `energyPhase: text("energy_phase").notNull().default("gain").$type<"gain" | "maintain" | "sharpen">()`
- `kcalTargetOverride: integer("kcal_target_override")` (nullable — manual escape hatch)
- `poolCourseDefault: text("pool_course_default").notNull().default("SCM").$type<"SCM" | "LCM">()`

Export the new `SessionLoad` type alongside the others.

Generate + apply:
```bash
npx drizzle-kit generate
node scripts/apply-migration.mjs 0011_<generated-name>.sql
```

### 32.9 — Backfill script `scripts/backfill-swim-course.mjs` (create, commit)

Idempotent, following `backfill-swim-pbs.mjs` exactly. For every `swim_times` row with `course IS NULL`:
- `meet_name IS NOT NULL` → `'LCM'` (meets he races are long course)
- otherwise → `'SCM'` (he trains short course)
Print counts per bucket. Guard: skip if zero null-course rows. **Do not touch rows that already have a course.**

Also set `meets.course = 'LCM'` where null.

### 32.10 — Ship
Full pipeline. Live assertion for this loop: `/swim` and `/home` still render (no behaviour change expected yet) and `/analytics?tab=recovery` still renders. This loop is deliberately invisible — verify nothing regressed.

**Commit:** `loop 32: swim science core -- zones, course, DPS, critical speed, IM model, schema`

---

## LOOP 33 — AI-first swim logging (kills the 1–10 grid, fixes the 4.5 km bug)

**Goal:** the athlete describes a session in his own words and the app does the rest. No numeric grids, no regex.

### 33.1 — `src/lib/swim/aiSession.ts` (create; supersedes swim parsing in `lib/train/importSession.ts`)

New Groq call, jsonMode, temperature 0.15. Types:

```ts
export type AiSwimInterval = {
  reps: number; distanceM: number; stroke: string;
  zone: Zone; targetInterval?: string; avgTime?: string;
  isKick: boolean; isPull: boolean; isDrill: boolean; note?: string;
};
export type AiSwimSession = {
  intervals: AiSwimInterval[];
  statedTotalDistanceM: number | null;   // ONLY when the athlete states a total explicitly
  computedTotalDistanceM: number;        // sum(reps × distanceM)
  durationMin: number | null;
  sessionRpe: number | null;             // 1-10, only if he states an effort
  course: Course | null;
  summary: string;                       // one plain sentence, no adjectives
  notable: { event: string; timeMs: number; isRace: boolean }[];
};
export async function parseSwimSession(text: string): Promise<AiSwimSession | null>;
```

**System prompt — ship this text:**

```
You structure a competitive swimmer's description of a training session into JSON. The athlete is a breaststroke and 400 IM specialist who trains in a 25m (SCM) pool and races in 50m (LCM). He describes sessions the way he'd tell a teammate — informally, sometimes out of order, sometimes stating only a total.

Return ONLY a JSON object. No markdown fences, no commentary.

{"intervals":[{"reps":8,"distanceM":50,"stroke":"breast","zone":"SP1","targetInterval":"1:10","avgTime":"38s","isKick":false,"isPull":false,"isDrill":false,"note":null}],
 "statedTotalDistanceM":4500,"durationMin":110,"sessionRpe":7,"course":"SCM",
 "summary":"Race-pace breaststroke session built around 8x50 at goal 100 pace.",
 "notable":[]}

RULES

1. EVERY segment he describes becomes its own interval object — warm-up, drills, kick sets, pull sets, main set, warm-down. If he describes 6 things, return 6 intervals. Never merge, never summarise a segment away.

2. statedTotalDistanceM: set this ONLY when he explicitly states a session total ("4.5km", "did 4500 total", "about 5k"). Convert km to metres. If he never states a total, return null. NEVER compute it yourself — the caller computes the sum separately and compares. This field means "the athlete said this number", nothing else.

3. zone — classify every interval into exactly one of:
   REC  = active recovery, easy swimming, loosen down
   EN1  = aerobic base; long/steady, comfortable, short rest
   EN2  = threshold; sustained hard-but-controlled, "best average", descending sets
   EN3  = VO2/overload; short rest, close to maximal aerobic, gasping
   SP1  = race pace; rehearsing goal race velocity, generous rest
   SP2  = lactate power; maximal 25-75m efforts, long rest
   SP3  = alactic speed; <=15m bursts, starts, breakouts, turns, full recovery
   TECH = drill or technique work at low effort
   When genuinely ambiguous, choose the LOWER-intensity zone. Do not guess upward.

4. Stroke abbreviations: fr/free=freestyle, br/breast=breast, bk/back=backstroke, fl/fly=butterfly, im=IM. Set isKick/isPull/isDrill as booleans; keep the STROKE in the stroke field (a breaststroke kick set is stroke "breast" with isKick true, never stroke "kick").

5. durationMin: only if he states or clearly implies a duration. sessionRpe: 1-10, only if he describes overall effort ("brutal", "easy day", "8/10"). Otherwise null for both. Never invent either.

6. course: "SCM" or "LCM" only if he says which pool. Otherwise null.

7. summary: ONE factual sentence naming the session's main work. No praise, no motivation, no adjectives about how he did.

8. notable: only a real clocked time for a named event that he explicitly states ("time trialled 200 breast 2:25.40"). Set isRace true only if he says it was at a meet. Otherwise return an empty array. Never promote a regular interval into a notable time.
```

Normalisation in code (same defensive shape as `aiMacros.ts`): drop malformed intervals, clamp `zone` to the enum (default `EN1` with a code comment), clamp `sessionRpe` to 1–10, `durationMin` to 20–240.

### 33.2 — The distance-reconciliation fix (G3)

In `aiSession.ts` export:

```ts
export type DistanceReconciliation = {
  finalM: number; source: "stated" | "computed";
  discrepancyPct: number | null; needsReview: boolean; message: string | null;
};
export function reconcileDistance(statedM: number | null, computedM: number): DistanceReconciliation;
```

Logic:
- `statedM === null` → `{ finalM: computedM, source: "computed", discrepancyPct: null, needsReview: false, message: null }`
- otherwise `discrepancyPct = |stated − computed| / stated × 100`
- **`finalM` is always `statedM` when stated.** The athlete's own total wins. This is the bug fix.
- `needsReview = discrepancyPct > 10`, with message:
  > "You said {stated}m; the sets I parsed add up to {computed}m ({pct}% off). Using your stated total — tap a set to fix what I missed."

### 33.3 — `src/components/swim/SwimLogSheet.tsx` (create)

Replaces `SwimLogHero` + `SwimSessionLogger` as the Log view's entry point.

- One textarea, big, autofocused, placeholder: *"How was the session? Describe it however you'd tell a teammate — 'warm up 400, 8x50 breast at 1:10 holding 38, 4.5k total, felt like a 7'"*
- One primary button: **Analyze session**
- On result, a review card showing, in this order:
  1. **Session type chip** from `classifySession` + its `why` line
  2. **Total distance** — big number; if `needsReview`, the reconciliation message in an orange strip *above* it
  3. **Zone bar** — a single horizontal stacked bar of `zoneDistance`, each segment its zone colour, with a metres label; tapping a segment reveals that zone's `purpose` / `whenToUse` / `whenNotToUse` from `ZONES`
  4. **Editable interval rows** (reps / distance / stroke / zone dropdown / avg time) — same edit affordance the existing `ImportSessionButton` swim table already has; reuse its row markup
  5. **Breaststroke kick metres** for the session, with the E4 label, only when > 0
  6. **Session RPE** — if the model didn't extract one, a single row of 1–10 **pills** (not a grid of buttons, not a number input) labelled *"How hard was that, overall?"* with the sub-line *"Rate the whole session, not the hardest set — that's how session load is calculated."*
  7. **Duration** — number input, minutes, pre-filled if extracted
  8. Save button

- Collapsed disclosure at the bottom: *"Log without AI"* → a minimal fallback (distance + duration + RPE only, three fields). This exists solely for when Groq is down. **Delete `SwimSessionLogger.tsx`** and remove its import from `SwimLogHero`; then delete `SwimLogHero.tsx` too and wire `SwimLogSheet` directly into `swim/page.tsx`.

### 33.4 — `src/app/(app)/swim/actions.ts` (create)

```ts
export async function analyzeSwimSessionAction(text: string): Promise<AiSwimSession | null>
export async function saveSwimSessionAction(input: {
  date?: string; intervals: SwimSessionInterval[]; zoneDistanceM: Record<string, number>;
  strokeDistanceM: Record<string, number>; statedTotalDistanceM: number | null;
  finalTotalDistanceM: number; breastKickM: number; sessionType: string;
  durationMin: number; sessionRpe: number; course: Course; setsText: string;
  aiSummary: string | null; notable: { event: string; timeMs: number; isRace: boolean }[];
}): Promise<void>
```

`saveSwimSessionAction` writes the `swim_sessions` row **and** a matching `session_loads` row (`kind: "swim"`, `sourceId: <new session id>`, `load = round(rpe × durationMin)`) in the same action. Use `onConflictDoNothing` against the unique index so a double-submit is a no-op. `loadRating` (the legacy 1–10 column) is kept and set to `round(sessionRpe)` so nothing that still reads it breaks.

Revalidate `/swim`, `/home`, `/analytics`; `updateTag("analytics-data")`, `updateTag("home-data")`.

Extend `SwimSessionInterval` in `schema.ts` with the new optional fields (`zone`, `isKick`, `isPull`, `isDrill`) — all optional so existing stored intervals still typecheck.

### 33.5 — Retire the regex parser
- Delete `src/lib/swim/parseSets.ts` and `estimateDistanceM`.
- `logSwimSessionAction` in `analytics/actions.ts`: remove the `estimateDistanceM` import; the fallback path now takes an explicit `distanceM` argument from the no-AI form.
- Grep for every remaining `estimateDistanceM` / `SwimSessionLogger` / `SwimLogHero` reference and clear them (`QuickLogSheet.tsx` and `ImportSessionButton.tsx` both touch this area — check both).
- `ImportSessionButton` keeps its **gym** path unchanged; strip its swim branch and have it delegate to `SwimLogSheet` when `parseTrainingSession` returns `kind: "swim"`.

### 33.6 — Ship
Live assertions: `/swim` HTML contains the new placeholder text, contains no occurrence of the string `Session load, 1 (easy)`, and contains a zone label from `ZONES`.

**Commit:** `loop 33: AI-first swim logging -- zone classification, stated-total reconciliation, sRPE`

---

## LOOP 34 — Workout tab: the reported bugs + phase-week context

**Goal:** fix everything he named about `/train`, and make gym work legible as *transfer* rather than as lifting for its own sake.

### 34.1 — Rest-timer / set-count bug (G11)

`src/components/train/ExerciseCard.tsx`:
- In `handleAddSet`, compute before the transition:
  ```ts
  const targetSets = exercise.targetSets;
  const isFinalPrescribedSet = targetSets !== null && setNumber >= targetSets;
  ```
- Call `onRestStarted(startedAt)` **only when `!isFinalPrescribedSet`**. When it *is* the final set, call a new prop `onExerciseFinished()` instead.
- When `todaysSets.length >= (targetSets ?? Infinity)`, the button label becomes **"Add extra set"** and a footnote reads *"{n}/{target} prescribed sets done."* Logging beyond target stays possible (he sometimes does) but is never silently implied.

`src/components/train/WorkoutSession.tsx`:
- Add `onExerciseFinished` → sets `activeRest` to `null` and, if not already completed, marks the exercise completed via the existing `handleToggle` path.
- Auto-dismiss fix: change the interval guard to use `const target = activeRest.targetSec ?? 180;` so an exercise with **no prescribed rest still auto-dismisses** at `target + AUTO_DISMISS_PAST_TARGET_SEC`. This is the second half of the "it keeps counting" complaint.
- Keep both `setState` calls inside the interval callback (React Compiler).

### 34.2 — Two inputs, not three (G11)

- Remove the **rpe** input from the add-set grid in `ExerciseCard`. Grid becomes `grid-cols-3` with load (`weight | reps | Add set`) and `grid-cols-2` without (`reps | Add set`).
- `ghostReps` already resolves `targetRepsMax ?? targetRepsMin ?? lastSet?.reps`, and `handleAddSet` already falls back to the ghost when the field is untouched — so **typing only a weight already logs the prescribed reps.** Verify this end-to-end and make it visible: render the resolved ghost reps as a static hint under the grid — *"Logs {n} reps unless you change it."*
- Per-set RPE stays **editable** in the `SetRow` expanded editor (existing history stays meaningful; `progression.ts` still reads `rpe` and must keep working when it's null).
- Session RPE is now collected once, in `SessionCompleteSummary` (34.3).

### 34.3 — Session RPE + unified load

`src/components/train/SessionCompleteSummary.tsx`:
- Add a 1–10 pill row: *"How hard was that session, overall?"* with sub-line *"Rate the whole session about 30 minutes after finishing — that's the window session-RPE was designed for [moderate]."*
- On submit, call a new `logSessionRpeAction({ kind: "gym", rpe, durationMin })` in `train/actions.ts` writing a `session_loads` row (`sourceId: null`, `load = rpe × durationMin`, `durationMin` from the component's existing computed `durationMin`). `onConflictDoNothing` on the unique index.
- Dismissing without rating is allowed — no nag, no fabricated value.

### 34.4 — Phase + week header (G11)

`src/lib/train/phaseWeek.ts` (create):
```ts
export type PhaseWeek = { weekInPhase: number; totalWeeksInPhase: number; label: string; daysRemaining: number };
export function computePhaseWeek(phase: { startDate: string; endDate: string; tag: string; name: string }, todayISO: string): PhaseWeek;
```
`weekInPhase = floor(daysBetween(startDate, today) / 7) + 1`, clamped to `[1, totalWeeks]`. `label` = `"Week 2 of 4 · P2 Muscle + Base"`.

Render it in `src/app/(app)/train/[phaseId]/page.tsx` directly under the existing `SectionLabel`, and in `src/app/(app)/train/page.tsx`. Style: `rtd-micro-label` for "WEEK 2 OF 4", `text-body font-semibold` for the phase name — reuse the existing `SectionLabel` + subtitle pattern, no new card chrome. Add a third line when `phase.isDeload` — *"Deload week — the point is to arrive fresh, not to hit numbers."*

### 34.5 — Transfer classification (E7/E8)

`src/lib/train/transfer.ts` (create):
```ts
export type TransferTarget = "start-and-breakout" | "turn-and-pushoff" | "pullout-force" | "stroke-force" | "trunk-stiffness" | "general-base";
export function classifyTransfer(exerciseName: string, movementPattern: string | null, isExplosive: boolean): { target: TransferTarget; why: string };
```
Deterministic keyword mapping — squat/trap-bar/jump → `start-and-breakout`; box jump/broad jump/plyo → `turn-and-pushoff`; chin-up/pulldown/row → `pullout-force`; press/fly/pullover → `stroke-force`; hollow/plank/pallof/dead bug → `trunk-stiffness`; everything else → `general-base`.

`why` copy, one sentence each, e.g. for `pullout-force`:
> "Vertical pulling loads the same chain that drives the breaststroke pullout — the highest-leverage 3 metres of your 50 and 100 [moderate]."

Render as a small caption under the exercise name in `ExerciseCard` (text only, tertiary colour, **no coloured left border**).

### 34.6 — Ship
Live assertions: `/train/p2` HTML contains `WEEK` and `OF`; `/train/p2?day=tue` contains a transfer `why` substring; grep the rendered add-set grid markup and assert it does **not** contain a third `rtd-micro-label">rpe` inside the add-set block.

**Commit:** `loop 34: workout truth -- rest timer stops at target sets, reps+weight only, session RPE, phase week`

---

## LOOP 35 — Swim session history + per-session AI analysis

**Goal:** "in swim there should be an analytics tab every training sesh and i can go back to every sesh i have."

### 35.1 — `src/lib/swim/sessionAnalysis.ts` (create)

One Groq call **at save time only**, result stored in `swim_sessions.aiAnalysis`. Never regenerated on page load.

```ts
export async function generateSessionAnalysis(input: {
  classification: SessionClassification; zoneDistance: ZoneDistance; totalM: number;
  breastKickM: number; durationMin: number; sessionRpe: number; course: Course;
  intervals: SwimSessionInterval[]; recentSessionTypes: { date: string; type: string }[];
  daysToNextMeet: number | null; criticalSpeed: CriticalSpeed | null;
}): Promise<string | null>;
```

System prompt, ship verbatim:
```
You are a swimming physiologist analysing ONE training session for a 17-year-old breaststroke and 400 IM specialist (bests: 30.73 / 1:05.87 / 2:24.83 LCM breast; 2:10.86 200 IM; ~4:47 400 IM). He trains SCM, races LCM.

Write exactly three short paragraphs, no headings, no bullets, no praise, no motivation.

1. WHAT THIS SESSION WAS: name the physiological system it loaded and why the zone distribution says so. Reference actual metres.
2. WHAT IT DOES FOR HIS EVENTS: connect it specifically to 50/100/200 breaststroke or the 400 IM. Be concrete about mechanism (e.g. threshold work raises the pace sustainable before lactate accumulates, which is what the 400 IM's ~4.5-minute aerobic demand is limited by). If the session does little for his events, say that plainly.
3. WHAT IT MEANS FOR THE NEXT 48 HOURS: given the recent session-type sequence provided, state what should and should not come next, and why physiologically.

Rules: never invent a number not given to you. Never give motivational language. If the data is thin, say which data is missing. If evidence for a claim is weak or mixed, say so in the sentence.
```

Fallback when Groq returns null: a deterministic rule-based paragraph built from `classification.why` + the zone table's `purpose` strings. **The page never shows an empty analysis slot.**

### 35.2 — `src/app/(app)/swim/session/[sessionId]/page.tsx` (create)

Server component. One query for the session + one for the ±7-day context (batch into a single round trip — pool is `max: 3`).

Layout, mobile-first, using `GlassCard variant="open"` sections separated by hairlines:
1. **Header** — date, session-type chip, course badge, duration, RPE, session load (`rpe × min`)
2. **Distance hero** — total metres, oversized (`text-title-1 rtd-nums`), with `statedTotalDistanceM` reconciliation note if they differed
3. **Zone distribution** — the stacked bar + a `MiniBarList` of metres per zone; each row tappable to reveal `purpose` / `whenToUse` / `whenNotToUse`
4. **Stroke distribution** — metres per stroke; breaststroke kick metres called out with the E4 caveat
5. **Pace** — mean pace per 100 **computed per zone, never blended across zones** (this replaces the broken `computeSessionPacePer100`), with CS-relative context when `criticalSpeed` exists
6. **The AI analysis** — three paragraphs, `text-subhead leading-relaxed`
7. **Interval table** — every parsed interval, read-only
8. **Delete session** at the bottom, destructive style

### 35.3 — `src/app/(app)/swim/sessions/page.tsx` (create) — full history

- Grouped by week (Monday), newest first, infinite list capped at 26 weeks.
- Each week header: total metres, session count, **zone distribution as a thin stacked bar**, breaststroke-kick metres.
- Each row: date, session-type chip, metres, duration, load. Whole row is a `Link` to the detail page.
- A `SlidingPillNav` filter across session types (All / Aerobic / Threshold / VO2 / Race pace / Speed / Recovery / Technique) — reuse the shared component, do not build a new selector.

### 35.4 — Rewire `/swim` Log view
- `SwimSessionList` rows become `Link`s to `/swim/session/{id}` and show the session-type chip + metres instead of `load {n}/10`.
- Add "See all sessions →" to `/swim/sessions`.
- **Delete the "Pace per 100 (from imported sessions)" card** and `pacePer100Takeaway`. It blends zones and is the clearest example of a metric that looks scientific and isn't (G2). Replace it with a **zone-distribution-over-8-weeks** stacked bar chart — the honest version of the same question ("what am I actually training?").
- Rewrite `computeSessionPacePer100` in `lib/swim/pace.ts` to `computeZonePacePer100(intervals, zone)` returning per-zone means, and update `buildPacePer100Series` to `buildZonePaceSeries(sessions, zone)` — default the Swim page's trend to `EN2` (threshold pace is the aerobic-fitness signal worth trending) with a zone selector.

### 35.5 — Ship
Live assertions: `/swim/sessions` returns 200 and contains a week header; the newest session's detail route returns 200 and contains all three analysis paragraphs (assert on three occurrences of a paragraph wrapper within the analysis container); `/swim` no longer contains `Pace per 100 (from imported sessions)`.

**Commit:** `loop 35: every swim session is analyzed and browsable -- per-session page, zone history, honest pace`

---

## LOOP 36 — Race truth: course separation, DPS decay, bottlenecks

**Goal:** make the projection math defensible and tell him where his time actually is.

### 36.1 — Course-aware readiness (G1)

`src/lib/swim/readiness.ts`:
- `TimePoint` gains `course: Course | null`.
- `computeMeetReadiness` gains `targetCourse: Course`.
- **Race points are filtered to `p.course === targetCourse`.** Never blend courses in the regression.
- New field on `ReadinessResult`: `convertedSupport: { fromCourse: Course; count: number; note: string } | null` — when there are <2 same-course race points but ≥2 in the other course, compute a *secondary* projection from converted times and return it clearly separated, with:
  > "Only {n} {targetCourse} race{s} on record. This projection uses {other} times converted with a standard estimate [coaching convention] — treat it as indicative, not a prediction."
  The primary `projectedMs` stays `null` in that case. **A converted projection never silently becomes the headline number.**
- `viewModel.ts`: pass `course` through from `swimTimes`, and `targetCourse` from `meets.course ?? "LCM"`.

Everywhere a time is displayed, show the course badge. Add `courseBadge(course)` to `lib/swim/format.ts`.

### 36.2 — DPS + split decay in the Analysis view

`SwimAnalysisView.tsx`:
- Add a **"Where the race is lost"** section driven by `analyzeDps` on the most recent race with complete splits + stroke counts.
- Render per-length: split, strokes, DPS, stroke rate — as a small table, plus the `signature` verdict and its `interpretation` copy.
- When `signature === "insufficient-data"`, render exactly what's missing and a link to `#log-time`. **Never render a partial analysis.**

### 36.3 — Replace static seed data with DB truth (G9)

- Compute `PB_ROWS` from `swim_times` race rows, per event **per course**, in `viewModel.ts` as `pbsByEventAndCourse`.
- Keep `seasonData.PB_ROWS` only as the empty-state fallback, explicitly labelled *"from your program file — no logged race yet for this event"*.
- **Delete `SPLIT_BARS` from the Analysis view entirely.** It is a 200 IM split shape rendered under a breaststroke heading (G9). Replace it with the real `splitAutopsy` bars the app already computes, plus the `RACE_PLANS` deltas already implemented.

### 36.4 — Bottleneck engine

`src/lib/swim/bottlenecks.ts` (create):
```ts
export type Bottleneck = { key: string; title: string; evidence: string; mechanism: string; whatToDo: string; confidence: "high" | "medium" | "low"; dataUsed: string };
export function detectBottlenecks(input: {
  dps: DpsAnalysis | null; splitAutopsy: {...}[]; timeTo15m: {...}[];
  zoneHistory: { weekStart: string; zoneDistance: ZoneDistance; totalM: number }[];
  criticalSpeed: CriticalSpeed | null; imModel: ImSplitModel | null;
  breastKickWeeklyM: { weekStart: string; m: number }[];
}): Bottleneck[];
```

Detectors (each fires only when its data exists; `confidence` reflects sample size — never fire on a single data point at `high`):
1. **Length collapse** — `dps.signature` is `length-collapse` or `both` → force reserve + back-half length; mechanism cites E2.
2. **Overspent first 50** — first-50 split faster than `RACE_PLANS` target by >0.8 s while the last 50 is >1.5 s slow → pacing, not fitness.
3. **Underwater/breakout** — fatigued `time_to_15m` >0.25 s slower than fresh → trunk stiffness + leg drive; cites the athlete's own `DIAGNOSIS_CARDS` finding.
4. **Aerobic under-support for the 400 IM** — 4-week EN1+EN2 share of total volume <45% → cites E13; the 400 IM is aerobically limited and the volume isn't there.
5. **Race-pace deficit** — 4-week SP1 metres <400 within 8 weeks of the target meet → he isn't rehearsing race velocity.
6. **Breaststroke-kick load spike** — this week's breast-kick metres >1.5× the 4-week mean → cites E4, 73–86% prevalence; recommends redistributing kick volume, not stopping it.
7. **IM leg weakness** — largest positive `deltaSec` leg in `buildImSplitModel` → names the leg and what trains it.

Render as a **"Bottlenecks"** section at the top of `/swim?view=analysis`, ordered by confidence then impact. Each is a `GlassCard variant="open"` with title / evidence / mechanism / what-to-do / a `[strength]` tag. Cap at 4 visible with "show all".

### 36.5 — AI swim-time logging

Extend `SwimTimeLogger` with an AI-first path mirroring 33.3: a textarea (*"2:24.83 at the regionals, splits 32.5 36 37 38, 9-10-11-12 strokes"*) → `parseSwimTimeText` in `lib/swim/aiSession.ts` returning `{ event, timeMs, course, meetName, isRace, splits, strokeCounts, notes }`. The existing structured form stays as a disclosure below it. `logSwimTimeAction` gains `course`, `strokeRates`, `notes`.

### 36.6 — Ship
Live assertions: `/swim?view=meets` contains a course badge string (`LCM` or `SCM`) adjacent to a projection; `/swim?view=analysis` contains a bottleneck title and does **not** contain the old `SPLIT_BARS` label strings.

**Commit:** `loop 36: race truth -- course-separated projections, DPS decay, bottleneck engine, AI time logging`

---

## LOOP 37 — Unified training load, honest readiness, taper model

**Goal:** load includes swimming; readiness stops claiming things the evidence doesn't support; the taper is modelled, not a checklist.

### 37.1 — Unified load (G4/G12)

`src/lib/analytics/load.ts`:
- `computeDailySessionLoads` now takes `{ sessionLoads: SessionLoad[]; workoutLogs: ... }` and **sums `session_loads` rows per date** as the primary source.
- Gym sessions with no logged session RPE fall back to the existing timestamp-spread estimate, **flagged** — return `DailySessionLoad = { date, load, sources: ("swim"|"gym")[], estimated: boolean }`.
- Add:
  ```ts
  export function computeWeeklyLoad(daily: DailySessionLoad[]): { weekStart: string; load: number; swimLoad: number; gymLoad: number }[];
  export function computeWeekOverWeekRamp(weekly: ...): { weekStart: string; pctChange: number | null }[];
  ```

### 37.2 — Demote ACWR (G5)

- **Keep** `computeAcwr` (the chart is still descriptively interesting) but **remove it from `computeReadinessSignals` entirely.**
- Rewrite `loadTakeaway` copy to be descriptive only — no "trim volume", no risk framing. New text pattern:
  > "Your last 7 days averaged {acute} load/day against a 28-day average of {chronic}. Acute-to-chronic ratios are widely used but have known statistical problems and no demonstrated causal link to injury [strong critique — Impellizzeri 2020], so this is shown as a description of your last month, not a risk score."
- On the Analytics Load card, add that caveat as a permanent footnote.

### 37.3 — Rebuild readiness signals

`src/lib/rules/readiness.ts` — new signal set, each with an evidence tag:

| Signal | Green | Yellow | Red | Basis |
|---|---|---|---|---|
| Sleep | ≥8 h | 6.5–8 h | <6.5 h | unchanged, `[strong]` |
| CMJ vs 4-wk baseline | ≥ −2% | −2 to −5% | < −5% | neuromuscular fatigue, `[moderate]` — **replaces the current "vs last test" comparison, which is one-sample noise** |
| Soreness | ≤2/5 | 3/5 | ≥4/5 | unchanged, `[coaching convention]` |
| Weekly load ramp | −10% to +15% | +15 to +30% | >+30% | descriptive, `[coaching convention]` — explicitly **not** an injury prediction |
| Breast-kick ramp | <1.3× 4-wk mean | 1.3–1.6× | >1.6× | `[moderate]`, E4 — the only injury-specific signal the evidence supports for him |

Keep the transparent no-composite-score design. `applyTrainingStatusCap` unchanged. Update `HomeHeroBand`'s signal list and `/more/recovery` to the new set. Each signal's detail string must end with its bracketed strength tag.

### 37.4 — Taper model

`src/lib/swim/taper.ts` (create):
```ts
export type TaperPlan = {
  daysOut: number; inTaper: boolean; phase: "pre-taper" | "taper" | "race-week" | "post";
  baselineWeeklyM: number; targetWeeklyM: number; volumeReductionPct: number;
  intensityRule: string; frequencyRule: string; thisWeekActualM: number | null;
  adherence: "on-plan" | "too-much-volume" | "too-little-intensity" | "unknown";
  note: string;
};
export function buildTaperPlan(params: {
  todayISO: string; meetDateISO: string;
  weeklyVolume: { weekStart: string; totalM: number; zoneDistance: ZoneDistance }[];
}): TaperPlan;
```

Implements E1 exactly: baseline = mean weekly metres over the 4 weeks **before** taper start; taper window = 11 days out (mid-point of the 8–14 day evidence band); target volume ramps linearly from baseline to **50% of baseline** (mid-point of 41–60%) by race day; **intensity and frequency held**.

`intensityRule`: *"Hold SP1/SP2 pace and session frequency — only volume comes down. Cutting intensity during taper is what loses the adaptation [strong — Bosquet 2007]."*
`adherence` compares this week's actual metres and quality share against the plan.

Render on `/swim?view=meets` above the readiness card whenever `daysOut ≤ 21`, and replace `TaperChecklist`'s static content on a race-block phase page with this live plan (keep the checklist below it).

### 37.5 — Ship
Live assertions: `/home` contains the new "Breast-kick ramp" signal label; `/analytics?tab=recovery` contains the Impellizzeri caveat substring; `/home` does **not** contain `Acute:chronic ratio` as a readiness signal label.

**Commit:** `loop 37: unified swim+gym load, evidence-honest readiness, Bosquet taper model`

---

## LOOP 38 — Fuel rethink: adaptive targets, carb periodization, Fuel Plan tab

**Goal:** answer his actual question — "will my fuel plan change automatically when my bulk phase is gone?" — with **yes, and here's the plan, and here's why.**

### 38.1 — Verdict on the current plan (put this in `LOOP_LOG.md`, and summarise in the UI)

**Sound:** protein as g/kg × 7-day-average weight; +0.25–0.3 kg/wk gain-rate target; water target; the weight-response readout.
**Not sound:** (a) fixed 3300–3500 kcal band that never adapts; (b) fat pinned at 25% of kcal every day, which leaves carbs at ~8.2 g/kg on a full-rest Monday and on a Saturday double alike; (c) no carb periodization by session demand; (d) the highest-risk fuelling moment in his week (5 AM race-pace, Wed/Fri) is handled by a static banner; (e) no per-meal protein distribution target despite the app already charting protein by meal; (f) prescriptive six-slot meal timeline he never asked for; (g) a hard cliff at Aug 30 that nags instead of transitioning.

### 38.2 — `src/lib/fuel/energyModel.ts` (create)

```ts
export type EnergyPhase = "gain" | "maintain" | "sharpen";
export type EnergyTarget = {
  kcal: number; low: number; high: number;
  phase: EnergyPhase; basis: "weight-response" | "estimate" | "override";
  rationale: string; confidence: "high" | "medium" | "low";
  weightTrendKgPerWk: number | null; targetRateKgPerWk: number;
};
export function computeEnergyTarget(params: {
  todayISO: string; energyPhase: EnergyPhase; kcalTargetOverride: number | null;
  weighIns: { date: string; kg: number }[]; recentKcal: { date: string; kcal: number }[];
}): EnergyTarget;
```

**The controller is the measured weight response, not a TDEE formula.** Individual TDEE estimates carry ~±20% error; his own 14-day weight trend against the phase's target rate is the higher-quality signal.

- Target rates: `gain` +0.28 kg/wk, `maintain` 0.00, `sharpen` −0.20 kg/wk.
- Seed estimate when <14 days of weigh-ins: Schofield 15–18 y male BMR `= 17.686 × kg + 658.2`, × PAL 2.1 (9 swims + 3 lifts ≈ 15–18 h/wk), + phase adjustment (`gain` +350, `maintain` 0, `sharpen` −300). `basis: "estimate"`, `confidence: "low"`, and the UI must say the number will self-correct.
- With ≥14 days: `avgKcal` over the window is the *observed* intake at the *observed* rate. Correct by `(targetRate − observedRate) × 1100 kcal/kg / 7` per day, clamp adjustment to ±400 kcal, round to 25. `basis: "weight-response"`, `confidence` = `high` at ≥21 days, else `medium`.
- `low`/`high` = `kcal ∓ 150`.
- `rationale` names the actual numbers: *"You're gaining 0.12 kg/wk on ~3,380 kcal. Target is 0.28 — that's about +250 kcal/day."*

**Phase auto-advance:** `energyPhase` defaults from the season calendar — `gain` through `seasonData.meta.bulkWindowEnd` (Aug 30), `maintain` from Aug 31 until 21 days before the first target meet, `sharpen` inside that window — unless the athlete has explicitly set it in Settings. **This is the direct answer to his question: the plan transitions on its own, and tells him it did.**

### 38.3 — `src/lib/fuel/carbPeriodization.ts` (create)

```ts
export type DayFuelPlan = {
  dateISO: string; dayDemand: "rest" | "moderate" | "high" | "very-high";
  carbsG: number; carbGPerKg: number; proteinG: number; fatG: number; kcal: number;
  why: string; timing: { when: string; what: string; why: string }[];
};
export function buildDayFuelPlan(params: {
  dateISO: string; bodyweightKg: number; energyTarget: EnergyTarget;
  scheduledSwims: number; scheduledGym: boolean; plannedSessionType: SessionType | null;
}): DayFuelPlan;
```

Carb targets from E9 (5–12 g/kg; 8–10 g/kg for >12 h/wk moderate-to-high training), assigned by day demand:
- `rest` (Mon) → **5 g/kg**
- `moderate` (single swim, or swim + light lift) → **7 g/kg**
- `high` (swim + heavy lift, i.e. Tue/Thu/Sun) → **9 g/kg**
- `very-high` (double session or 5 AM race-pace day, i.e. Wed/Fri/Sat) → **10 g/kg**

Protein: `1.8 g/kg` floor, `2.0 g/kg` in `gain` (within the 1.2–2.1 consensus band, E10). Fat = remaining kcal, **floored at 0.8 g/kg** for hormonal health — this replaces the flat 25% and is what lets carbs move day to day.

`timing` entries generated only for sessions actually scheduled that day, each with a mechanism:
- Wed/Fri pre-5 AM: *"30–60 g easy carbs 30–45 min before. Overnight liver glycogen is low; race-pace work at 5 AM without it means rehearsing race velocity on a fuel state you'll never race in."*
- Post-session (within ~60 min when another session follows the same day): *"~1 g/kg carbs + ~0.3 g/kg protein. Only matters when the next session is <8 h away — on a single-session day, total daily intake is what counts, not the window [moderate]."*
- Sat between doubles: *"Carbs + fluid in the 30–60 min nap window — this is the only real refuelling gap in your week."*

### 38.4 — Fuel Plan tab

Mirror the Train tab's structure (he asked for this explicitly: *"there should be a tab inside there to see my fuel plan js like workout tab"*).

- Add `SlidingPillNav` to `/fuel` with **Today | Plan | History**, `?view=` param, reusing the shared component.
- **Plan view** (`src/components/fuel/FuelPlanView.tsx`):
  1. **Current phase card** — "Gain phase · 36 days left" with the auto-transition date and what changes then
  2. **Energy target** — the number, `basis`, `rationale`, and the weight-trend-vs-target chart
  3. **This week's day-by-day plan** — 7 rows from `buildDayFuelPlan`, each showing day demand, kcal, C/P/F in grams **and g/kg**, expandable to the `why` + `timing`
  4. **Protein distribution** — target of `0.3 g/kg × 4–5 feedings` (E10) with today's actual per-slot bars (reuse the existing `proteinByMealSlot` `MiniBarList`)
  5. **What changes and when** — the phase-transition explainer

### 38.5 — Meal timeline: only what he logged (his request)

In `src/app/(app)/fuel/page.tsx`, both desktop and mobile blocks:
- `mealsWithLogs` → filter to `logged.length > 0`.
- Section renders only when at least one slot has food; otherwise omit it entirely (no empty state, no prescription).
- Rename the section label **"Today's meals"**.
- **Delete the Wed/Fri and Tue/Thu prescriptive banners** from `banners` — that guidance now lives in the Plan tab's `timing`, attached to real days.
- Keep the bulk-window countdown banner but rewrite it to reflect auto-transition: *"Gain phase ends Aug 30 — targets move to maintenance automatically."* Delete the `needsConfirmation` nag entirely.

### 38.6 — Improve the macro AI

`aiMacros.ts` system prompt: replace the hardcoded "63kg" with the live 7-day average weight, and add:
```
Portion realism matters more than precision. When the athlete is vague, assume the LARGER realistic portion for a 17-year-old male training 15+ hours a week — under-estimating a swimmer's intake is the more costly error here. State the assumption you made.
```
Also pass today's remaining macro budget into the user message so the model's `assumptions` can be checked against what's plausible. Keep the existing review-before-save trust pattern — nothing auto-writes.

### 38.7 — Delete/replace
- `computeKcalTarget` → replaced by `computeEnergyTarget`. Update `home/page.tsx` and `fuel/page.tsx` call sites.
- `computeCarbsAndFatTargetG` → replaced by `buildDayFuelPlan`. Delete it.
- Keep `computeProteinTargetG` and `sevenDayAverage`.

### 38.8 — Ship
Live assertions: `/fuel?view=plan` returns 200 and contains a `g/kg` string and the phase-transition copy; `/fuel` contains no `Meal timeline` label; `/fuel` contains no `Race-pace tomorrow-morning reminder`.

**Commit:** `loop 38: adaptive fuel -- weight-response energy target, carb periodization, Fuel Plan tab`

---

## LOOP 39 — Home for the phone, demotions, copy pass, wrap

**Goal:** the athlete's primary device is an iPhone. Judge every decision there first.

### 39.1 — Mobile Home rebuild

Current mobile sequence is 9 modules plus a 6-item link row — too long. New mobile order, above the fold to below:

1. **Hero band** — days to NCAA, phase + **week in phase** (reuse `computePhaseWeek`), readiness word
2. **Three doorway dials** — unchanged (`HomeDoorwayDials`)
3. **Today's plan** — with the *session type* of today's planned swim when known
4. **Needs attention** — promoted above the brief; it is the only actionable module
5. **Coach brief**
6. **Fuel cluster**
7. **Week map**
8. **Training load** — now includes swim (loop 37)
9. **Recent PRs**

Concrete changes in `src/app/(app)/home/page.tsx`:
- `NeedsAttentionList` → `order-4`, brief → `order-5`, fuel cluster → `order-6`, week map → `order-7`, load → `order-8`, PRs → `order-9`. **Leave every `md:order-N` exactly as it is** — desktop is not being reordered.
- Wrap modules 7–9 in a `<details>`-driven "More today" disclosure on mobile only (`md:contents` on the wrapper so desktop is untouched), default closed. This is the single biggest mobile improvement: three fewer scroll-screens.
- Move the 6-item `MORE_ROW_ITEMS` grid **into** `MoreMenuButton`'s sheet and delete it from the page body. It duplicates the sheet already reachable from the header.
- Tighten mobile vertical rhythm: page gap `gap-3` → `gap-2.5`; ensure every module's mobile variant uses `p-3.5` not `p-4`.

### 39.2 — Demotions (his rule: "If a feature does not improve performance, recovery, readiness, or decision-making, remove it or demote it")

- **`/learn`** — move out of `EXTRA_ITEMS` in the desktop `TopBar`; keep it reachable from the More sheet only. It is Python coursework, not performance.
- **`/business`** and **`/school`** — already secondary; leave routes intact, but remove `business` and `school` items from `buildAttentionItems`' output **on days with a scheduled double session** (Wed/Fri/Sat) so the attention list stays training-focused when the training day is hardest.
- **`RecentPRsCard`** — keep (it is performance data) but restrict to swim PRs + CMJ; drop gym e1RM PRs from the mobile list (they're on `/analytics?tab=train`).
- **Delete** `SwimSessionLogger.tsx`, `SwimLogHero.tsx`, `lib/swim/parseSets.ts`, `computeCarbsAndFatTargetG`, `computeKcalTarget`, `pacePer100Takeaway`, and the `SPLIT_BARS` rendering — confirm all are gone with a final grep.

### 39.3 — Copy pass

Sweep every string this phase touched and enforce:
- No motivational language anywhere. Grep for and remove: "you've got this", "keep it up", "crush", "let's go", "amazing", "great job". Check `readinessActionLine`, `dailyBrief`'s system prompt, `SessionCompleteSummary`.
  - `readinessActionLine` rewrite: green → *"Signals are clear — this is a day to take the hard set."*; yellow → *"Train as planned; keep the RPEs honest and don't chase the clock."*; red → *"Reduce intensity, keep frequency. Recovery is the adaptation."*
- Every scientific claim carries its `[strength]` tag from `evidence.ts`.
- Every "why" explains a *mechanism*, not a benefit.
- Update `dailyBrief`'s system prompt to include the athlete's event profile, the current session type sequence, and an explicit ban on motivation.

### 39.4 — Final consistency audit

Write a throwaway `scripts/verify-phase6.mjs` asserting, against **live prod HTML**:
1. `/home` — week-in-phase string present; `Acute:chronic` absent; breast-kick signal present
2. `/train/p2` — `WEEK` + `OF` present; add-set grid has exactly two labelled inputs
3. `/swim` — zone label present; `Pace per 100 (from imported sessions)` absent
4. `/swim/sessions` — 200 + week header
5. `/swim?view=analysis` — bottleneck section present; `SPLIT_BARS` labels absent
6. `/swim?view=meets` — course badge adjacent to projection; taper plan present if within 21 days
7. `/fuel` — `Meal timeline` absent
8. `/fuel?view=plan` — `g/kg` present; phase-transition copy present
9. Every route in `scripts/smoke.mjs`'s `CHECKS` still passes
Then delete the script.

Also **update `scripts/smoke.mjs`'s `CHECKS`** permanently to add `["/swim/sessions", null]` and `["/fuel?view=plan", "g/kg"]`.

### 39.5 — Documentation
- `DECISIONS.md` — one entry per scientific judgment call made in this phase (zone thresholds, IM leg fractions, conversion offsets, the 1100 kcal/kg constant, the 0.5× breast-kick weighting), each with its evidence strength and what would change it.
- `COACH_NOTES.md` — the athlete-facing summary: what the app now measures, what it deliberately refuses to measure, and why.
- `BACKLOG.md` + `LOOP_LOG.md` — per-loop entries plus a phase-6 wrap block.

### 39.6 — Ship
Full pipeline.

**Commit:** `loop 39: mobile home, demotions, evidence-tagged copy, phase 6 wrap`

---

## 5. Definition of done for phase 6

The app can now answer each of these from real logged data, or say precisely why it can't:

- [ ] What type of session did I just do, and what physiological system did it load?
- [ ] Does this session support breaststroke sprint, breaststroke middle-distance, or 400 IM aerobic capacity?
- [ ] How much of my last 4 weeks was aerobic vs threshold vs race pace?
- [ ] Is my 200 breast projection based on LCM races only?
- [ ] Is my back-half fade a stroke-length problem or a pacing problem?
- [ ] How much breaststroke kick have I done this week, and is that a spike?
- [ ] What is my biggest bottleneck right now, and what's the mechanism?
- [ ] How much volume should I cut, starting when, for the next meet?
- [ ] What should I eat tomorrow given tomorrow's session, and what changes when my gain phase ends?
- [ ] Which week of which phase am I in?
- [ ] Which of these numbers are strong evidence and which are coaching convention?

And it no longer claims:
- [ ] That mixed-course times form a trend
- [ ] That a blended-zone pace-per-100 is a fitness signal
- [ ] That ACWR predicts injury
- [ ] That a hardcoded PB table is his current best
- [ ] That the rest timer should still be running after his last set

---

**Execute loop 32 now.**
