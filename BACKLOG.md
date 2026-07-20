# Loop Backlog — one item per iteration, top item first

Rules: small, testable, one screen/module each. Hermes rewrites raw wishes into this shape.
Format: `- [ ] item` → `- [x] item (preview: url)` or `- [ ] item [blocked: reason]`.

## Queue — V5 (Ashton's 2026-07-20 direction: Fitonist-style, liquid color, swim analytics, learning space)

Reference: https://dribbble.com/shots/24606569 (Fitonist) — near-black cards ~20px radius, lilac/yellow accents, per-card period toggles (Today/Week/Month), month calendar with activity dots, glowing curve charts with dot markers, bubble stats.

- [ ] Improvement matrix trailing-7-day windows (the Monday-morning fix): matrix cells compare trailing 7 days vs the 7 before, not calendar-week-to-date. (Split out of the tabs reorg, which shipped in iteration 5.)
- [ ] **Liquid-glow color pass, app-wide**: no flat/static accent fills — rings become conic **gradients with soft outer glow** (fuel ring first), chart lines get gradient stroke + glowing endpoint dots, active states get gradient tints. Keep the perf rules: no backdrop-filter on grid cards, transform/opacity transitions only.
- [ ] **Fitonist-style desktop Home** (mobile keeps the compact stack): per-card period toggles, month calendar card with training-day dots, bubble-style macro/age-range-like breakdown for fuel, glowing curve charts. Reverse-engineer layout from the reference, adapt to RTD's data.
- [ ] **Learn tab (career learning space)**: new nav section with 5 GitHub curricula as leveled tracks — 30 Days of Python (Asabeneh), ML for Beginners (Microsoft), Build Your Own X (codecrafters-io), Project Based Learning (practical-tutorials), and the 19-day cybersecurity one (resolve exact repo). Track page shows levels/progression BEFORE opening a topic (locked → unlocked → done), each lesson links to the repo content, mark-done persists, progress % per track, "explain this lesson" button that opens the coach with lesson context. [needs schema: learning_progress]
- [ ] **Coach memory (the "Hermes memory" ask, built into the app)**: persistent athlete-memory the coach reads and updates on every chat/brief — goals, injuries, preferences, patterns it noticed. Injected into the system prompt; visible/editable in Settings. [needs schema: coach_memory]
- [ ] **Model provider**: evaluate Nous Portal API (Hermes models, free tier) as the coach's LLM alongside/instead of Groq; keep whichever answers better, with fallback. No Telegram anywhere.
- [ ] Self-host Inter font (next/font/google needs Google reachable at build time — one flaky network = failed deploy).

- [ ] Analytics improvement matrix uses calendar-week-to-date, so Monday mornings show "needs more data — log a gym session" even when you trained Friday. Switch matrix cells to trailing-7-day windows (comparison vs the 7 days before), keeping the Week/Month toggle for the detail charts only.
- [ ] Home renders every module twice (desktop bento grid + mobile stack both in DOM, CSS-hides one). Double hydration cost on phones. Restructure so each module renders once with responsive classes, or split server-side.
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

- [x] Analytics tabs + Swim tab (iteration 5): pill tab bar Overview | Train | Swim | Fuel | Recovery (URL-param driven, server-rendered); Overview = matrix + per-domain takeaway link cards; Swim tab = weekly volume bars (gradient+glow), month dot calendar with legend (Fitonist pattern), latest imported session's interval breakdown, plus the existing SwimSection. Matrix rows now deep-link to their tab. Bodyweight lives with Fuel.

- [x] Cache-invalidation audit (iteration 3): every write path already busts both caches — in-app server actions call `updateTag("home-data")`+`updateTag("analytics-data")` (fuel/train/import/analytics/more actions), MCP route calls `revalidateTag(..., {expire: 0})` after all 15+ write tools. Hermes/Claude Telegram logs WILL appear in the UI immediately. No fix needed.

- [x] Smoke suite (iteration 2, adapted from the Playwright plan): `npm run smoke` boots the prod build (or targets a deployed origin via `SMOKE_BASE_URL`), mints a session with the app's own JWT signing (secret never printed), asserts every screen returns 200 with real content and no error boundary, plus auth-redirect still enforced. Zero new dependencies.
