# LOOP PHASE 4 — execution-only prompt (paste everything below the line into Sonnet 5)

All thinking is done. Do not re-derive, re-decide, or ask. Execute phases in order; each phase ends with the verify-and-ship pipeline, its own `loop N:` commit (loops 20–25), and a LOOP_LOG.md entry. Repo: `C:\Users\Ashton\Documents\road-to-december`.

This plan was written after the athlete's FIRST real training day using the app (Tuesday swim + gym, 2026-07-21) and a fresh code audit the same day. Every "current state" claim below was verified by reading the named file. This phase is driven by field-tested pain, not speculation — the athlete hit a crash screen mid-session, couldn't find the AI swim import, got told to "back off intensity" by a mathematically-broken ACWR, and had the coach button covering the Send button while talking to the coach. Fix the app they actually used, mobile-first: the iPhone is the primary device for every one of these flows.

---

## Environment rules (violating these is how past iterations broke)

- **Node PATH:** every shell command that needs node/npm/npx must prepend it: PowerShell `$env:Path = "C:\Program Files\nodejs;" + $env:Path`.
- **Commits:** PowerShell 5.1 mangles here-strings — always `git commit -F <msgfile>` with the message written to a temp file first. End messages with `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- **Pipeline per phase:** `npm run lint` → `npm run build` → `node scripts/smoke.mjs` (local, boots :3111) → `npx vercel deploy --prod --yes` → `Start-Sleep -Seconds 20` (alias propagation) → `$env:SMOKE_BASE_URL="https://road-to-december.vercel.app"; node scripts/smoke.mjs` → phase-specific live assertions (throwaway `scripts/verify-*.mjs`, minted session via jose + AUTH_SESSION_SECRET from .env.local — NEVER print the secret or token — then delete the script).
- **ZERO schema changes this entire run.** Everything below runs on existing tables. `settings.weightUnit` ('kg' | 'lb') ALREADY EXISTS (schema.ts:180) with a working SettingsForm control — P4 consumes it, nothing migrates. NEVER `drizzle-kit push` or `drizzle-kit migrate`.
- **No new npm dependencies.** The Groq tool-calling in P6 is plain fetch against the same endpoint `lib/ai/groq.ts` already uses.
- **No preview deploys, ever.** Prod only, self-verified. Never hand the user a preview URL.
- Never read/print `.env*` values, `mcp-token.txt`, or tokens. Never enter passwords into a browser.
- **React Compiler strict lint** (`react-hooks/set-state-in-effect`, `react-hooks/purity`): setState never synchronously in an effect body (put it inside the timer/listener callback); `Date.now()` only at genuine JSX-wired handler call sites, passed down as an argument.
- **Live-HTML assertion traps:** RSC flight payload duplicates every rendered string — anchor assertions to real markup (`</span>`, `class="`). React splits adjacent text children with `<!-- -->`. `redirect()`/`notFound()` inside Suspense stream a 200. When an assertion fails, READ the raw HTML before concluding the app is broken.
- Update `BACKLOG.md` and prepend a `LOOP_LOG.md` entry per phase.

## Audit corrections (things that already exist — do NOT rebuild them)

