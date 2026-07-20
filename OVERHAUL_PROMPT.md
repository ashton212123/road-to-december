# Road to December — Total Overhaul Prompt

Paste everything below the line into Claude Code (Sonnet 5) in the repo `C:\Users\Ashton\Documents\road-to-december`. It pauses once — after the Phase 0 rethink — then executes everything.

---

You are overhauling Road to December (this repo): my personal training app for a competitive swimming season ending at NCAA Dec 4. Next.js 16 + Tailwind 4 + Drizzle + Supabase (Singapore, `ap-southeast-1`), deployed on Vercel. I am the only user, I live in the Philippines, and I use it every day on phone and PC. I've used it for weeks and parts of it are painful. Act as a senior product designer, performance engineer, AI systems architect, swimming coach, and Apple interface designer who has personally used this app all season. Question every screen, flow, click, query, and assumption. If a better workflow exists, replace mine. I care about: speed, simplicity, clarity, zero friction, beautiful UI, delightful motion. Nothing is sacred except my data and the working login + MCP server.

## Verified root causes — confirm quickly, then fix (don't rediscover from scratch)

1. **Region mismatch = the lag.** There is no `vercel.json`; Vercel functions run in the default US region while Supabase is in Singapore and I'm in the Philippines. Every DB query pays a transpacific round trip.
2. **N+1 queries on the workout page.** `src/app/(app)/train/[phaseId]/page.tsx` runs `getLastSessionSetsForExercise` + `getTodaysSetsForExercise` per exercise (each pulling 30–60 rows). ~8 exercises = 16+ queries per render — and every checkbox click calls `revalidatePath`, re-running ALL of it before the UI updates. That's multi-second checkboxes.
3. **Zero optimistic UI.** In `ExerciseCard.tsx`, `completed` derives from server props, so the checkbox doesn't visually flip until the full round trip + rerender finishes. The app feels frozen on every interaction.
4. **The "no weight" problem.** The `exercises` schema has `prescription` (raw string), `targetSets`, `targetRepsMin/Max` — but NO prescribed load. Checkbox completion (`completeExerciseAction`) falls back to "last session's top weight", which is null with no history, so sets save as `–kg`, and then Analytics/e1RM/home treat my workout as if I never lifted. I checked the box; the app should never claim I didn't lift.

## Phase 0 — Rethink (the ONLY pause)

Before any code: write `RETHINK.md` — concise, decisions not essays: (a) every pain point you can find in the current app, from code-reading the flows as if you'd used them daily; (b) the new information architecture and per-screen purpose; (c) the workout-flow redesign; (d) the AI-coach architecture; (e) a kill list — every feature/page/click you're deleting or merging and why; (f) the assumptions you're replacing. Then STOP and show me. After I say go, execute all remaining phases continuously — report after each phase but don't wait for permission (that includes follow-on discoveries: decide and proceed).

## Phase 1 — Performance foundation (perf is a feature, do this first)

