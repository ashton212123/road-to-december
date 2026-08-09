# Road to December — V4 COMBINED: Speed + Mobile + Unified Home + Import + Research-Driven UX (execution-only)

Paste everything below the line into the Sonnet 5 session. Diagnoses verified against code; UX decisions distilled from research on Hevy/Strong (fastest-logging gym apps per Reddit), MySwimPro (swim analytics standard), Gentler Streak (readiness UX benchmark), and fitness-app abandonment studies (manual-entry friction + streak-shame are the top killers). Do not re-derive any of it. Implement in phase order, verify each phase, ship. No scope questions.

---

Execute these six phases on the current DesignCode-dark UI. Keep: bento grid, materials/radii/Inter, comparison charts, checkbox workout mechanics, coach, MCP, auth, all data. Phase order is mandatory — P1 is a performance emergency and everything else is verified on top of it.

## P1 — Speed emergency (Analytics broken on phone; whole app lags)

**Verified diagnosis A:** `src/app/(app)/analytics/page.tsx` fires 13 parallel queries in one `Promise.all` (plus `getStrengthTakeaway`) on EVERY view. On free-tier Micro Supabase (60-conn ceiling — DECISIONS.md) that burst times out on mobile (15s `withRetry` → error boundary) and crawls on desktop. Fix in order:
1. **One round trip:** collapse the 13 reads into a single SQL statement returning one `json_build_object` (one `json_agg` subquery per current dataset, same filters/windows/limits). Parse into the same TypeScript shapes — downstream compute untouched.
2. **Cache:** wrap in `unstable_cache`, tag `analytics-data`; every log-writing server action calls `revalidateTag("analytics-data")`. Same pattern for Home (`home-data`) if not already cached. Warm loads = milliseconds, never stale after writes.
3. **`getStrengthTakeaway`:** cached per-day, same tag; must never block the page more than once/day.
4. **Stream:** Suspense sections with skeleton cards (matrix first, details after) so navigation paints instantly cold.

**Verified diagnosis B (render lag):** V3.2 put `backdrop-filter: blur(10px)` on every desktop grid card — that's the browsing lag. Remove backdrop-filter from ALL grid BentoCards on ALL viewports; cards become `rgba(10,10,12,0.78)` (wallpaper still glows between cards). Blur remains ONLY on floating surfaces (dock, coach panel, menus, tooltips, sheets). Hero glows capped at named heroes; wallpaper layer `transform: translateZ(0)`; replace every `transition-all` with explicit transform/opacity/border/background transitions.

**Acceptance:** Analytics <1.5s warm desktop; loads on throttled Fast-4G mobile viewport with zero error screens; 1920px Home scroll visibly smooth.

## P2 — Mobile compact pass

- Density (`<md` only): page padding 12px, card padding 14px, gap 10px, big numbers 28px, labels 11px.
- Home mobile: StatCards as a 2×2 compact grid (number + chip + label; sparkline hidden), not full-width tall cards.
- Week Map fits viewport width — dots shrink, never overflow.
- **Tab bar → floating pill dock (fixes "boxy"):** inset 12px from left/right/bottom + safe-area, `rounded-full`, black glass with real blur, 5 tabs, active tab = white/12 filled pill sliding behind icon+label (200ms spring). ~64px tall; content bottom padding adjusted.
- Grouped-list rows 48px on mobile.
- Acceptance: 390×844 screenshots of every page look dense and intentional — no card taller than its content, dock floats.

## P3 — Home unification + readiness that coaches instead of judges

