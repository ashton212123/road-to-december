# Coach Notes — what this app measures, what it refuses to measure, and why (Phase 6, loops 32-39)

Athlete-facing summary, written so you (or a real coach) can see exactly what the app is confident about, what it's guessing at, and what it deliberately won't pretend to know. Every number in the app either comes straight from something you logged, or carries a `[strong]` / `[moderate]` / `[coaching convention]` / `[extrapolated]` tag saying how solid the science behind it is — see `DECISIONS.md` for the full sourcing on each.

## What it now measures

- **What kind of session you just swam** (`speed` / `race_pace` / `vo2` / `threshold` / `aerobic` / `recovery` / `technique` / `mixed`) — computed deterministically from the zone breakdown you logged, never guessed by the AI, so the same session always classifies the same way.
- **Which of your events a session actually supports** — breaststroke sprint, breaststroke middle-distance, or 400 IM aerobic capacity — derived from that same classification, so "did today's swim help my races" has a real answer instead of a vibe.
- **Where a race is actually being lost** — stroke-length collapse late in a race, an overspent first 50, underwater/breakout fade under fatigue, light aerobic volume for the 400 IM, a breaststroke-kick volume spike, race-pace-rehearsal deficit close to a meet, and the weakest IM leg — each gated by how much data backs it (never "high confidence" off one data point) and silent when the data isn't there yet.
- **Recovery signals**: sleep, CMJ vs. a rolling 4-week baseline (not a single noisy prior test), soreness, weekly training-load ramp, and breast-kick-volume ramp (the one signal with a real injury-mechanism link, E4).
- **Meet readiness** — your current best vs. your target time per event, with a practice-time trend line, never blending SCM and LCM times together.
- **Taper plan** — auto-appears once a meet is inside 21 days, built from the E1-sourced volume-reduction protocol.
- **Fuel targets that adapt to your actual measured weight response** (not a fixed calorie band, not a generic TDEE formula) once you have 14+ days of weigh-ins, plus carbs periodized by that day's real training demand instead of a flat split.

## What it deliberately refuses to measure, and why

- **No ACWR (acute:chronic workload ratio).** The literature (E5) shows it's mathematically self-coupled and has no demonstrated causal link to injury — keeping it in would have looked scientific while being actively misleading. Weekly load ramp is shown instead, labeled explicitly as descriptive, not predictive.
- **No single composite "readiness score."** Sleep, CMJ, soreness, load ramp, and breast-kick ramp are shown as separate signals rather than blended into one number — there's no principled, athlete-validated way to weight them against each other, and a fabricated composite would look precise without meaning anything.
- **No fabricated numbers, ever, for missing data.** A stat with nothing behind it renders `—` with a stated reason (e.g. "log a race with per-50 splits to see this"), never a 0 or an invented placeholder.
- **No motivational filler.** The coach voice (daily brief, readiness lines, session-complete copy) is banned from generic encouragement ("you've got this," "crush it") — every line has to state a fact, a number, or a mechanism instead.
- **No treating estimates as measurements.** SCM→LCM conversion, the IM split shape, and the 7-zone framework are all labeled `[coaching convention]` and are never silently blended into a trend line as if they were logged data.
- **No push notifications / no Canvas submission capability.** Both were explicitly scoped out in earlier phases and remain out — the MCP tool layer (`get_pending_items`, etc.) is the "digest" instead of building a separate notification subsystem, and Canvas access stays read-only by design.

---

# Coach Notes — Evidence Review of the Dryland Program (2026)

Purpose: an outside check of the existing 21-week dryland program (`data/program.md`) against current sports-science literature on strength training for competitive swimmers, done as part of a broader app update. Written to be shown to coaches directly — every claim below is sourced.

## Summary

The existing program was already closely aligned with current evidence on almost every front checked: periodization structure, strength-training modality selection, taper timing, and breaststroke-specific injury prevention. This was not the expected outcome going in — the honest finding is that the program didn't need a rebuild. One concrete, specific gap was found and fixed (below). Everything else in this document is either confirmation of an existing choice (with sourcing, so it's defensible to a coach who asks "why") or a flagged consideration for a real coach to weigh in on, not something changed unilaterally.

## What was checked, and against what evidence

### 1. Strength training modality selection (which type of gym work actually transfers to swimming)

**Source:** Fone & van den Tillaar (2022), "Effect of Different Types of Strength Training on Swimming Performance in Competitive Swimmers: A Systematic Review," *Sports Medicine – Open*. Full text: https://pmc.ncbi.nlm.nih.gov/articles/PMC8804114/

- Reviewed 27 studies across in-water resisted swimming, dry-land swim-specific training (swim bench/isokinetic), and non-specific dry-land training.
- Within non-specific dry-land, effect sizes on swim performance: **plyometric training 3.6%** (highest), maximal strength 2.7%, hypertrophy 2.6%, core-only 1.9%.
- Combined swim + dry-land strength training outperforms swim-only training.
- Caveat acknowledged in the review itself: almost all included studies were front-crawl; breaststroke-specific transfer data essentially doesn't exist in the literature. Programming for breaststroke/IM still has to lean on general strength-training principles plus stroke-specific biomechanical reasoning (the race-autopsy diagnosis already in `program.md` does this well — it's not something a literature review can replace).

