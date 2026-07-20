# Road to December — V3.1R Completion Patch (run AFTER V3.2 is deployed)

Paste everything below the line into the Sonnet 5 session once V3.2 (DesignCode dark + comparison metrics) has shipped. This patch delivers the fixes that were planned before V3.2 but never run, adjusted to the new DesignCode material system. Execution-only: every decision is made; implement, verify, ship, no scope questions.

---

Execute these five fixes on the current DesignCode-dark bento UI. Keep everything V3.2 shipped (wallpaper, black-glass cards, 10px/8px radii, Inter, pills, grouped lists, StatCard v2, comparison charts). All new work must use those same materials and radii.

## Fix 1 — Desktop width: fill the screen

The app occupies roughly half of a 1920px display because legacy max-width caps predating the bento revamp still survive (`max-w-6xl` on the app shell in `src/app/(app)/layout.tsx`, plus any inner `max-w-[1240px]`-class caps). New spec:
- App shell: full viewport width, `px-6 lg:px-10`, sidebar fixed 220px, content takes ALL remaining width up to `max-w-[1600px]` centered in the remaining space.
- Bento grid keeps 12 columns / 16px gap; columns are `minmax(0, 1fr)` — fluid. At 1920px the content area must measure ≥1500px; at 1440px it fills edge-padding to edge-padding.
- Remove every max-width between shell and page grids except the 1600 cap. Mobile untouched.
- Forms/settings keep their narrower centered column (`max-w-2xl`) — intentional.

## Fix 2 — Kill internal card voids

Cards reserve heights their content doesn't fill (a "Rest day" line floating in a huge box; stat cards with hollow bottoms; one-line alerts centered in tall cards). Rules:
- Every BentoCard: `flex flex-col` — header top, body `flex-1`, footer (chips/sparklines/CTAs) pinned bottom with `mt-auto`.
- **StatCard with no history:** the sparkline zone never renders empty — flat dashed baseline (1px, white/10) + "tracking starts after 2+ days of logs" in 11px tertiary.
- **Today's Plan on rest days:** headline "Rest day", then tomorrow's session preview (title + time + first 3 exercises), then quick links: Log sleep · Log soreness · Log weigh-in. A rest-day checklist, not a void.
- **Needs Attention when clear:** "All clear ✓" in the green status color + the 3 most recent resolved/dismissed alerts muted (or "no alerts yet today").
- **Coach Brief:** brief text top, 2–3 one-line data bullets it references (e.g. "Protein 7-day avg: 96g — target 113g"), question chips pinned bottom.
- After the pass: no card at desktop width has more than ~25% visually empty interior. Screenshot 1280px, check EVERY card, fix stragglers without asking.

## Fix 3 — Delta sanity everywhere (the "▼ -100.0%" class of bug)

V3.2's StatCard v2 may have implemented part of this on Home — now enforce it app-wide. Grep every delta/chip/percent rendering in the codebase and apply:
- Intraday accumulators (kcal, protein, water — anything still filling up today) NEVER show a vs-yesterday delta. Chip = progress-to-target: "42% of target" (gray until 70%, green 70–110%, orange >110%, direction-aware where over is fine e.g. water).
- True deltas only for settled metrics: bodyweight 7d avg vs prior 7d, weekly completion vs prior week, weekly tonnage, e1RMs, swim times.
- Either side 0/null/insufficient → "—" (gray). Displayed deltas cap at ±99%. Zero exceptions anywhere — Home, Analytics matrix, detail cards, Fuel weekly review.

## Fix 4 — Verify the mobile seam is dead

V3.2's full-viewport wallpaper should have eliminated the visible edge line on phone Home. Verify at 390px with Playwright. If ANY seam/border line remains, work this checklist in order and fix what you find: (1) any background still painted on an inner max-width container instead of the viewport layer; (2) a legacy `max-w-[430px]` mobile wrapper still carrying a border/background; (3) double-bordered cards — old GlassCard nested inside BentoCard rendering two hairlines (BentoCard is the ONLY border-carrying container); (4) horizontal overflow creating an edge — `overflow-x: clip` on main, then fix the overflowing card (Week Map's 7-column dot grid is the prime suspect: it must shrink, never overflow). Before/after screenshots.

## Fix 5 — Complete the chart restyle (the parts V3.2 didn't cover)

V3.2 delivered comparison lines, MiniBarList, and the donut. Now restyle the remaining Recharts surfaces to the same neon-on-dark language, using DesignCode materials:
- **Bars (all bar charts):** capsule bars — `radius` = half bar width, solid domain color; subtle full-height track behind each bar (white 4%); horizontal dotted gridlines only (`strokeDasharray="2 6"`, `stroke="rgba(255,255,255,0.06)"`, `vertical={false}`); no axis/tick lines (`axisLine={false} tickLine={false}`); 11px tertiary labels.
- **Non-comparison line charts:** 2px smooth monotone, round caps, soft glow (`drop-shadow(0 0 6px <color at 40%>)`), gradient fill 18%→transparent.
- **Legends:** pill chips (8px dot + 11px label, white/6% bg, rounded-full) replacing every default Recharts legend.
- **Tooltip:** ONE shared custom tooltip used by every chart: black-glass panel (`rgba(0,0,0,0.6)` + blur, 8px radius — V3.2 material), 12px text, label tertiary, value in domain color. No default white tooltip anywhere.
- Colors strictly from the domain palette; multi-series = domain colors, never random hues.

## Verify + ship

Playwright screenshots at 1920×1080, 1280×800, 390×844: Home, Train (session + phase browser), Fuel, Analytics (Week AND Month), Coach panel open. Confirm: content ≥78% of 1920px width; no card >25% empty; zero "-100%"-style chips anywhere; no seam on mobile; every chart matches the language (capsule bars, dotted grids, pill legends, glass tooltip). Fix anything off without asking. Lint + build, `npx vercel deploy --prod`, verify production on desktop and phone viewport.
