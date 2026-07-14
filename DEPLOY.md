# Deploying Road to December

This app is a normal Next.js app: a Supabase Postgres database (free tier)
and a Vercel deployment (free tier). Everything below is a one-time setup.

## 1. Supabase (database)

1. Create a project at [supabase.com](https://supabase.com) (free tier).
2. In the dashboard: **Project Settings → Database → Connection string → URI**.
   Use the **Transaction pooler** connection string (port `6543`) — this is
   the one that works from Vercel's serverless functions. It looks like:
   ```
   postgresql://postgres.xxxxx:[YOUR-PASSWORD]@aws-0-xx-xxxx-1.pooler.supabase.com:6543/postgres
   ```
3. Copy `.env.example` to `.env.local` and paste that string into
   `DATABASE_URL`.
4. Push the schema and seed the program data:
   ```bash
   npm install
   npm run db:push
   npm run db:seed
   ```
   `db:seed` is idempotent — safe to re-run any time (e.g. after editing
   `/data/road_to_december_data.json`).
5. Verify: open Drizzle Studio (`npm run db:studio`) and confirm all 6 rows
   exist in the `phases` table with their `sessions`/`exercises` attached.

## 2. Auth (single-user password gate)

This app holds personal health data on the public internet — nothing
renders without auth.

1. Pick a password, then hash it:
   ```bash
   npm run auth:hash -- "your-chosen-password"
   ```
   This prints a string like `scrypt:<salt>:<hash>`. Paste the **entire
   string** into `AUTH_PASSWORD_HASH` in `.env.local` (and later, in Vercel's
   environment variables).
2. Generate a session-signing secret and put it in `AUTH_SESSION_SECRET`:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   (No `openssl` needed on Windows — the Node one-liner above works
   everywhere.)

## 3. MCP bearer token (Coach AI connector)

1. Generate another random secret for `MCP_BEARER_TOKEN`, same command as
   above:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
2. This token is the only thing standing between the public internet and
   your `/api/mcp` endpoint — treat it like a password.

## 4. Vercel (hosting)

1. Push this repo to GitHub, then import it at [vercel.com/new](https://vercel.com/new).
2. In the Vercel project's **Settings → Environment Variables**, add every
   variable from `.env.example` with the real values from steps 1–3:
   - `DATABASE_URL`
   - `AUTH_PASSWORD_HASH`
   - `AUTH_SESSION_SECRET`
   - `MCP_BEARER_TOKEN`
   - `NEXT_PUBLIC_APP_TZ` = `Asia/Manila`
3. Deploy. Vercel's free tier is enough for a single-user app like this.
4. Visit the deployed URL — you should land on `/login`. Enter the password
   you hashed in step 2. Confirm you land on `/home` and see live phase/
   season data (proof the DB connection and seed both worked).

## 5. Connecting "Coach AI" (the MCP server) to claude.ai

The app exposes a remote MCP server at `/api/mcp` using the Streamable HTTP
transport. Your own Claude subscription becomes the AI layer — no
Anthropic API key lives in this codebase.

1. In claude.ai: **Settings → Connectors → Add custom connector**.
2. **URL**: `https://<your-vercel-domain>/api/mcp`
3. **Authentication**: this connector needs a bearer token on every
   request. In the custom connector's advanced/header settings, add:
   ```
   Authorization: Bearer <MCP_BEARER_TOKEN>
   ```
   using the exact value you set in step 3 above.
4. Save, then test it — ask Claude something like "check my dashboard" or
   "log 30g of protein for breakfast." Claude will call the corresponding
   tool (`get_dashboard_summary`, `log_food`, etc.).
5. **Verifying independently**: you can also point the
   [MCP Inspector](https://github.com/modelcontextprotocol/inspector) at
   `https://<your-vercel-domain>/api/mcp` with the same bearer header to
   list tools and test calls without going through claude.ai.

### Security notes

- The MCP route is **never** reachable without the bearer token — every
  request is checked (`src/app/api/mcp/route.ts`, `withMcpAuth`). A
  missing or wrong token gets a 401, not a partial response.
- `/api/mcp` is intentionally excluded from the app's cookie-based login
  gate (`src/proxy.ts`) since it authenticates itself independently — that
  exclusion is scoped to exactly that one path.
- **Upgrade path**: a static bearer token is fine for a single-user app,
  but the natural next step if this ever needs to support more than "just
  me" is OAuth 2.0 Dynamic Client Registration, which `mcp-handler`
  supports via `withMcpAuth`'s token-verification hook — you'd swap
  `verifyToken` in `route.ts` for a real OAuth token check instead of the
  constant-time string comparison it does today.

## 6. Everyday operations

- **Re-seeding after editing the program**: edit
  `/data/road_to_december_data.json` (and `/data/program.md` for the
  human-readable version), then re-run `npm run db:seed`. It upserts by
  phase id / day-of-week / exercise order, so it never duplicates rows.
- **Schema changes**: edit `src/lib/db/schema.ts`, then
  `npm run db:generate` (writes a new migration under `/drizzle`) and
  `npm run db:push` (applies it).
- **Data export**: Settings → "Download full export" hits `/api/export`
  and streams every table as one JSON file — use this before making any
  destructive schema change, or just periodically, since you should never
  be locked into this app.
