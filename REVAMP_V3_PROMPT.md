# Road to December — V3 "Bento Glass" Revamp (execution-only prompt)

Paste everything below the line into the Sonnet 5 Claude Code session in this repo.

---

Execute this revamp of Road to December exactly as specified. Every design decision has already been made — do NOT rethink, re-derive, or ask about scope; implement, verify visually, report per phase, and continue. Your judgment is only for code-level implementation details. Keep working: the checkbox workout mechanics, all DB write paths, auth, the MCP server, and all logged data. You may add read queries (batched, never N+1).

## Why (context, not a question)

The current desktop UI fails because pages are two independent stacked columns with no row alignment — cards end at different heights, leaving big voids (see Fuel). There's no visual anchor system (icon tiles, deltas, sparklines), Home doesn't summarize the whole life of the app, Analytics has no at-a-glance improving/declining view, and the AI coach is buried in More. V3 fixes all of it with one design language.

## Design language: "Bento Glass" (build these primitives FIRST — Phase A)

**The grid (this is what kills the ragged spacing):** every desktop page is `display:grid; grid-template-columns: repeat(12, 1fr); gap: 16px; grid-auto-rows: 96px;` inside `max-w-[1240px] mx-auto`. Every card declares `col-span-N row-span-N` and fills its area (`h-full`, internal overflow handled per card). Rows must always be completely filled — no orphan columns, no card ever floats beside empty space. Mobile (<md): single column stack, same cards, explicit priority order per page below.

