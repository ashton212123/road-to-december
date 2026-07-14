# Road to December

Personal athlete command center for the road to NCAA Philippines (Dec 4,
2026) and possibly ASEAN School Games (~Nov 25). v1 covers Train, Fuel,
Analytics, Recovery and a Rules Engine "Coach" — a school module, business
module, and in-app AI assistant panel are future versions.

The periodized S&C program and season data live in `/data/program.md` and
`/data/road_to_december_data.json` — these are the source of truth; the
database is seeded from them (`npm run db:seed`).

## Stack

Next.js 16 (App Router, TypeScript strict) · Tailwind CSS v4 · Drizzle ORM
+ Supabase Postgres · Recharts · a hand-rolled PWA (manifest + service
worker) · a remote MCP server at `/api/mcp` so your own Claude subscription
can act as the app's AI layer.

## Local setup

```bash
npm install
cp .env.example .env.local   # fill in DATABASE_URL, AUTH_PASSWORD_HASH, etc — see DEPLOY.md
npm run db:push              # apply the schema to your Supabase database
npm run db:seed              # idempotent — seeds phases/sessions/exercises from /data
npm run dev
```

Full Supabase + Vercel + MCP connector setup: **[DEPLOY.md](./DEPLOY.md)**.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Standard Next.js dev/build/start |
| `npm run db:generate` | Generate a Drizzle migration from `src/lib/db/schema.ts` |
| `npm run db:push` | Apply the schema to the database |
| `npm run db:studio` | Open Drizzle Studio |
| `npm run db:seed` | Idempotently seed program data from `/data` |
| `npm run auth:hash -- "password"` | Generate the value for `AUTH_PASSWORD_HASH` |

## Never locked in

Settings → "Download full export" streams every logged row as one JSON
file at any time.
