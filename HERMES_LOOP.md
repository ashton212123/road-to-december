# The Loop — Hermes drives Claude Code to improve Road to December autonomously

Goal: the app gets better progressively WITHOUT Ashton prompting Claude each time.
Hermes = operator (picks work, launches Claude Code, verifies, reports to Telegram).
Claude Code = engineer (implements one backlog item per iteration).
Ashton = product owner (feeds wishes via Telegram, promotes to production with one command).

## The iteration protocol (Hermes runs this; also usable as its skill definition)

Each iteration, in the repo `C:\Users\Ashton\Documents\road-to-december`:

1. **Preflight:** `git status` must be clean and `npm run build` green. If build is red, this iteration becomes a fix-build iteration — nothing else.
2. **Pick work:** topmost unchecked item in `BACKLOG.md` (Telegram-injected items marked `[URGENT]` jump the queue). One item per iteration, never more.
3. **Launch Claude Code headless** with this prompt template:

   > You are doing one iteration of an autonomous improvement loop on Road to December (this repo). Read `LOOP_LOG.md` (last 3 entries) for context and `BACKLOG.md` for the current item. Implement EXACTLY this item, nothing else: "{ITEM}". Constraints: no schema changes (if the item needs one, stop and output `BLOCKED: needs schema — {what}`); no new dependencies unless the item names one; no deploys; keep all existing behavior outside the item's scope; match existing design system and code style. Definition of done: lint + build green, and for UI work a Playwright screenshot at 390px and 1280px of the affected screen saved to `loop-artifacts/`. Finish by outputting exactly one line: `DONE: {one-sentence summary}` or `BLOCKED: {reason}`.

4. **Verify independently** (never trust the report alone): run `npm run lint` and `npm run build` yourself; check exit codes; for UI items confirm screenshots exist and eyeball them.
5. **Green →** `git add -A && git commit` (message: `loop: {item}`), run `npx vercel deploy` (**preview** — NEVER `--prod`), tick the item in BACKLOG.md, append a LOOP_LOG.md entry (date, item, what changed, preview URL, learnings), send Telegram report: item + one-line result + preview URL.
6. **Red or BLOCKED →** restore clean tree (`git stash -u && git stash drop`), mark the item `[blocked: reason]` in BACKLOG.md, report to Telegram. Never leave the tree dirty.
7. **Stop conditions:** 2 consecutive red iterations → pause loop, tell Ashton. Any schema need → flag, never push. Iteration > 45 min → kill, mark blocked.

## Hard guardrails (non-negotiable, baked into every prompt)

- **Production is human-only.** The loop deploys previews. `npx vercel deploy --prod` runs ONLY when Ashton sends `deploy prod` on Telegram after checking a preview.
- **Schema is human-gated.** No `drizzle-kit push` unattended, ever. Blocked items list what migration they need; Ashton approves with `approve schema` and that specific iteration may run it.
- **Secrets untouched.** Never read/print/modify `.env*`, `mcp-token.txt`, or Vercel env.
- **Commit every green iteration; never force-push; never rewrite history.**
- **Budget:** max 2 scheduled iterations/day (cron 13:00 + 21:00, PC-on hours) + `run now` on demand — protects the Claude subscription from a hot loop.

## Telegram commands (Ashton → Hermes)

`status` · `add: <wish or bug>` (goes to backlog, phrased as a testable item) · `urgent: <item>` · `run now` · `pause` / `resume` · `deploy prod` · `approve schema`

The magic loop: you notice something mid-day → text "add: the dock overlaps the keyboard when typing in coach" → tonight's iteration fixes it → you get a preview link → "deploy prod". No Claude session, no prompting, ever.

## Claude Code permissions for headless runs

Add to `.claude/settings.local.json` allowlist so iterations don't stall on prompts: `npm run lint`, `npm run build`, `npx playwright *`, `git add/commit/status/diff/stash`, `npx vercel deploy` (WITHOUT --prod). Run headless with edits auto-accepted; the allowlist + guardrail prompt is the safety envelope. Do NOT allowlist `--prod`, `drizzle-kit push`, or `vercel env`.

## One-time setup (Ashton)

1. Finish `hermes setup` (Quick Setup, free) + Telegram gateway (see HERMES_SETUP.md steps 1–2).
2. Enable Hermes's bundled `claude-code` skill; tell Hermes: "Adopt the iteration protocol in `HERMES_LOOP.md` of C:\Users\Ashton\Documents\road-to-december as a skill named rtd-loop; schedule it 13:00 and 21:00 daily; report every iteration to me on Telegram."
3. Confirm the first iteration end-to-end while watching, then let it run.

## Ground rules for the backlog itself

Items must be small (one iteration ≈ one sitting), testable ("fix X so Y" not "make better"), and scoped to one screen/module. Hermes rewrites Ashton's raw Telegram wishes into this shape before queuing. Big multi-phase work (like the V-series revamps) stays OUT of the loop — those remain Fable-planned prompt packs; the loop is for the long tail of polish, bugs, and small features.