**New primitives in `src/components/ui/` (reuse existing GlassCard/tokens underneath):**
- `BentoCard` — glass base, 20px radius, 0.5px hairline, 20px padding, `h-full flex flex-col`, optional header row: 11px uppercase tracking-wide tertiary label + optional IconTile + optional trailing chevron-link. Hover (desktop): `translateY(-2px)`, border brightens to white/12, 150ms ease-out. All cards on all pages become BentoCards.
- `IconTile` — 32px square, rounded-[10px], domain color at 14% alpha background, 18px stroke icon in the domain color.
- `StatCard` — BentoCard with: IconTile top-left, 32px/700 tabular-nums number (count-up on mount), 13px label, DeltaChip, and a 40px-high Sparkline pinned to the bottom (last 14 data points, 1.5px domain-color stroke, gradient fill fading to transparent, no axes).
- `DeltaChip` — pill: `▲ +2.1%` green tint bg/text when improving, `▼` red when declining, `—` gray when flat or no comparison. Direction-of-good is metric-aware (weight down ≠ bad during bulk: use each metric's target direction).
- `DotStrip` — N small dots (8px) in a row, each green (improved vs previous period) / red (declined) / gray (flat or no data), with the period label on hover/tap.
- `Sparkline` — tiny SVG, shared by StatCard and the Analytics matrix. Draw-in animation on mount (200ms), gated by `prefers-reduced-motion`.

**Domain colors, used EVERYWHERE consistently (icon tiles, rings, chart strokes, dots):** Train `--rtd-blue`, Fuel `--rtd-orange`, Swim `--rtd-cyan`, Recovery/Readiness `--rtd-green`, Sleep `--rtd-purple`, School `#FFD60A`, Business `#66D4CF` (add both as tokens). Status language app-wide: green = improving/done, orange = flat/warning, red = declining/missed — one visual grammar, learned once (Whoop-style).

**Numbers:** all metrics use `font-variant-numeric: tabular-nums`. Hero numbers 44–56px/800/-0.02em. Card stats 32px/700.

**Banners/notices:** never standalone floating cards again. They become slim 36px inline strips (icon + one line, tinted bg at 10% alpha) at the top of the page or inside the relevant card. Convert every existing banner (bulk window, race-pace reminder, post-gym meal, needs-confirmation) to strips.

**Motion:** existing spring system; staggered card entrance 30ms/card; number count-up; ring/sparkline draw-in; all `prefers-reduced-motion`-gated. No layout-property animations.

## Phase B — Home = Mission Control (the whole app at a glance)

Desktop bento map (12-col, rows are 96px units):
- **Row 1:** Countdown hero `8×2` — "DAYS TO NCAA" 56px number, season progress bar beneath (% through 21 weeks), current phase chip + week number; right edge: ASEAN countdown small + status. | Readiness `4×2` — big colored status word (Ready/Caution/Rest = green/orange/red from the existing 3-factor logic), the 3 factor rows (sleep, CMJ trend, acute:chronic) each with a status dot.
- **Row 2:** four StatCards `3×2` each: Kcal today (vs target, orange), Protein today (green), Bodyweight 7-day avg (delta vs last week + sparkline), Week completion (sessions done/planned this week + streak count).
- **Row 3:** Today's Plan `5×3` — every session today (swim AM/PM, gym) as rows: time, title, status checkbox (same optimistic mechanics as Train), and one "Start session →" CTA into today's workout. | Coach Brief `4×3` — the cached daily AI brief (short, coach-voiced, no fluff) + 2 tappable follow-up question chips that open the Coach panel pre-filled. | Needs Attention `3×3` — existing alert list restyled: color-dot rows, dismissible.
- **Row 4:** Week Map `4×2` — grid of 7 columns (M–S) × 4 rows (Swim, Gym, Fuel, Sleep), each cell a dot: green logged / red missed / gray future-or-rest, plus adherence % per row. | Training Load `4×2` — last 8 weeks tonnage as bars + acute:chronic line, one plain-English takeaway line. | Recent PRs `4×2` — last 3 PRs/achievements with DeltaChips and dates.
- Every module taps through to its full screen. If a module's data is empty, show the muted state INSIDE the card with a CTA — never collapse or hide it (grid stays full).
- Mobile order: Countdown → Readiness → Today's Plan → Coach Brief → 2×2 StatCards → Needs Attention → Week Map → Load → PRs.

## Phase C — Analytics: the Improvement Matrix + weekly/monthly everywhere

- Page header: segmented control **[Week | Month]** + `‹ current period ›` stepper — applies to the entire page.
- **Improvement Matrix** (full-width `12`-col BentoCard, the answer to "a bar or dot for everything, improving or not"): one row per tracked metric — every main lift's e1RM, every swim event's best time, bodyweight, weekly tonnage, session completion %, protein adherence %, kcal adherence %, sleep avg, water avg, CMJ. Each row: IconTile + name | Sparkline | current period value | previous period value | DeltaChip | DotStrip of the last 10 periods. Metrics without enough data render as muted rows saying "needs more data — log X" (never hidden). Row click expands/scrolls to that metric's detail card.
- Detail cards below, 2-up (`6×3` each), restyled as BentoCards, each LEADING with a one-line plain-English takeaway computed from the data: Strength (e1RM lines per lift), Load (tonnage + A:C band), Swim (event progression + predicted times, labeled estimates), Body (weight vs bulk target band), Fuel adherence (calendar heat map), Recovery (sleep + CMJ + soreness overlay).
- All existing chart logic/queries can be reused; restyle and add the week/month aggregation layer (computed server-side, one batched query per page).

## Phase D — Fuel + Train restyle (same language)

- **Fuel** desktop map: Row 1: rings summary `8×2` (three rings side-by-side, labels readable at a glance) + Water `4×2` (ring + quick-add chips). Row 2: Quick Log `7×3` (recent-food chips, textarea, estimate flow — mechanics unchanged) + Macros donut `5×3`. Row 3: Meal timeline `7×3` + Weekly review `5×3` (StatCard-style mini grid inside). Banners → strips at top. Columns MUST end flush.
- **Train**: Today's session hero `8×2` (title, exercise count, est. duration, "Start →") + This Week `4×2` (day dots). Exercise cards keep their exact current mechanics, restyled as BentoCards. Phase browser: 3-up grid of phase cards with progress bars (already close — align to the new grid).
- Sweep Business, School, Recovery, Settings onto the same grid (centered `8`-col for forms; grids of BentoCards for lists). No page keeps the old loose-column layout.

## Phase E — Coach everywhere (un-hide the AI)

- **Desktop:** persistent floating coach button, bottom-right, 48px glass circle with sparkle icon and a very subtle glow — on EVERY page. Click (or `Ctrl+J`) opens a 400px right slide-over glass panel: streaming chat, persisted history, and 3 context-aware quick prompts per page (Fuel: "What should I eat for the rest of today?" · Train: "Should I go heavier today?" · Analytics: "Why am I plateauing?" · Home: "How ready am I this week?"). Also add "Coach" to the sidebar (opens the same panel).
- **Mobile:** Coach becomes the CENTER tab of the 5-tab bar: Home, Train, **Coach**, Fuel, Analytics — full-screen chat with the same quick prompts. Everything currently under More (School, Business, Recovery, Settings, MCP setup, logout) moves to a menu opened from an avatar button in the Home header, plus a compact "More" row grid at the bottom of Home. Keep all routes working.
- Reuse the existing Groq plumbing + context assembly + daily brief cache. The brief on Home (Phase B) and the panel share one backend.

## Phase F — Sweep + ship

- Playwright screenshots of EVERY page at 1280×800 and 390×844. Fix every visual defect you see without asking: misaligned rows, uneven column endings, orphan gaps, unreadable text, broken hover.
- The hard grid check: at desktop width, sibling columns in any row must end flush (the auto-rows system guarantees it if spans are right).
- Lint + build green. Deploy `npx vercel deploy --prod` (CLI-only). Verify production loads, Home renders all modules with live data, coach panel streams, and one workout checkbox still feels instant.

Report what shipped after each phase (A→F) and keep going until F is done.
