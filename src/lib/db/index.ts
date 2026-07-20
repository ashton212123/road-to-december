import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
}

const globalForDb = globalThis as unknown as { rtdQueryClient?: ReturnType<typeof postgres> };

// `max` is deliberately tiny: each Vercel serverless container gets its own
// pool, and a navigation burst (link prefetches fan out to parallel
// containers) multiplies max by container count against Supabase Micro's
// shared ~60-connection budget -- max 8 x 7 containers was the intermittent
// "database connection hiccup" error boundary. Post-V4 the hot pages are one
// batched statement (Analytics) or tag-cached (Home), so per-request
// parallelism no longer needs a wide pool; a cold Home's ~14-query
// Promise.all just queues over 3 conns in a few fast waves.
const queryClient =
  globalForDb.rtdQueryClient ??
  postgres(connectionString, { prepare: false, max: 3, idle_timeout: 10, connect_timeout: 8 });

if (process.env.NODE_ENV !== "production") {
  globalForDb.rtdQueryClient = queryClient;
}

export const db = drizzle(queryClient, { schema });