1. **AI session import already exists and works** — `ImportSessionButton.tsx`: paste free text → one Groq call (`estimateSessionImportAction`) → editable review → save, handles swim AND gym. The athlete never found it. P5 fixes *discoverability and forgiveness*, not parsing.
2. **Checkbox-complete already auto-logs prescribed sets** — `WorkoutSession.tsx` `handleToggle` calls `completeExerciseAction` with `targetSets`/`defaultReps`/`resolvedDefaultWeightKg`. The athlete's complaint is the *aftermath display*: a weightless exercise (Box jump) renders four rows of `Set 1 –kg × 6 @ RPE –` that look broken. P4 fixes the display, not the mechanism.
3. **`settings.weightUnit` exists end-to-end in data** (schema, SettingsForm, MCP route) — but `ExerciseCard.tsx` hardcodes `kg` in 6 places. P4 wires it through.
4. **RestPill shipped in loop 16 (same day as the athlete's session — they likely trained on the pre-deploy build).** Don't rebuild it; P4 only adds the start-of-rest cue.

## Non-goals (do not touch, even if tempted)

- No schema changes, no new deps, no Telegram, no preview deploys.
- Do not remove recharts or undo the loop-19 code-splits.
- Do not rebuild the import parser prompt in `lib/train/importSession.ts` beyond the P5 fallback path.
- Do not add AI-driven *deletes* of historical data beyond the single `undo_last` tool specced in P6.
- Do not touch Strava, Hermes, or the MCP route (`src/app/api/mcp/route.ts`) — the in-app coach gets its own tool layer in P6; the MCP connector stays as-is.

---

## P1 — Metric truth + reliability (loop 20)

The app gave the athlete a false red alert on day one. Trust is the product; fix the math first.

### 1a. ACWR cold-start gate (the "4.00 — back off intensity" bug)
`lib/analytics/load.ts` `computeAcwr`: when all logged load sits inside the last 7 days, acute = sum/7 and chronic = sum/28 of the *same data*, so ratio = exactly 4.00 and every surface (Analytics TRAIN takeaway, Home training-load takeaway, readiness signal) screams "spiking, back off." Mathematically guaranteed nonsense for any new logger.
- In `computeAcwr`, per point: compute the chronic window as before, but ALSO count days-with-data in the 8–28-days-ago span (chronic window minus acute window). If that older span has **zero** days with data, set `ratio: null` for that point (keep acute/chronic numbers).
- `loadTakeaway` (`lib/analytics/takeaways.ts`) already skips null-ratio points — add one new branch: if the array is non-empty but NO point has a non-null ratio, return `"Building your load baseline — ACWR needs about two weeks of logged sessions before it means anything."` instead of null, so the card explains itself rather than vanishing.
- `lib/rules/readiness.ts` already renders a neutral signal for `acwrRatio === null` — verify the wording says baseline-building, adjust if it implies missing data ("log sessions") when sessions ARE logged: use `"Building baseline — needs ~2 weeks of history."`
- Result check: with the athlete's real data (sessions only this week), Home + Analytics must show the baseline message and a green/gray signal, not red.

### 1b. Protein adherence: over target is good
`lib/analytics/improvementMatrix.ts`: the protein row lacks `overIsGood: true`, so 135% renders an ORANGE warning chip while the row's own icon is green — and kcal at 105% shows green next to an orange icon. For a hardgainer athlete (3,300+ kcal phase, "eat more" is the whole fuel story), protein over target is success. Add `overIsGood: true` to the protein-adherence row. Leave kcal as-is (large kcal overshoot IS worth an orange flag).

### 1c. Kill the duplicate number in % rows
The matrix renders `Protein adherence   135 %   [135%]` — the value text and the ProgressChip are the same number twice. In the matrix row component (find where `MatrixRow.current` + `unit` render next to `ProgressChip`): for rows where `isProgressMetric && unit === "%"`, render ONLY the chip (drop the `135 %` value text). Water (unit "L") keeps both — `4.5 L [150%]` is two different facts.

### 1d. Un-truncate "needs more data" hints
On iPhone the matrix hint truncates to `needs more data — log sl...`. Wherever the hint renders with `truncate`, let it wrap (up to 2 lines) or shorten every `needsDataHint` in `improvementMatrix.ts` to fit (`"log sleep"`, `"log a CMJ test"` — drop the "needs more data — " prefix and render it as a quiet caption). Pick one, apply consistently.

### 1e. Error boundary: retry once before showing the wall
`src/app/(app)/error.tsx` shows "Something went wrong" on any transient Supabase pooler hiccup — the athlete hit it cold-opening the app. Make the boundary self-heal: on mount, if this is the first error in the last 30s (sessionStorage counter keyed by `"rtd-err-retry"`), show a quiet "Reconnecting…" spinner state and call `reset()` after ~800ms. If the error re-fires within 30s, show the current card (bump the copy: "Still couldn't reach the database — give it a few seconds and hit Try again."). All state transitions via listener/timeout callbacks, not synchronous effect-body setState (compiler lint).

### 1f. Water: manual amount entry
`WaterLogger.tsx` has only +250/+500/+750 presets — no way to log "1L". Keep the presets, add a fourth affordance: a small inline input (`inputMode="decimal"`, placeholder "L or ml") + Add button. Parse: value ≤ 10 → liters→ml; value > 10 → ml. Clamp to 1–5000ml, call the same `logWaterAction`. One-line helper, no new component file needed.

### Verify & ship P1
Pipeline. Live assertions: `/analytics?tab=overview` HTML — protein row has NO orange chip markup when pct > 110 (assert the chip class/color for the protein row is green); Home HTML contains "Building your load baseline" (given current data) and does NOT contain "Back off intensity"; `/fuel` HTML contains the water input placeholder. Commit `loop 20: ACWR cold-start gate + metric truth + error self-heal + manual water`.

## P2 — Mobile chrome: nothing covers anything (loop 21)

### 2a. Coach FAB must never cover the coach's own Send button
`CoachPanel.tsx` renders the mobile FAB (`md:hidden`, fixed right-4) on EVERY page — including `/more/coach-ai`, where it sits exactly on the chat's Send button. It already has `usePathname()`: return `null` for the mobile Link when `pathname?.startsWith("/more/coach-ai")`.

### 2b. Hide floating chrome when the iOS keyboard is open
Screenshot evidence: with the keyboard up, the fixed bottom dock floated mid-screen over the Analytics cards. Create `src/lib/useKeyboardOpen.ts`: a client hook subscribing to `window.visualViewport` `resize` — keyboard considered open when `visualViewport.height < window.innerHeight * 0.75`. All setState inside the event callback (lint rule). Use it to hide, while the keyboard is open: the mobile `TabBar` (nav gets `display: none`), the CoachPanel mobile FAB, and the `RestPill`. SSR-safe (guard `window.visualViewport` existence; default closed).

### 2c. Content never hides under the dock/FAB
The app scroll container needs guaranteed clearance: on mobile viewports, bottom padding of `calc(env(safe-area-inset-bottom) + 96px)` on the main content wrapper in the `(app)` layout (find the existing main element — adjust, don't wrap new divs). Verify /train's last exercise card and /fuel's last row scroll fully clear of the dock.

### 2d. RestPill vs FAB collision
`RestPill.tsx` centers at `left-1/2` on mobile while the FAB sits at right-4 — on a 375px screen they overlap during rest. Left-align the pill on mobile instead: `left-4 right-auto translate-x-0`, max-width `calc(100vw - 96px)` (leaves the FAB corridor free). Desktop position unchanged.

### Verify & ship P2
Pipeline. Live assertions: `/more/coach-ai` HTML contains NO `aria-label="Open coach"` link markup (FAB suppressed); the app layout HTML contains the new bottom-padding style. Keyboard behavior is client-runtime — verify by code-reading the hook wiring, and note in LOOP_LOG that it needs the athlete's phone to confirm. Commit `loop 21: mobile chrome — FAB/keyboard/dock clearance`.

## P3 — Glass pills everywhere, pixel-perfect (loop 22)

The athlete has now said twice: no solid flat pills. AND the sliding thumbs are visibly off-center — that's real: every absolute-thumb formula (`TabBar.tsx:48`, `TopBar` `:102`, `AnalyticsTabs.tsx:27`, `PeriodSelector.tsx:22`) computes `left` as a percentage of the padding box without accounting for inter-item `gap`s, so the drift grows per index — ~10px right-overhang by the 5th dock item, exactly the misalignment in the screenshots.

**Fix both at once by deleting the absolute thumbs entirely.** In all four places (mobile TabBar, desktop TopBar nav, AnalyticsTabs, PeriodSelector) and in `SegmentedControl.tsx`:
- Remove the absolutely-positioned thumb div.
- Style the ACTIVE item itself as the pill — glass, not solid white: `background: rgba(255,255,255,0.14)`, `border: 1px solid var(--rtd-hairline)`, `backdrop-filter: blur(var(--rtd-blur))` (+ webkit prefix), active text `#fff` (NOT `#0b0b0d` — that black-on-white pairing dies with the white fill), inactive text `var(--rtd-text-secondary)`. Add `box-shadow: 0 0 12px rgba(255,255,255,0.06)` for lift. Transition `background-color`/`color` 200ms so switching still feels animated. An active item styling itself can never be off-center — the drift bug becomes unrepresentable.
- Dock (`TabBar`): active icon + label also `#fff`; keep the glass-blur nav shell as-is.
- Define the pill style ONCE — either a `.rtd-pill-active` class in `globals.css` or a tiny shared style object — so all five surfaces stay identical forever.
- `SwimSessionLogger.tsx` load buttons (solid cyan active) get the same treatment: glass fill tinted cyan (`rgba(90,200,250,0.18)`, cyan text) instead of solid.
- Sweep for other solid-white/solid-color active states: `grep -rn "background: active" src/components` + `grep -rn "#0b0b0d" src` and convert every nav/tab/selector instance (the TopBar `extras` icon buttons included). Buttons that are genuine CTAs (Button.tsx primary) are NOT tabs — leave them.

### Verify & ship P3
Pipeline. Live assertions: `/home` HTML contains zero instances of `#0b0b0d` in nav/tab markup; the dock markup no longer contains the aria-hidden thumb div. Screenshot-level check: use the Browser pane on the PROD login page only (public, no auth needed — it has no tabs, so instead assert via HTML) — rely on HTML assertions + the athlete's next session for visual sign-off. Commit `loop 22: glass active pills everywhere, thumb-drift bug deleted`.

## P4 — Train logging v3: reads like a coach's card, respects your units (loop 23)

### 4a. Unit-aware weights (kg/lb)
`getSettingsRow().weightUnit` is live data; Train ignores it. Storage stays kg everywhere (DB, actions, e1RM, tonnage — untouched). Display/input converts at the edge:
- New `src/lib/train/units.ts`: `kgToDisplay(kg, unit)`, `displayToKg(value, unit)`, `unitLabel(unit)` — lb = kg × 2.20462, display rounded to 0.5.
- Thread `weightUnit` from the train page server component into `WorkoutSession` → `ExerciseCard` (and Home's TodaysPlanCard path if it renders ExerciseCard — check usage).
- `ExerciseCard.tsx`: the `kg` micro-label becomes the unit label; ghost weight, "Last session" lines, SetRow display, and SetRow edit inputs all convert on the way out and back. `handleAddSet`/`updateSetAction` payloads convert input→kg BEFORE calling the action (actions still receive kg — zero server changes).
- Settings page caption under the unit control: "Applies to gym logging + history display. Stored in kg."

### 4b. Set rows that don't look broken
`SetRow` renders `–kg × – @ RPE –` for null fields; a checkbox-completed bodyweight exercise shows four such rows. Rebuild the row text from parts, omitting nulls: weight part only if `weightKg !== null`; reps part `× 6` (or `6 reps` if no weight); RPE part only if non-null. A checkbox-completed Box jump reads `Set 1 · 6 reps`, clean. Same parts logic in the "Last session:" summary lines.

### 4c. Rest start must announce itself
The athlete finished sets not knowing a timer existed. On rest start (`handleAddSet` / after checkbox-complete triggers `onRestStarted`):
- `navigator.vibrate?.(50)` at the handler call site (short "started" tick vs the existing 200ms end-buzz).
- RestPill gets a mount animation (existing `rtd-fade-in` or a new slide-up keyframe, reduced-motion-guarded) plus, for the first 2.5s of a rest, the label reads `Rest started — 3:00` before switching to the countdown (drive it off `now - startedAt`, no extra timers).
- The checkbox-complete flow currently does NOT start a rest timer (only "Add set" does — check `WorkoutSession.handleToggle`): leave that as-is (checkbox = "I did the whole thing", no rest coaching needed) but note it in LOOP_LOG as a deliberate call.

### Verify & ship P4
Pipeline. Live assertions: train page HTML with minted cookie — assert the unit micro-label renders from settings (current setting kg → label `kg` present; can't flip the user's setting live, so ALSO unit-test the converters: tiny `scripts/verify-units.mjs` importing nothing from Next, just re-implement-check 100kg→220.5lb round-trips). Assert no literal `–kg ×` sequence in train HTML. Commit `loop 23: unit-aware train logging + honest set rows + rest-start cue`.

## P5 — Swim tab: organized, AI-first (loop 24)

Current /swim stacks ~14 cards (takeaway, volume, month dots, meet readiness, latest session, SwimHero, meets list, add-meet form, manual session logger, session list, pace chart, time logger, recent times, PBs, split autopsy, time-to-15m, stroke counts). The athlete called it what it is: a mess. And the ONE thing they wanted — "type my whole swim sesh and have AI organize + log it" — exists (`ImportSessionButton`) but is invisible on this page.

### 5a. Structure: three sub-sections via SegmentedControl
Client wrapper with the (now glass) `SegmentedControl`, state in the URL (`/swim?view=log|meets|analysis`, default `log`) so it stays a server-rendered page per view — same Link-param pattern as AnalyticsTabs. Distribution:
- **Log** (default): AI import hero (5b), weekly volume, month dots, latest imported session, session list, pace chart.
- **Meets**: meet readiness card, SwimHero, meets list + add-meet form, time logger, recent times.
- **Analysis**: PBs vs goal, split autopsy, time-to-15m, stroke counts.
Everything currently rendered must land in exactly one view — nothing dropped, nothing duplicated. Keep the takeaway strip above the selector on all views.

### 5b. AI import is the hero
Top of the Log view: a prominent glass card — title "Log a swim", caption "Type or paste your session exactly how you'd tell a teammate — AI structures and logs it.", one primary button opening the existing `ImportSessionButton` flow (controlled mode, `hideTrigger` — same pattern QuickLogSheet already uses). The manual `SwimSessionLogger` collapses behind a quiet "Log manually instead" disclosure under it.

### 5c. Import must never dead-end
`ImportSessionButton` parse failure currently says "try again, or log it manually in Train" — a dead end mid-poolside. Add a second button to the error state: **"Save as unstructured"** — saves via `logSwimSessionAction({ loadRating: 5, setsText: <raw text> })` (import `from "@/app/(app)/analytics/actions"`), with a small load-rating input (1–10, default 5) beside it. The session lands in the log with raw text; distance/pace just won't parse. Logging is never blocked by parsing.

### 5d. Meet readiness card: no wall of dashes
`SwimMeetReadinessCard` currently renders 5 event rows of `— → 29.78 —` when zero times are logged. When NO event in a meet has a logged time, collapse to one line: meet name + days-out chip + "Log your first times to project readiness" linking to the Meets view's time logger. Rows return as real data appears.

### Verify & ship P5
Pipeline. Live assertions with minted cookie: `/swim` (default) HTML contains "Log a swim" and does NOT contain the split-autopsy heading; `/swim?view=analysis` contains the split-autopsy heading and not "Log a swim"; `/swim?view=meets` contains the add-meet markup. Commit `loop 24: swim tab reorganized — AI-first logging, three views`.

## P6 — The coach gets hands: tool calling (loop 25)

Today `api/coach/chat/route.ts`'s system prompt declares the coach read-only. The athlete wants the opposite: "the AI is the app." Give the in-app coach the same write powers the MCP connector has, via Groq function calling (`llama-3.3-70b-versatile` supports `tools` on the same endpoint).

### 6a. Tool loop in `lib/ai/groq.ts`
New `callGroqChatWithTools(messages, tools, executeTool, opts)`: non-streaming POST with `tools` (OpenAI function schema) + `tool_choice: "auto"`. Loop: if the response has `tool_calls`, execute each via `executeTool(name, parsedArgs)` (JSON.parse guarded), append the assistant tool-call message + `role:"tool"` results, re-call. Max **4** rounds, then force a final call with `tool_choice: "none"`. Same never-throw contract as the rest of the file (null on failure). Timeout 20s per round.

### 6b. Coach tools — `src/lib/coach/tools.ts`
Define schema + executor for these, each delegating to the SAME lib/db functions the existing server actions use (import the underlying query/mutation helpers, NOT the "use server" action files; call `revalidatePath` on the routes each mutation affects, mirroring what its action revalidates):
- `log_water(ml)` · `log_meal(name, kcal, protein_g)` (reuse the quick-log meal insert path) · `log_sleep(hours)` · `log_weigh_in(kg)` · `log_soreness(area, rating_1_5)`
- `log_swim_session(raw_text, load_rating)` — insert via the same path as `logSwimSessionAction`, and run the existing set-parser (`lib/swim/parseSets.ts`) on the text for distance, exactly as that action does.
- `log_swim_time(event, time_seconds, meet_name?)`
- `log_gym_set(exercise_name, weight_kg?, reps, rpe?)` — resolve exercise by the same fuzzy-match logic `ImportSessionButton.fuzzyMatchId` uses against TODAY's session exercises; if no match, the tool returns `{error: "no exercise named X today — options: [...]"}` and the model relays it.
- `update_water_target(ml)` · `update_training_status(status, since_date)` — through the settings update path.
- `update_coach_memory(text)` — same upsert as `updateAthleteModelAction`.
- `undo_last(kind)` — kind ∈ water|meal|sleep|weigh_in|soreness|swim_session|swim_time|gym_set: delete the single most-recent row of that type (today only — refuse with an error result if the newest row isn't today's). This is undo, not history editing.
- `get_today_summary()` — read-only fetch of today's fuel/water/sets/swim so the model can answer "what have I logged?" precisely without stuffing more into the base context.
Every executor returns a short JSON result string (`{ok:true, logged:"500ml water, total 2.1L"}` style) — the model needs totals to confirm naturally.

### 6c. Rewire the POST route
`api/coach/chat/route.ts`: replace the read-only paragraph of SYSTEM_PROMPT with: the coach CAN log and edit via tools; confirm each write in one short line with the resulting total/state; ask a clarifying question rather than guessing ambiguous amounts; never invent data. Flow: run `callGroqChatWithTools` first (it returns the final content after any tool rounds). Stream-shape compatibility: wrap the final string in a single-chunk `ReadableStream` so `CoachChat.tsx` needs zero changes. Persist user + assistant messages exactly as today. If the tool loop returns null, fall back to the current no-tools streaming path (coach degrades to advisory, never errors out).
- `quickPrompts.ts`: add per-path write prompts — Fuel: "Log 1L of water"; Train: "Log my last set"; Swim: "Log today's swim: "; Home: "What have I logged today?".
- Context stays as-is otherwise — `get_today_summary` covers drill-down.

### 6d. Chat input QoL
`CoachChat.tsx`: textarea auto-grows 1→4 rows (set `style.height` from `scrollHeight` in the onChange handler — a DOM-event callback, lint-safe), so multi-line swim sessions are typeable.

### Verify & ship P6
Pipeline. Live verification with minted cookie via throwaway script: POST "log 300ml of water" → assert response text mentions water/300; then GET the fuel page data path (or POST "what have I logged today?") → assert the total reflects +300ml; then POST "undo that" → assert confirmation. (This writes+removes 300ml of water on prod — acceptable, it's the athlete's own test data; end state net-zero.) Commit `loop 25: coach tool-calling — the AI can log and edit + phase-4 wrap`.

Then: prepend the LOOP_LOG.md phase-4 wrap-up entry (loops 20–25 summary, mirroring the phase-3 wrap format), and report to the user: `git log --oneline -8`, what each loop shipped in one line each, and the live URLs worth a glance on their phone: `/home`, `/swim`, `/train/p2`, `/analytics?tab=overview`, `/fuel`, `/more/coach-ai`. No preview links — everything already deployed and self-verified.