- Add `vercel.json` pinning functions to `sin1` (Singapore) — colocated with Supabase and me.
- Kill every N+1: one batched query per screen load (the workout day needs exactly one query for today's sets + one for last-session sets across ALL exercises of the session — or a single SQL with a window; you choose).
- New interaction architecture for every hot path (workout logging, food logging, water, checkboxes everywhere): client component owns state, updates INSTANTLY on tap, saves in the background (server action without `revalidatePath` on the hot path), reverts with a toast only on failure. `useOptimistic`/local state — your call, but the standard is: perceived latency of any tap < 100ms, always.
- Skeleton loaders for every server-rendered screen; no blank flashes; `loading.tsx` per route group.
- Audit remaining pages for redundant queries and sequential awaits; batch and parallelize. Cache stable data (the program/phases never change mid-session) in-process.

## Phase 2 — Workout system rebuild (the biggest pain — get this perfect)

The entire interaction model is one checkbox per exercise:

- **Prescribed = default.** Add prescribed load to the data model (migration on `exercises` or program data — additive, don't lose my logged sets). Seed sensible prescriptions from the program + my history where possible. Checking ☑ means: done exactly as prescribed — sets × reps @ prescribed weight (fallback chain: prescribed → progression suggestion → last session → bodyweight/null-but-NEVER-nagged). One tap, instant green, background save, done.
- **Overrides optional, never required.** Expand a completed exercise to change weight/reps/RPE/notes for any set. Editing marks it custom; nothing ever asks, warns, or blocks. The strings "you didn't enter a weight" or any equivalent must be impossible anywhere in the app — Analytics and Home must treat checkbox-completed sets as fully real lifts with their default weights.
- **Today-first flow.** From Home: "Today's workout" → straight into the session (no phase → day navigation for the common case). Day/phase browsing stays for planning. Switching days must not full-round-trip render.
- **Session completion moment.** When the last exercise is checked: a satisfying summary (duration, tonnage, PRs hit, completion streak) with a clean spring animation. Logging a workout should feel like closing rings, not filing taxes.
- Keep: rest timer (auto between sets when expanded), last-session line, progression suggestions — but progression should now update the prescribed default so "check = the right weight" over time.

## Phase 3 — Home = command center

Open the app → instantly know: how I'm improving, what needs attention, what's today, what's next, how close to my goals. Apple Fitness × Whoop × Linear. Candidate modules — keep only what earns its place with real data behind it: today's workout + swim (with one-tap start), readiness/recovery, countdowns (NCAA / ASEAN), current phase + week progress, weekly completion + streaks, PRs and recent achievements, bodyweight trend sparkline, nutrition rings summary, AI coach daily brief (Phase 5), risk alerts. Dense, glanceable, zero clutter; every module taps through to its screen.

## Phase 4 — Analytics that answer questions

Not chart dumps — answers: Which lift improved most? Am I plateauing and why? How does gym volume relate to swim times? Weekly/monthly volume + training load and fatigue trends (acute:chronic), consistency by weekday, e1RM progression per main lift (now always populated thanks to Phase 2 defaults), swim event progression with predicted race times (flag as estimates), bodyweight vs. bulk target, nutrition adherence. Each section leads with a one-line plain-English takeaway computed from the data ("Squat e1RM +8% this block; bench flat 3 weeks — likely why: bench volume down 40%"). Where a takeaway needs judgment, generate it with the Phase 5 coach layer and cache it.

## Phase 5 — AI coach everywhere (Groq) + Obsidian brain

The AI IS the app, not a bolted-on page:

- **Engine:** Groq free tier, env `GROQ_API_KEY` (I'll create it at console.groq.com when you ask — add to `.env.local` AND Vercel via the Bash tool: `printf '%s' "$v" | npx vercel env add GROQ_API_KEY production` — PowerShell piping silently stores empty values, see DEPLOY.md). Pick Groq's current best free model (llama-3.3-70b-versatile class); JSON mode where structured, streaming for chat.
- **Context assembly layer** (one module, reused everywhere): a structured snapshot of EVERYTHING — goals, meets/countdowns, current phase, full training history summaries, PRs, e1RMs, swim times + trends, nutrition targets + adherence, sleep, soreness, CMJ, readiness, bodyweight, streaks, alerts — token-budgeted and cached per day.
- **Obsidian:** my vault is `C:\Users\Ashton\Documents\Ashton OS`. Vercel can't read my disk, so build a local sync script (`npm run sync:vault`) that reads an include-list of folders (ask me which — default to training/goals/journal-adjacent ones, NEVER private folders), chunks the markdown into a new `knowledge` table in Supabase with note path + modified date, and upserts. Coach retrieval: simple relevance scoring (keyword/title/recency) into the context budget — no embeddings infra needed at my scale. Re-run sync manually whenever I want; note vault text goes to Groq's API, so include-list only.
- **Chat:** full-screen coach chat (promote out of More — this replaces the static Coach AI page; keep the MCP instructions accessible somewhere). I can ask anything: "Why was I slower today?", "Should I deload?", "Predict my 200 breast", "Summarize my journal this week", "What should I eat today?" Streaming, chat history persisted, quick-prompt chips.
- **Proactive:** a daily coach brief generated on first Home load each day (cached in DB): readiness read, yesterday's gaps, today's focus, one insight from trends. Short, direct, coach-voiced. Also power Phase 4's judgment takeaways with this layer. Existing rule-based alerts stay as the zero-latency layer; AI enriches, never replaces.

## Phase 6 — Design overhaul: 2027 Apple, liquid glass, get crazy (tastefully)

Forget incremental. Inspirations: visionOS liquid glass, Apple Fitness, Arc, Linear, Raycast, Flighty. Dark, premium, minimal, buttery:

- Layered glass materials (background glow → translucent panels → floating controls) with 0.5px hairlines and inner highlights; depth via soft shadow + blur discipline — `backdrop-filter` ONLY on small floating surfaces (tab bar, sheets, popovers), never on long scrolling lists (it kills scroll FPS).
- A real motion system: spring-based (CSS springs or a tiny motion lib), 150–350ms, transform/opacity ONLY (no layout-property animation), staggered list entrances, number tweens on stats, animated ring fills, fluid page transitions (View Transitions API), hover states on every interactive element on desktop, satisfying press feedback everywhere, skeletons that shimmer. All gated behind `prefers-reduced-motion`.
- The existing HIG type scale, iOS dark palette, and 8pt rhythm stay the foundation — this pass makes it feel alive, not different.
- 60–120fps standard: profile any interaction that stutters and fix the cause, don't mask it.

## Phase 7 — Ship

Full pass over every screen at 390px and 1280px+ (screenshot everything, fix what looks off without asking), a11y sweep (labels, focus order, contrast), lint + build green, then deploy: `npx vercel deploy --prod` (CLI-only — GitHub push does NOT deploy). Run `drizzle-kit push` with `--force` (non-TTY). Verify the live site after deploy, including one real workout checkbox on production timing.

## Hard rules

- Product thinking beats preservation: delete features that don't earn their place, merge pages, collapse 5 clicks into 1. If a flow needs instructions, redesign it.
- My data is sacred: migrations additive/backfilled, never destructive; existing logs, login, and the `/api/mcp` server keep working.
- Never require input the app can default. Never nag. Checked = done.
- Verify with the browser preview at every phase — screenshots, console clean, interaction latency actually felt.
- Windows notes: Node lives at `C:\Program Files\nodejs` (prepend to PATH in shells if missing); Vercel env vars via Bash printf, never PowerShell pipes.
