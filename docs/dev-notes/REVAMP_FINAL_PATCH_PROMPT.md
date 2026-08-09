# Road to December — Final Patch: V3.1R + the Analytics chart surgery V3.2 deferred (execution-only)

Paste everything below the line into the Sonnet 5 session. This is the last pass: the layout/void/delta fixes that were skipped when V3.1 was bypassed, PLUS the Analytics comparison-chart retrofit deliberately deferred in V3.2. Every decision is made; implement, verify, ship. No scope questions.

---

Execute these fixes on the current DesignCode-dark UI. Keep everything V3.2 shipped (wallpaper, black glass, 10/8px radii, Inter, pills, grouped lists, StatCard v2, ComparisonLine on Home Load, MiniBarLists). All new work uses those same materials.

## Fix 1 — Desktop width: fill the screen

Legacy max-width caps still pin the app to ~half of a 1920px display (`max-w-6xl` on the shell in `src/app/(app)/layout.tsx` + any inner `max-w-[1240px]`-class caps). Spec:
- Shell: full viewport width, `px-6 lg:px-10`, sidebar fixed 220px, content takes all remaining width up to `max-w-[1600px]` centered in the remaining space.
- Bento grid: 12 fluid columns (`minmax(0,1fr)`), 16px gap. At 1920px, content area ≥1500px wide; at 1440px it fills to the padding.
- Remove every max-width between shell and page grids except the 1600 cap. Mobile untouched. Forms/settings keep `max-w-2xl` centered — intentional.
- Do this FIRST — all later visual verification happens at the new width.

## Fix 2 — Kill internal card voids

- Every BentoCard: `flex flex-col` — header top, body `flex-1`, footer (chips/sparklines/CTAs) pinned with `mt-auto`.
- StatCard with no history: sparkline zone shows a flat dashed baseline (1px white/10) + "tracking starts after 2+ days of logs" (11px tertiary) — never empty space.
- Today's Plan on rest days: "Rest day" headline → tomorrow's session preview (title, time, first 3 exercises) → quick links: Log sleep · Log soreness · Log weigh-in.
- Needs Attention when clear: "All clear ✓" in status green + last 3 resolved/dismissed alerts muted (or "no alerts yet today").
- Coach Brief: brief top, 2–3 one-line data bullets it references, question chips pinned bottom.
- Exit bar: no card at desktop width >~25% visually empty. Screenshot 1280px, audit every card, fix stragglers without asking.

## Fix 3 — Analytics chart surgery (the deferred V3.2 work + full restyle, one chart at a time)

Retrofit the existing Recharts detail cards (e1RM/strength, Load/ACWR, bodyweight, sleep) with BOTH the comparison pattern and the chart language, using this de-risking method: **one chart per iteration — restyle it, screenshot it at 1280px with real data, confirm it renders, then move to the next.** Never refactor all charts in one sweep. Keep each card's data-fetching untouched; add a thin presentation-side transform for previous-period series.

Per chart:
- **ComparisonLine retrofit** (line charts: e1RM, bodyweight, sleep, load trend): current period = 2px solid domain-color line, round caps, soft glow (`drop-shadow(0 0 6px <color at 40%>)`), gradient fill 18%→transparent; previous period = 1.5px dashed (`4 4`) same color at 45% alpha, NO fill. Driven by the page's existing [Week|Month] segmented control. If previous-period data is missing/empty for a chart, render solid-only with a muted "no previous data" legend pill — never a fake mirrored line, never a crash.
- **Legend pills** top-right: "This week/month" solid dot · "Last week/month" ring dot (white/6% bg, rounded-full). Replace every default Recharts legend.
- **Bars** (any bar chart in these cards + anywhere else still default-styled): capsule bars (radius = half bar width), solid domain color, full-height track behind each bar (white 4%), horizontal dotted gridlines only (`strokeDasharray="2 6"`, `stroke="rgba(255,255,255,0.06)"`, `vertical={false}`), `axisLine={false} tickLine={false}`, 11px tertiary tick labels.
- **Shared glass tooltip** for ALL charts (build once, use everywhere): `rgba(0,0,0,0.6)` + blur, 8px radius, 12px text, label tertiary, value in domain color. No default white tooltip anywhere in the app.
- **Load card text-tabs**: 13px inline header tabs — Tonnage | Hard sets | Sessions — active white with an animated underline dot, inactive tertiary, switching the card's series without changing card size.
- ACWR/load band chart keeps its band; restyle strokes/grid/tooltip to the language.

## Fix 4 — Delta sanity, app-wide sweep

V3.2 fixed the "-100%" chips on Home StatCards. Now grep EVERY delta/percent/chip render in the codebase (Analytics matrix rows, detail cards, Fuel weekly review, anywhere else) and enforce:
- Intraday accumulators (kcal/protein/water today) never show vs-yesterday deltas — progress-to-target chips only ("42% of target": gray <70%, green 70–110%, orange >110%, direction-aware where over is fine, e.g. water).
- True deltas only for settled metrics (bodyweight 7d vs prior 7d, weekly completion/tonnage vs prior week, e1RMs, swim times).
- Either side 0/null/insufficient → "—" gray. Cap display at ±99%. Zero exceptions.

## Fix 5 — Confirm the mobile seam is dead

V3.2's viewport wallpaper + hero-glow overflow fix should have killed the phone-Home edge line. Verify at 390px with Playwright. If ANY seam remains, check in order and fix: (1) background painted on an inner container instead of the viewport layer; (2) legacy `max-w-[430px]` wrapper carrying border/background; (3) double-hairline from old GlassCard nested inside BentoCard (BentoCard is the only border-carrying container); (4) horizontal overflow (`overflow-x: clip` on main, then fix the overflowing card — Week Map's dot grid is the prime suspect). Before/after screenshots.

## Verify + ship

Playwright screenshots at 1920×1080, 1280×800, 390×844: Home, Train (session + phase browser), Fuel, Analytics (Week AND Month — dashed previous-period lines visible on every retrofitted chart), Coach panel open. Confirm: content ≥78% of 1920px width; no card >25% empty; every chart shows capsule bars/dotted grids/pill legends/glass tooltip; zero "-100%"-class chips anywhere; no mobile seam. Fix anything off without asking. Lint + build, `npx vercel deploy --prod`, verify production on desktop and phone viewports — including switching Week↔Month on Analytics live.
