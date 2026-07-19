import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
}

const globalForDb = globalThis as unknown as { rtdQueryClient?: ReturnType<typeof postgres> };

// `max` is deliberately below postgres.js's default of 10: each Vercel
// serverless container gets its own pool, and several concurrent containers
// each maxing out can exhaust the Supabase pooler's shared connection budget
// (this is what caused the "statement timeout" / "DB call timed out"
// cascade in production). 8 is a middle ground -- low enough to matter
// across concurrent containers, high enough that a single page's ~12-15
// query Promise.all batch (Home, Analytics, post-V3-rewrite) mostly clears
// in one or two waves instead of three, which matters a lot given
// withRetry's per-attempt timeout races the *whole* batch (see its callers).
const queryClient =
  globalForDb.rtdQueryClient ??
  postgres(connectionString, { prepare: false, max: 8, idle_timeout: 10, connect_timeout: 8 });

if (process.env.NODE_ENV !== "production") {
  globalForDb.rtdQueryClient = queryClient;
}

export const db = drizzle(queryClient, { schema });
