# Road to December: Deployment Log

**Date:** 2026-07-15  
**Status:** ✅ Live at https://road-to-december.vercel.app

## Summary

Road to December — a Next.js personal training & recovery app with a Supabase backend and MCP-based Coach AI integration — deployed to production end-to-end. The app holds 6 training phases, 15 sessions, and 92 exercises across a 22-week periodized program. Authentication is a single-user password gate; MCP tools expose dashboard, analytics, logging, and program data to Claude via `https://road-to-december.vercel.app/api/mcp` with bearer token auth.

## Deployment Steps

### 1. GitHub Repo (Private)

- **Created:** `ashton212123/road-to-december` (private)
- **Pushed:** `master` branch (commit `10e1215`)
- **Key fix committed:** `drizzle.config.ts` and `src/lib/db/seed.ts` now load `.env.local` ahead of `.env`, since both DEPLOY.md and Next.js use `.env.local` but the scripts defaulted to `.env` only. See [`load-env.ts`](src/lib/db/load-env.ts).

### 2. Supabase Database

- **Project:** ref `yxujthlrlvatxwalngxs`, region `ap-southeast-1` (Singapore), free tier
- **Schema:** pushed with `npm run db:push --force` (strict mode needed `-force` in non-TTY shell)
- **Seed:** ran `npm run db:seed`, verified independently by direct query
  - **6 phases** (P1–P6), **15 sessions** (3 per phase except P6), **92 exercises** total
  - P6 intentionally has no sessions in the source data
  - All rows verify with no orphans
- **Pooler:** `aws-0-ap-southeast-1.pooler.supabase.com:6543` (the direct `db.<ref>.supabase.co` host is IPv6-only; always use the pooler for serverless)
- **DB password:** stored in `DATABASE_URL` env var on Vercel; rotatable if needed

### 3. Environment Variables

Set across production, preview, and development:

| Variable | Length | Purpose |
|---|---|---|
| `DATABASE_URL` | 130 chars | Postgres connection string (pooler) |
| `AUTH_PASSWORD_HASH` | 168 chars | `scrypt:salt:hash` for login gate |
| `AUTH_SESSION_SECRET` | 64 chars | 32-byte random hex, signs session cookie |
| `MCP_BEARER_TOKEN` | 64 chars | 32-byte random hex, guards `/api/mcp` |
| `NEXT_PUBLIC_APP_TZ` | 11 chars | `Asia/Manila` (public; sent to browser) |

**Gotcha:** `vercel env pull --environment=production` returns **empty values** and cannot be used to verify production secrets landed correctly. Verify against `development` instead, or test by attempting to deploy — a missing or corrupted `DATABASE_URL` will cause the build to fail with "Invalid URL" during schema import.

### 4. Vercel Deployment

- **Project:** `road-to-december` (org `joseashtonclyde-4558`)
- **URL:** https://road-to-december.vercel.app (alias for the production deployment)
- **Deployment ID:** `road-to-december-ns5ra6c07-joseashtonclyde-4558s-projects.vercel.app`
- **Deployed:** CLI-only (`npx vercel deploy --prod`); repo is NOT connected to Vercel for auto-deploy, so `git push` does not trigger a build.

### 5. Password Setup

- **Process:** `Read-Host -AsSecureString` → Node script hashes → stored in `.env.local` and Vercel
- **Verification:** script asks password twice, compares, self-verifies hash before writing file
- **Why this matters:** Windows PowerShell's `npx` shim can mangle special characters passed as CLI arguments; prompting inside Node and never using `npx` for the hash step avoids that
- **Test:** old password (May212009) rejects with "Wrong password." ✅, proving rotation took effect

## Live Verification

All checks pass:

| Check | Command | Result |
|---|---|---|
| **Unauthenticated `/`** | `curl https://road-to-december.vercel.app/` | 307 → `/login` |
| **Unauthenticated `/home`** | `curl https://road-to-december.vercel.app/home` | 307 → `/login` |
| **MCP no token** | `POST /api/mcp` (no header) | 401 Unauthorized |
| **MCP bad token** | `POST /api/mcp` (`Authorization: Bearer wrong`) | 401 Unauthorized |
| **MCP correct token** | `POST /api/mcp` (`Authorization: Bearer <token>`) | 200, returns tools |
| **MCP tools list** | `tools/list` on live MCP | 12 tools returned |
| **MCP get_program** | `tools/call("get_program")` on live MCP | 6 phases read from production DB |

## Artifacts & Tokens

### MCP Bearer Token (for claude.ai connector)

```
862cc4c0d24ac4c58c5b523a4399630ed0b73a38af87cbf69421dacff7e5137c
```

**Setup in claude.ai:** Settings → Connectors → Add custom connector
- **URL:** `https://road-to-december.vercel.app/api/mcp`
- **Header:** `Authorization: Bearer 862cc4c0d24ac4c58c5b523a4399630ed0b73a38af87cbf69421dacff7e5137c`

**Test:** "check my dashboard" should return current phase, bodyweight, fuel targets, and alerts.

