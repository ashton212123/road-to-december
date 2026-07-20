# Loop Log — one entry per iteration, newest first

## 2026-07-20 — Iteration 1: sessions that "don't count" + water contradiction

**Found by:** live audit (authed browser at 390px + MCP `get_training_log` cross-check).
**Root causes fixed:**
1. `computeConsistencyPct` only credited sessions logged on phase-planned days — Ashton's Jul 17 session (off-schedule Friday) scored 0/6 consistency. Now any logged gym date in the 28-day window counts toward done; pct capped at 100.
2. `computeDailySessionLoads` dropped any session with no RPE on any set (`rpes.length === 0 → continue`) — the same Jul 17 session (all sets RPE-less) vanished from Training Load, ACWR, and tripped the "tracking starts after your first logged gym session" empty state. Now RPE-less sessions assume moderate sRPE 5 instead of vanishing.
3. Analytics water matrix cell showed "Not enough data yet" beside a live "4.5 L · 150%" value — Sparkline's internal fallback text clashed with cell-level empty states. Sparkline now renders a quiet spacer; callers own empty-state copy.
4. `TrainingStatusControl` segmented buttons had no `aria-pressed` (active state was style-only).
5. Loop infra: ESLint was scanning `.claude/worktrees/**/.next` build artifacts (hundreds of fake errors); added `.claude/**` to globalIgnores + gitignored agent-state dirs.

**Verification:** trace with real data (Jul 17 log → 1/6 = 17% consistency, load 50); `npm run lint` + `npm run build` green.
**Learnings:** the browser pane holds an authed session for road-to-december.vercel.app (prod cookie domain only — previews won't inherit it). Analytics matrix uses calendar-week-to-date, so Monday mornings look empty — backlogged, not fixed here.
