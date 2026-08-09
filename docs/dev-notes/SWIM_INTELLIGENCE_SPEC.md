# Swim Intelligence Spec (WS5)

## Goal
Not a workout logger. A cumulative performance intelligence layer that
analyses every new session against the full training history and relates it
to a fixed set of competitive goals.

## Governing architecture decision

CODE COMPUTES. THE LLM INTERPRETS.

Every number is computed deterministically in TypeScript/SQL. The LLM
receives a pre-computed packet of conclusions and writes narrative.

Rationale:
1. Cost. Feeding raw history to the LLM grows linearly with training
   history. At ~50 sessions that is ~20k tokens added per call, ~60k with
   3x self-consistency, against a 100,000 token/day cap. Non-viable, and
   worsening weekly.
2. Accuracy. Deltas, drop-off and trend slopes are arithmetic over a large
   context — the LLM's weakest operation. Code gets them exactly right.

Worked proof: the athlete's 200 BR splits are 31.0 / 36.7 / 37.1 / 39.7.
Pure arithmetic shows the opening 50 is faster than his 100 BR opening 50
(31.6) and within 0.54s of his all-out 50 PB (30.46) — he opens the 200 at
~98% of maximum 50 speed and fades 2.6s on the final split. Holding 36.7 on
the last 50 alone yields 2:21.5 on current fitness. No LLM was required to
find this, and an LLM asked to derive it from raw text would likely err.

Consequence: the LLM call is CONSTANT SIZE regardless of history depth.
Target steady-state cost ~9,000-12,000 tokens per session ingested, flat.

Self-consistency policy:
  - Parsing: 3x majority vote (a distance has a correct answer).
  - Coaching report: 1x (narrative has no correct answer to vote on).

## Athlete profile

Primary events: 100 Breaststroke, 200 Breaststroke, 200 IM.
Secondary: 50 Breaststroke, 400 IM.
Primary long-term target: 2027 SEA Games, Malaysia, Sept 18-29 2027.
Federation: configurable. Currently assumed Philippines (PAI/PSI).

### Personal bests — long course (50m), authoritative

These are the official PBs. All training analysis compares against them.

  50 BR    30.46
  100 BR   1:05.87   splits 31.6 / 34.3
  200 BR   2:24.53   splits 31.0 / 36.7 / 37.1 / 39.7
  200 IM   2:10.86   fly 28.19 / back 34.34 / breast 37.08 / free 31.25
  400 IM   4:47.38   fly 100 1:05.38 / back 100 1:17.29 /
                     breast 100 1:19.16 / free 100 1:05.55
                     cumulative 1:05.38 / 2:22.67 / 3:41.83 / 4:47.38

A PB IS A TIME PLUS A SPLIT PROFILE. Splits are first-class stored data,
never derived or discarded. Race split profiles are the ground truth that
training set paces are measured against.

### Qualifying time derivation

RULE: the qualifying standard for an event is the 6TH PLACE TIME from the
previous SEA Games edition. Source: athlete's statement of PAI/PSI practice.
Selection structure is QT-A (achieve the standard) with a QT-B fallback
(top-2 national ranking).

Official 2027 standards are NOT YET PUBLISHED. Until they are, QTs are
DERIVED from the rule above and must be labelled as derived estimates, not
announced standards. When PAI publishes 2027 standards, they replace the
derived values.

### Reference times — 2025 SEA Games, Bangkok, Dec 10-15 2025

             6th (QT basis)   Bronze     Gold
  50 BR      28.39            28.02      27.68
  100 BR     1:03.45          1:02.35    1:01.43
  200 BR     2:20.58          2:15.56    2:12.81
  200 IM     2:06.71          2:04.19    2:02.11
  400 IM     4:36.65          4:25.98    4:19.98

6th place holders: 50 BR Steven Insixiengmay (LAO); 100 BR Rachasil
Mahamongkol (THA); 200 BR Andrew Goh (MAS); 200 IM Nicholas Subagyo (INA);
400 IM Peerapat Settheechaichana (THA).

### Current gap to QT

  50 BR    2.07s   7.29% of QT
  100 BR   2.42s   3.81%
  200 BR   3.95s   2.81%
  200 IM   4.15s   3.27%
  400 IM   10.73s  3.88%

Rank events by PERCENTAGE gap, never raw seconds. Raw seconds invert the
ranking and mislead: the 50 BR has the smallest raw gap and is by a wide
margin the furthest event from qualification.

