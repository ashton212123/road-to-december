# Loop Backlog — one item per iteration, top item first

Rules: small, testable, one screen/module each. Hermes rewrites raw wishes into this shape.
Format: `- [ ] item` → `- [x] item (preview: url)` or `- [ ] item [blocked: reason]`.

## Queue — V5 (Ashton's 2026-07-20 direction: Fitonist-style, liquid color, swim analytics, learning space)

Reference: https://dribbble.com/shots/24606569 (Fitonist) — near-black cards ~20px radius, lilac/yellow accents, per-card period toggles (Today/Week/Month), month calendar with activity dots, glowing curve charts with dot markers, bubble stats.

- [ ] **Liquid-glow color pass, app-wide**: no flat/static accent fills — rings become conic **gradients with soft outer glow** (fuel ring first), chart lines get gradient stroke + glowing endpoint dots, active states get gradient tints. Keep the perf rules: no backdrop-filter on grid cards, transform/opacity transitions only.
- [ ] **Fitonist-style desktop Home** (mobile keeps the compact stack): per-card period toggles, month calendar card with training-day dots, bubble-style macro/age-range-like breakdown for fuel, glowing curve charts. Reverse-engineer layout from the reference, adapt to RTD's data.
- [ ] **Coach memory (the "Hermes memory" ask, built into the app)**: persistent athlete-memory the coach reads and updates on every chat/brief — goals, injuries, preferences, patterns it noticed. Injected into the system prompt; visible/editable in Settings. (LOOP_PHASE2_PROMPT.md P6 — reuses existing ai_takeaways table, no schema change.)
- [ ] **Model provider**: evaluate Nous Portal API (Hermes models, free tier) as the coach's LLM alongside/instead of Groq; keep whichever answers better, with fallback. No Telegram anywhere.
- [ ] Self-host Inter font (next/font/google needs Google reachable at build time — one flaky network = failed deploy).

- [ ] Verify every V4 phase actually shipped (P1–P6 acceptance bars in REVAMP_V4_PROMPT.md); create one backlog item per gap found instead of fixing inline.
- [ ] Coach panel: confirm chat history persists across sessions and the panel restores scroll position; fix if not.
- [ ] Fuel: meal timeline rows — swipe/press delete affordance on mobile (currently only ✕ on desktop hover, if any).
- [ ] Analytics month view: stepping offset back past data start shows a sane empty state, not blank charts.
- [ ] Import parser: handle kick/drill/pull notation ("4x50 kick @1:10", "200 drill") — parse to intervals with note, excluded from pace-per-100.
- [ ] PWA audit: manifest icons (180 + maskable 512), theme-color meta, standalone display — installed app must not show a white flash on launch.
- [ ] Lighthouse mobile pass on /home and /analytics: performance ≥ 90; fix the top offender if below.
- [ ] Empty states audit: every empty card app-wide has a CTA that routes to where the data gets logged.
- [ ] Water logging from the "+" quick-log sheet: verify the one-tap +500ml logs correctly and ticks visually without closing the sheet.

## Done

- [x] Home single render (iteration 11): merged the desktop 12-col bento grid and the mobile stack into one `.rtd-home-grid` container (flex-column below md, the same 12-col grid at md+) so every module renders exactly once instead of twice with one copy CSS-hidden. Visual order differs by breakpoint (fuel/stat cluster sits mid-sequence on mobile, near the top on desktop) so every child got explicit `order-N md:order-M` classes rather than relying on default/tied ordering. Fuel+Bodyweight+Consistency share one wrapper (`grid grid-cols-2 gap-2.5 md:contents`) so they're a compact 2-col cluster on mobile and three independent 12-col-grid items on desktop. MonthCalendarCard is `hidden md:flex` (desktop-only, as before — it never had a mobile equivalent). 6 card components (HomeHeroBand, MonthCalendarCard, TodaysPlanCard, CoachBriefCard, WeekMapCard, TrainingLoadCard, RecentPRsCard) gained a `className` passthrough prop to carry the order classes.

- [x] Improvement matrix trailing windows (iteration 10, the Monday-morning fix): current/previous/delta/progress/needsDataHint now compare a trailing N-day window ending today (7 for week, 28 for month) against the equal-length window before it, instead of calendar-period-to-date. A Friday session now counts on the following Monday. Sparkline/dot history unchanged (still calendar-period-aligned via periodStarts, still respects the offset stepper). Card label now reads "Improvement matrix · last 7/28 days vs previous".

- [x] Learn progression polish + coach hook (iteration 9): first incomplete level per track gets an outline ring + full-white title (later incomplete levels dim to secondary text); track cards on /learn show an "Up next: {level}" caption ("Track complete 🎉" when done); each level row gets a sparkle button that deep-links to the coach with a pre-filled "teach me this + give me an exercise tonight" prompt. Also fixed a false premise in LOOP_PHASE2_PROMPT.md — the coach page did NOT already accept `?q=`; added real support (CoachChat auto-sends an `autoSend` prop once on mount, coach-ai/page.tsx reads `searchParams.q`).

- [x] Learn tab (career learning space, iteration 8): new nav section with 5 GitHub curricula as leveled tracks — 30 Days of Python (Asabeneh), ML for Beginners (Microsoft), Build Your Own X (codecrafters-io), Project Based Learning (practical-tutorials), Cybersecurity (farhanashrafdev/90DaysOfCyberSecurity repacked into 11 levels). `/learn` shows all 5 tracks with progress chips; `/learn/[trackId]` lists levels with a tappable complete-toggle (server action, `learn_progress` table) separate from the external GitHub link tap target. Nav entry added to desktop TopBar, mobile MoreMenuButton, and /more.

- [x] Analytics tabs + Swim tab (iteration 5): pill tab bar Overview | Train | Swim | Fuel | Recovery (URL-param driven, server-rendered); Overview = matrix + per-domain takeaway link cards; Swim tab = weekly volume bars (gradient+glow), month dot calendar with legend (Fitonist pattern), latest imported session's interval breakdown, plus the existing SwimSection. Matrix rows now deep-link to their tab. Bodyweight lives with Fuel.

- [x] Cache-invalidation audit (iteration 3): every write path already busts both caches — in-app server actions call `updateTag("home-data")`+`updateTag("analytics-data")` (fuel/train/import/analytics/more actions), MCP route calls `revalidateTag(..., {expire: 0})` after all 15+ write tools. Hermes/Claude Telegram logs WILL appear in the UI immediately. No fix needed.

- [x] Smoke suite (iteration 2, adapted from the Playwright plan): `npm run smoke` boots the prod build (or targets a deployed origin via `SMOKE_BASE_URL`), mints a session with the app's own JWT signing (secret never printed), asserts every screen returns 200 with real content and no error boundary, plus auth-redirect still enforced. Zero new dependencies.
