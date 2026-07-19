import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
}

const globalForDb = globalThis as unknown as { rtdQueryClient?: ReturnType<typeof postgres> };

// `max` is deliberately small: each Vercel serverless container gets its own
// pool, and Vercel can spin up many concurrent containers under load. With no
// cap, a single container's page load (now up to ~15 parallel queries after
// the V3 bento rewrite) tries to grab up to postgres.js's default of 10
// connections; across several concurrent containers that exhausts the
// Supabase pooler's shared connection budget fast, causing the exact
// "statement timeout" / "DB call timed out" cascade seen in production.
// Capping at 5 means a heavy page's queries queue and run in a few waves
// instead of all-at-once, trading a little per-request latency for the pool
// never being the bottleneck across concurrent containers.
const queryClient =
  globalForDb.rtdQueryClient ??
  postgres(connectionString, { prepare: false, max: 5, idle_timeout: 10, connect_timeout: 8 });

if (process.env.NODE_ENV !== "production") {
  globalForDb.rtdQueryClient = queryClient;
}

export const db = drizzle(queryClient, { schema });