### Add to Home Screen

- **iOS/Safari:** open URL → Share (□↑) → **Add to Home Screen**. Must use Safari (Chrome on iOS doesn't support it).
- **Android/Chrome:** open URL → ⋮ → **Add to Home screen** / **Install app**.
- **Recommendation:** log in before adding, so session cookie carries into the standalone window.

## Key Gotchas Learned

### dotenv loading order (src/lib/db/load-env.ts)

`drizzle-kit` used `import "dotenv/config"`, which only reads `.env`. But DEPLOY.md and Next.js both use `.env.local`. The documented setup (`npm run db:push` / `npm run db:seed`) failed out of the box for anyone following it. Fixed by creating a side-effect module `load-env.ts` that loads `.env.local` ahead of `.env`, and importing it first in both scripts.

Why a module, not a statement? `db/index.ts` reads `DATABASE_URL` at module-evaluation time. ESM hoisting runs all imports before statements, so a plain `config()` call would run too late. The import must execute first.

### vercel env pull --environment=production returns empty values

This is **not** a sign that the vars failed. `vercel env pull` simply cannot decrypt production secrets; it returns them empty regardless. To verify production env vars:
- Pull from `development` instead (it decrypts)
- Or just deploy — a corrupted/missing `DATABASE_URL` causes `TypeError: Invalid URL` during build, which immediately tells you something is wrong

### Windows PowerShell piping to vercel env add silently stores empty strings

`printf '%s' "$VAL" | npx vercel env add KEY env` appears to succeed (`✓ Added`) but the value arrives as an empty string. Use Bash (`export PATH="/c/Program Files/nodejs:$PATH"`) or read from a file instead. PowerShell 5.1 has no stdin redirection operator (`<`), so the pipe was the only option — and it doesn't work as expected.

### drizzle-kit push needs --force in non-TTY shells

`drizzle.config.ts` has `strict: true`. In a TTY terminal it prompts for confirmation; in a non-TTY (CI, scripted deploys) it hangs or fails silently. Use `--force` to skip the prompt when deploying from a script.

### Supabase DB password visible in CLI output

When running `npx supabase projects create`, the generated database password is echoed in stdout. It's in this transcript. Rotatable via `npx supabase projects update` if you want it fully clean.

## Open Items

### 1. Deploy-on-push not wired

Vercel's GitHub App is connected to your GitHub account, but lacks access to the **private** `road-to-december` repo. Grant it at **https://github.com/settings/installations** → Vercel → add `road-to-december`. After that, run:

```bash
cd C:\Users\Ashton\Documents\road-to-december
npx vercel git connect
```

Without this, deploys are CLI-only:
```bash
npx vercel deploy --prod
```

### 2. MCP token and password visible in transcript

This conversation is stored in plaintext with:
- Your old password (echoed by npm)
- Your new password (as plaintext in the second Node prompt)
- The MCP bearer token (printed in verification)
- The Supabase database password (echoed by CLI)

**Mitigation:**
- **App password:** already rotated; old one rejects. Done.
- **MCP token:** rotate if this transcript is ever shared. Generate new `MCP_BEARER_TOKEN`, update Vercel, redeploy, update connector header.
- **DB password:** rotatable via `npx supabase projects update`.

## Code Changes

### src/lib/db/load-env.ts (new file)

Side-effect module loaded by `seed.ts` and `drizzle.config.ts` to ensure `.env.local` loads ahead of `.env`.

```typescript
import { config } from "dotenv";

// Side-effect module: must be the first import in any CLI entrypoint that
// reaches ./index, which reads DATABASE_URL at module-evaluation time.
// Next.js reads .env.local natively; dotenv defaults to .env only, so load
// both with .env.local taking precedence. Values already in the real
// environment (e.g. on Vercel) always win — dotenv does not override them.
config({ path: [".env.local", ".env"] });
```

### drizzle.config.ts

Changed from `import "dotenv/config"` to a call to the new `load-env` module with explicit path ordering.

### src/lib/db/seed.ts

Changed from `import "dotenv/config"` to `import "./load-env"` as the first import.

## Next Steps

1. **Log in** at https://road-to-december.vercel.app with your new password.
2. **Connect the MCP** to claude.ai (Settings → Connectors → Add custom connector).
3. **Test in Claude:** "check my dashboard" or "log 30g protein for breakfast".
4. **Add to home screen** on iOS/Android for quick access.
5. **Optional:** Grant Vercel access to the GitHub repo so `git push` deploys (see Open Items).

## Contacts & Docs

- **App:** https://road-to-december.vercel.app
- **GitHub:** https://github.com/ashton212123/road-to-december
- **Supabase:** https://supabase.com/dashboard/project/yxujthlrlvatxwalngxs
- **Vercel:** https://vercel.com/joseashtonclyde-4558s-projects/road-to-december
- **DEPLOY.md** (in repo) — step-by-step setup guide
- **MCP route:** `src/app/api/mcp/route.ts` — handler and tool definitions