### QT stability rating — must be surfaced wherever a QT is shown

A 6th-place-derived QT is only as firm as the field depth beneath it.

  50 BR    5th 28.32 -> 6th 28.39 -> 7th 28.55.  Gaps 0.07 / 0.16.  HIGH
  100 BR   5th 1:03.24 -> 6th 1:03.45 -> 7th 1:04.61. Gaps 0.21 / 1.16. HIGH
  200 IM   5th 2:05.89 -> 6th 2:06.71 -> 7th 2:06.88. Gaps 0.82 / 0.17. HIGH
  200 BR   5th 2:17.35 -> 6th 2:20.58 -> 7th 2:35.72. Gaps 3.23 / 15.14. LOW
  400 IM   only SIX finalists from five nations. No 7th or 8th existed.
           6th place was the floor of a short field.              VERY LOW

LOW and VERY LOW ratings mean the standard could tighten by several seconds
if the 2027 field is deeper. Never present those two as fixed lines.

Strategic consequence to reflect in reporting: 200 BR is the closest event
by percentage but rests on the softest standard; 200 IM is the best
combination of close and stable; 400 IM's standard is the least trustworthy
of the five; 50 BR is furthest from qualification despite the smallest raw
gap.

### Two-threshold readiness

Readiness is reported against TWO distinct thresholds, never merged:
  1. QT THRESHOLD — makes the team. The primary gate; you cannot medal if
     you are not selected.
  2. MEDAL THRESHOLD — bronze time from the previous edition.
Both gaps are always shown. Medal times drift between cycles; these are a
historical floor, not a forecast.

### Projected national tryout

Late May - mid June 2027. Basis: the 2025 cycle tryout ran Aug 22-24 2025
for Games on Dec 10-15 2025 (~3.5 months); the 2023 Cambodia cycle used the
same gap. UNCONFIRMED — must render as such.

## Phases

### 5.1 — Data foundation
Capture per-rep/per-set achieved times in the parse schema. Store set
results in a queryable table (not inside the text aiAnalysis column) with a
normalized COMPARISON KEY of distance + stroke + equipment + zone/effort,
so "every previous 50 breast at race pace" is one query. Store race PBs and
their split profiles as first-class rows. Backfill existing sessions.
Additive schema changes only.

### 5.2 — Derived metrics engine (pure code, no LLM)
Weekly/monthly volume. Stroke distribution. Intensity distribution.
Per-comparison-key personal bests. Within-set pace drop-off. Trend slopes
over configurable windows. Delta vs the most recent matching set and vs
best-ever matching set. Pace distribution vs the athlete's race split
profile — flags when training pacing contradicts race pacing. Fully
unit-testable, no I/O.

### 5.3 — Athlete profile packet
One compact serialized object: PBs with splits, volume trend, current
strength and weakness signals, goals, meet calendar, days-to-each-meet,
per-event gap to QT and gap to medal with QT stability rating. This is what
gets fed to the LLM. Constant size by construction.

### 5.4 — Coaching report generator
Single LLM call taking (today's parsed session) + (5.2 comparison packet) +
(5.3 profile). Produces the report sections: Workout Summary, Training
Purpose, Key Metrics, Comparison to Previous Sessions, Performance Trends,
What Improved, What Regressed, Weaknesses, Strengths, Connection to Race
Goals, Coach's Notes, Recommendations for Tomorrow, Overall Rating /10,
Training Strain /10, Race Readiness %.
The LLM interprets the packet. It never computes a number that code could
have computed.

### 5.5 — Race readiness
Computed in code from named inputs: recent race/test times vs QT and vs
medal threshold, training volume consistency, race-pace work volume, days
out from the meet. The inputs are ALWAYS shown alongside the output.
Predicted time is a RANGE with a stated basis, never a single number.
Confidence degrades honestly when data is thin, and degrades further for
events whose QT stability rating is LOW or VERY LOW. A readiness figure
that cannot be traced to its inputs is a bug.

### 5.6 — Goals and meet calendar
Meets, event targets, tiered goal times, national records, QT and medal
benchmark times, QT stability rating per event.

### 5.7 — UI surfacing
Replaces the cancelled WS4 §5. The coaching report is the swim session
detail page.

## Non-goals
No finance. No fabricated qualifying times — derived values must be
labelled derived. No single-number race predictions. No readiness figure
without visible inputs. No ranking of events by raw second gap.
