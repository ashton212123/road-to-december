# Road to December — V3.2 "DesignCode Dark + Comparison Metrics" (execution-only)

Paste everything below the line into the Sonnet 5 session in this repo. Sections A–B are the ACTUAL extracted DesignCode UI dark-mode recipe (real tokens pulled from the Figma file — not an interpretation). Sections C–E are the dashboard-kit metric patterns. Every decision is made; implement, verify visually, ship. No scope questions, no fetching Figma.

---

Execute this styling + metrics upgrade on the current bento UI. Keep: the bento grid system and spans, checkbox workout mechanics, coach panel behavior, all data paths, MCP, auth, the V3.1 delta-sanity rules. This changes materials, typography, controls, and chart patterns only.

## A — DesignCode dark glass material system (exact values)

**Wallpaper** — one full-viewport `position:fixed; inset:0; z-index:-1` layer in the root layout (never an inner container): base `#101012` with large soft radial glows in DesignCode's palette: violet `rgba(129,85,255,0.13)` centered ~15% x / -5% y, cyan `rgba(95,197,255,0.09)` ~85% x / 10% y, peach `rgba(255,172,137,0.06)` ~70% x / 105% y, pink `rgba(242,98,181,0.05)` ~10% x / 90% y. Pure radial-gradients with wide soft stops — no `filter:blur`, GPU-cheap. The glass reads THROUGH to this — it's what makes the material work.

**Card material** (replaces the current near-opaque glass on every BentoCard):
- Desktop (`md+`): `background: rgba(0,0,0,0.5); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.10); border-radius: 10px; box-shadow: 0 5px 10px rgba(0,0,0,0.10), 0 15px 30px rgba(0,0,0,0.10), 0 20px 40px rgba(0,0,0,0.15);`
- Mobile (`<md`): same everything but `background: rgba(12,12,14,0.88)` and NO backdrop-filter (identical look on phone without the scroll-jank cost; the wallpaper glows still read behind cards).
- **Radius system change: cards 20px → 10px. Buttons/inner elements → 8px. Sweep the whole app** — this is DesignCode's tighter, more technical geometry.

**Dividers** — no more flat hairline `border-t` inside cards and lists. DesignCode divider: a 1px line that's brightest at center and fades out: `background: radial-gradient(50% 100% at 50% 50%, rgba(255,255,255,0.2), transparent); height: 1px;`. Replace every in-card divider with this.

**Hero glow** (signature move, hero surfaces ONLY — countdown card, readiness card, session-complete summary, coach panel header; never on ordinary grid cards): a `::before` layer at `inset: -10px; z-index: -1;` with 2–3 overlapping radial gradients in violet `#8155FF`, cyan `#5FC5FF`, peach `#FFAC89` at 18–25% alpha, rounded 14px — pre-blurred by gradient softness, no filter.

**Shiny button** (primary CTAs only: Start session, Estimate, Save, coach send): glass `rgba(0,0,0,0.5)` + blur(10px), `border: 2px solid rgba(255,255,255,0.8)`, radius 8, shadows `0 1px 0 rgba(0,0,0,0.05), 0 4px 4px rgba(0,0,0,0.05), 0 10px 10px rgba(0,0,0,0.1)`, plus a soft violet→cyan gradient glow underneath at ~20% opacity. Secondary/ghost buttons: current style, re-radiused to 8px.

**Typography** — switch the app to **Inter** via `next/font` (`display: swap`), replacing the -apple-system stack (which renders as Arial on Windows — the user's main desktop). Text opacity hierarchy on dark: primary `#fff`, secondary `rgba(255,255,255,0.72)`, tertiary `rgba(255,255,255,0.55)` (DesignCode uses 70/50; we hold slightly higher for WCAG on data text). Display numbers (32px+) get tight tracking: `-0.03em` at 32px scaling to `-0.05em` at 56px, semibold — the DesignCode big-number look.

## B — Controls: pills, sliding segmented, grouped lists

- Buttons/chips: pill (`rounded-full`) for chips and small actions; standard buttons 8px radius (DesignCode buttons are 8px, not pills — chips and segmented controls are the pill elements).
- Segmented controls ([Week|Month], settings toggles): container white/6% pill, sliding glass thumb white/12% + hairline, 200ms spring slide.
- iOS-style grouped lists for More/avatar menu, Settings, Coach AI info, Business & School rows: 52px rows of IconTile + 15px label + trailing chevron/value inside ONE glass group card (10px radius), rows separated by the radial-fade divider. Row hover: white/4%.
- Inputs: white/6% bg, 8px radius, focus ring in domain color, 16px font (rule stands).

## C — StatCard v2: tinted cards, inline deltas

- Whole-card domain tint layered over the glass: domain color at 7% alpha (kcal orange, protein green, bodyweight blue, completion cyan).
- Layout: 11px uppercase label top-left; big 32px tabular number with the delta/progress chip INLINE on its baseline (12px chip with ↗/↘ glyph); sparkline pinned bottom. IconTiles removed from StatCards only (tint carries identity); they stay in list rows, matrix rows, card headers.
- V3.1 delta-sanity rules unchanged (intraday = % of target, never vs-yesterday; caps; "—" for insufficient data).

## D — Comparison charts: solid now vs dashed before

- Shared `ComparisonLine` pattern: current period = 2px solid domain-color line, glow, gradient fill; previous period = 1.5px dashed (`4 4`) same color at 45% alpha, no fill. Legend pills top-right ("This week" solid dot / "Last week" ring dot). Driven by the page's [Week|Month] control.
- Apply to Analytics detail cards (e1RM, load, bodyweight, sleep) and Home Training Load (daily tonnage this week vs last week dashed).
- Card-header text-tabs where one card hosts sibling metrics (Load: Tonnage | Hard sets | Sessions) — 13px inline tabs, active white, animated underline dot.

## E — Two more metric patterns

- `MiniBarList` — rows of 13px label + slim 6px capsule bar (domain color on white/6% track) + right-aligned value. Use: tonnage by movement pattern (Analytics), protein by meal slot (Fuel), per-category adherence (Home week map card footer if it fits cleanly).
- Macro donut restyle: donut left (thick round caps, kcal center), legend rows right — color dot + 13px label + value/target — one row per macro, radial-fade dividers between rows.

## F — Sweep order

1. A: wallpaper → card material → radius sweep (20→10, buttons 8) → dividers → Inter. Screenshot 390px immediately: no seam, no jank scrolling Home on mobile viewport.
2. B: controls + grouped lists across all pages.
3. C on Home. 4. D in Analytics + Home load. 5. E in Analytics + Fuel. 6. Hero glows + shiny buttons last (they're the garnish, not the base).

## Verify + ship

Playwright screenshots at 1920, 1280, 390: Home, Analytics (Week AND Month — dashed comparison visible), Fuel, Train, Settings/More, Coach open. Confirm: wallpaper glows visible through cards on desktop (the blur must be perceptible at card edges over a glow), radius uniformly 10/8, dividers fade at edges, Inter rendering (no Arial), zero seams, no "-100%" chips, comparison lines use real previous-period data. Fix defects without asking. Lint + build, `npx vercel deploy --prod`, verify production on desktop AND phone viewport.
