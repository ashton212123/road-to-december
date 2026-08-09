# Hermes Agent × Road to December — Setup & Role Plan

Hermes Agent (Nous Research) is INSTALLED at `C:\Users\Ashton\AppData\Local\hermes`
(config.yaml, .env, SOUL.md created; 73 bundled skills synced; `hermes` on PATH after a terminal restart).

## The architecture — who does what (don't blur these)

| Layer | Job | Access |
|---|---|---|
| **Claude Code** (Fable plans → Sonnet executes) | ALL engineering: features, fixes, deploys | Repo, Vercel, Supabase |
| **In-app Groq coach** | Instant answers inside the UI | App DB via server |
| **Hermes** | 24/7 ambient coach in your pocket: log by texting, morning briefs, nudges, learns you across the season | App **MCP server only** + local Obsidian vault + Telegram |

**REVISED (see HERMES_LOOP.md):** Hermes ALSO operates the autonomous engineering loop — it drives headless Claude Code sessions against the backlog, verifies, commits, and ships **preview** deploys. The boundaries that remain absolute: production deploys and schema migrations are human-gated (Telegram `deploy prod` / `approve schema`), and secrets are untouchable. Full protocol + guardrails in `HERMES_LOOP.md`.

**Why Hermes earns its place:** the app has no push notifications — Hermes closes that gap (proactive Telegram briefs/nudges via its cron). Its persistent memory + user modeling grows across the season, and it can read your vault locally (no sync needed, unlike the Vercel app).

## Your 15-minute checklist (interactive steps only you can do)

1. **Finish setup** — open a NEW terminal (PATH just changed): `hermes setup` → choose **1. Quick Setup (Nous Portal)** — free OAuth, no API keys. Then test with `hermes` (just chat).
2. **Telegram** — in Telegram: @BotFather → `/newbot` → copy the bot token → `hermes setup` (messaging section) or `hermes config edit` → paste token → run `hermes gateway` → message your bot. (Guide: hermes-agent.nousresearch.com/docs/user-guide/messaging/)
3. **Connect the app (MCP)** — follow hermes-agent.nousresearch.com/docs/guides/use-mcp-with-hermes to add:
   - URL: `https://road-to-december.vercel.app/api/mcp`
   - Header: `Authorization: Bearer <token>` — the token is in `mcp-token.txt` in this repo (don't commit it anywhere else).
   - Then test in chat: "check my dashboard" / "log 500ml water" / "log dinner: adobo and 2 cups rice".
4. **Obsidian** — enable the bundled `obsidian` skill; point it at `C:\Users\Ashton\Documents\Ashton OS`, folders `00 Dashboard`, `01 Projects`, `02 Areas`, `04 Journal` only (same include-list as the app's coach; vault text goes to the model provider, so keep the list deliberate).
5. **Personality** — edit `C:\Users\Ashton\AppData\Local\hermes\SOUL.md`: tell it it's your swim coach (NCAA Dec 4, ASEAN Nov 25 unconfirmed, 63kg, 200 breast focus, bulk to Aug 30), direct tone, no fluff, protein-first nagging allowed when you haven't logged by 20:00.
6. **Proactive briefs (its cron)** — ask Hermes itself to schedule: (a) 06:00 morning brief — pull dashboard via MCP, summarize today's sessions + readiness + yesterday's gaps to Telegram; (b) 20:00 check — if protein < target, one nudge. It creates these as skills/cron entries; they persist.
7. **Security defaults** — keep command approval ON; you can filter which MCP tools Hermes may use in its MCP config (all 25 of the app's tools are safe personal-logging tools, so full access is reasonable).

## Costs & uptime (your zero-cost rule)

- **Now (free):** runs on your PC — briefs/nudges only fire while it's on. Nous Portal quick setup is free-tier OAuth.
- **Later (optional, ~$5/mo or near-zero serverless):** move it to a VPS or its Modal/Daytona serverless backends ("hibernates when idle") for true 24/7. Not needed to start.

## Claude ↔ Hermes

Hermes ships a `claude-code` skill — it can *ask* Claude Code to do engineering work in a repo. Leave that OFF for this project (boundary above). If you ever want it, the flow is: Hermes drafts the request → you paste it into a Claude Code session yourself → review stays human.
