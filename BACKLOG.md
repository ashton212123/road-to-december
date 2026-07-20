# Loop Backlog — one item per iteration, top item first

Rules: small, testable, one screen/module each. Hermes rewrites raw wishes into this shape.
Format: `- [ ] item` → `- [x] item (preview: url)` or `- [ ] item [blocked: reason]`.

## Queue

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

- [x] Cache-invalidation audit (iteration 3): every write path already busts both caches — in-app server actions call `updateTag("home-data")`+`updateTag("analytics-data")` (fuel/train/import/analytics/more actions), MCP route calls `revalidateTag(..., {expire: 0})` after all 15+ write tools. Hermes/Claude Telegram logs WILL appear in the UI immediately. No fix needed.

- [x] Smoke suite (iteration 2, adapted from the Playwright plan): `npm run smoke` boots the prod build (or targets a deployed origin via `SMOKE_BASE_URL`), mints a session with the app's own JWT signing (secret never printed), asserts every screen returns 200 with real content and no error boundary, plus auth-redirect still enforced. Zero new dependencies.