- **One hero band:** merge "Days to NCAA" + "Readiness" into ONE 12-col surface: left — DAYS TO NCAA big number + season progress + phase chip; right — readiness status + 3 factor dots + ASEAN mini-countdown. One card, ONE glow spanning it, zones separated by radial-fade dividers, no boxes-in-boxes. Mobile: same single card stacked compact.
- **Readiness tone (Gentler Streak pattern — supportive, not judgmental):** under the status word, one coach-voiced action line: Ready → "Green light — today's the day to push."; Caution → "Show up, keep the RPEs honest."; Rest → "Recovery IS training today." Generated rule-based from the same factors (no extra AI call).
- **Training status setting** (Gentler Streak's most-praised feature): Settings + avatar menu get a status: Healthy / Sick / Injured / Break (stored in settings, default Healthy). While non-Healthy: week map shows those days gray (excused) not red; consistency % excludes excused days from "planned"; readiness caps at Caution with the action line "Getting healthy IS the training right now."; and the daily coach-brief prompt gets one injected line — "Athlete status: {sick|injured|on a break} since {date}. Adjust tone: recovery-first, zero pressure about missed sessions." NOTHING anywhere shames missed sessions while excused.
- **Soft streaks (abandonment research: streak-shame is a top quit-reason):** replace any run-length streak that resets to zero with **4-week consistency %** (sessions done / planned, rolling 28 days). The Week-completion StatCard shows "82% consistency · 4wk" + this week's done/planned. No zero-reset mechanics anywhere in the app.
- **Whoop-style unified fuel ring:** one Fuel card replacing the separate kcal/protein StatCards: one large orange ring (kcal progress, round caps), center "1,840 left"; beside it three slim capsule bars P/C/F (g vs target) + slim water bar. Taps to /fuel. Home stat row becomes: Fuel ring (span 6) + Bodyweight (3) + Consistency (3). Fuel PAGE keeps detailed rings.
- All prior delta-sanity and void rules apply to the new cards.

## P4 — Training import: paste a session, AI structures it (now with real interval structure)

Same trust pattern as meal quick log (review before save; nothing auto-logs):
- **Entry:** "Import session" on Train (today header) + Home Today's Plan card.
- **Parse (one Groq call, existing client + JSON-schema):** classify swim vs gym.
  - **Swim** → `{date, intervals: [{reps, distanceM, stroke, targetInterval?, avgTime?, note?}], totalDistanceM (computed from intervals), setsText (cleaned), loadRatingSuggestion 1-5, notable: [{event, timeMs}] }`. Parse real notation: "8x50 br @1:10 hold 38s" → reps 8, distance 50, stroke breast, interval 1:10, avgTime 38s. Store the structured intervals in a new nullable `intervals` jsonb column on `swim_sessions` (additive Drizzle migration; `drizzle-kit push --force` in non-TTY). Then add a **pace-per-100 trend line** to Analytics' swim section: for each session that has timed intervals, pace = mean over timed intervals of `(avgTime / distanceM) × 100`, excluding warm-up/warm-down intervals (any interval whose note/stroke marks it W/U, W/D, or drill); one point per session date, cyan ComparisonLine styling, takeaway line above it ("Pace per 100 improving/flat/declining over last 4 weeks" — rule-based, threshold ±1.5%).
  - **Gym** → `[{exerciseName, sets: [{setNumber, weightKg, reps, rpe?}]}]` fuzzy-matched to today's session exercises; unmatched → flagged rows retargetable via a select of today's exercises, or discard.
- **Review card:** editable parsed result, confidence styling consistent with meal log, one confirm → existing actions/tables (`swim_sessions`, `workout_logs`, checked `notable` efforts → `swim_times`). Revalidates `analytics-data` + `home-data`.
- **Groq failure handling:** if the parse call errors or returns unusable JSON, keep the pasted text intact in the textarea and show one inline strip — "Couldn't parse this session — try again, or log it manually in Train." No fallback regex parser (out of scope), no data loss, no error boundary.
- **Strava export (optional, feature-flagged):** if `STRAVA_CLIENT_ID`/`STRAVA_CLIENT_SECRET`/refresh-token env vars exist, "Send to Strava" appears on the post-save confirmation (manual activity: type Swim/WeightTraining, name + description from parsed session, proper token refresh). Absent env vars → button doesn't render, zero errors/nags. Add STRAVA_SETUP.md (app registration → refresh token → Vercel env via Bash printf per DEPLOY.md).

## P5 — Friction pass (Hevy/Strong pattern: logging speed beats features; the Day-30 cliff is a data-entry cliff)

- **Ghost values in set editing (Hevy's most-loved mechanic):** when expanding a completed exercise to override, every input arrives PREFILLED as ghost placeholder text with last session's (or prescribed) values — kg, reps, RPE. Confirming an untouched field keeps the default; typing replaces it. Zero fields ever start blank in the workout flow.
- **Two-taps-from-Home audit — exact affordance:** add a "+" button (36px circle, glass, top-right of the Home header next to the avatar, both viewports) opening a quick-log sheet (bottom sheet mobile / popover desktop, real blur — it's a floating surface) with exactly six rows: Water +500ml (logs on tap, sheet stays open with a ✓ tick), Sleep (opens sleep logger), Weigh-in (opens with yesterday's kg as ghost value), Log meal (→ Fuel quick log focused), Soreness (opens logger), Import session (→ P4 flow). The dock keeps exactly 5 tabs — do NOT add a center dock button. Resulting tap counts from Home must be: water 2, sleep 2, weigh-in 2, meal 2, soreness 2, import 2, workout check 2 (Today's Plan → checkbox). Report this table in the phase report with any deviations.
- **One-tap repeats:** Sleep logger gets "Same as last night" chip; weigh-in prefills yesterday's kg as ghost value; water keeps preset chips everywhere they appear.
- Acceptance: count the taps for each daily action from Home and report the table.

## P6 — Verify + ship (mobile FIRST)

Playwright mobile first: 390×844 — Home, Train, Fuel, Analytics (Week + Month, throttled network — must load, no error boundary), Coach, More/menus, import flow with a real pasted swim session ("W/U 400 fr, 8x50 br @1:10 hold 38, 4x100 IM @1:50, 6x200 pull @3:00, W/D 200"). Then desktop 1920 + 1280. Confirm: Analytics fast/stable both platforms; scroll smooth; dock floats; hero band seamless; fuel ring live; consistency % (no zero-reset streak) on Home; ghost values prefill in set editing; import round-trips into Train + Analytics including the pace-per-100 line. Fix anything off without asking. Lint + build, `npx vercel deploy --prod`, verify production both viewports including Analytics Week↔Month.