**Verdict on the existing program:** already structured close to optimal. P1–P2 builds a strength base (appropriate — plyometric/ballistic work needs a strength foundation to be trained safely and effectively), P2 already blends in early box-jump/broad-jump work rather than a rigid "hypertrophy only, then power only" split (a more current approach than strict linear periodization), and P4–P5 shift hard into contrast and pure power work, which is exactly where the evidence says the biggest transfer lives. No change made here — the sequencing already reflects the evidence better than a generic template would.

### 2. Shoulder injury prevention

**Sources:**
- 2025 RCT on preventive exercise programs for swimmer's shoulder: https://pmc.ncbi.nlm.nih.gov/articles/PMC11899141/
- Corrective exercise case study, collegiate swimmers, 44% reduction in upper-extremity injury vs. the prior season: https://www.mdpi.com/2075-4663/13/10/349

- Consistent finding: **isolated rotator-cuff-only work is less effective than a multidimensional approach** combining strength, scapular stability, core, mobility, and neuromuscular control — abnormal scapulothoracic mechanics is the mechanism most directly implicated in swimmer's shoulder.
- The existing "insurance package" (Copenhagen planks, cuff + serratus work, hip internal rotation, calf/tibialis) is already reasonably multidimensional — it covers shoulder, hip, and core, not just the cuff in isolation.

**Gap found and fixed:** the program's own summary table states the insurance package is "never skipped, even in taper" — but the actual Wk21 (ASEAN-on) and Wk22 (NCAA week) taper session descriptions didn't mention any shoulder work at all, only the ASEAN-cancelled contingency did. Given the evidence on consistency mattering for injury prevention, and given band pull-aparts cost nothing physiologically (no eccentric load, no soreness risk, fully taper-safe), I added `band pull-aparts 2×15` to both of those taper blocks so the stated policy is actually what gets shown. This is the one substantive change in this pass — everything else below is confirmation, not modification.

### 3. Breaststroke-specific injury prevention (groin/adductor, "breaststroker's knee")

**Sources:**
- Breaststroke lower-limb injury mechanism: https://www.coastsport.com.au/lower-limb-injuries-in-breaststroke-swimmers/
- Copenhagen adduction exercise evidence (muscle thickness +~18%, adductor flexibility +~7%): https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9180184/

- The whip-kick's knee external-rotation and adductor loading is the well-established mechanism for breaststroke-specific knee/groin injuries.
- Copenhagen planks are the standard evidence-based prevention exercise for this, cited protocol dose 2×20s/side.

**Verdict:** the program already prescribes Copenhagen planks at 2–3×20–25s/side across every phase — matches or slightly exceeds the cited protocol. No change made; this was already correct.

### 4. Strength-training taper timing before competition

**Sources:**
- Tapering and peaking maximal strength review: https://pmc.ncbi.nlm.nih.gov/articles/PMC7552788/
- Swimmer-specific tapering (14-day volume taper, 9,000m → 3,000m/day): search summary, see prior citation set.

- Evidence supports **volume reduction (20–40%) while maintaining intensity**, not full cessation, for preserving strength/power into competition — a 7–14 day taper window is well supported, and complete stops earlier than that risk leaving fitness on the table.
- At the same time, this literature is on adult/collegiate athletes; a 17-year-old carrying 9 swims + 3 lifts/week already has less recovery headroom than the study populations, which is exactly the kind of context a generic literature review can't weigh — that's a real coaching judgment call, not a research question.

**Verdict:** the existing "last heavy bar 8–10 days out, last plyos 5 days out, light neural primers close to the meet" structure is more conservative than the strict minimum the adult-athlete literature would require, but that's a defensible choice for a youth athlete under high total load, not a gap. Flagging it here for a coach's judgment rather than changing it unilaterally — this is exactly the kind of call that should stay a human coaching decision, not something an autonomous pass overrides.

## What was deliberately NOT changed, and why

- **The periodization phase structure (P1–P6) and weekly split (9 swims + 3 lifts)** — already matches the "2–3 sessions/week, periodized toward competition" consensus, and further changes would be reshaping something built from this athlete's actual race-autopsy diagnosis, which no generic literature review can improve on without losing that specificity.
- **Wave-loading percentages and RPE targets in P3–P4** — these are standard autoregulated strength-training practice; nothing in the literature reviewed suggested a better approach for this context.
- **Taper cutoff timing** — flagged above as a coaching judgment call, not overridden.

## What a real coach should sanity-check

1. The taper conservatism question above (8–10 days vs. the literature's 7-day minimum) — a call that should stay human.
2. Breaststroke/IM-specific transfer of dry-land strength work is thin in the literature (almost all studies are front-crawl) — the race-autopsy-driven exercise selection in `program.md` is doing real work here that a systematic review can't validate or invalidate.
