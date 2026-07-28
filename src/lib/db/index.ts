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
// `statement_timeout`/`idle_in_transaction_session_timeout` close the real gap
// behind `withRetry`'s connection-pool exhaustion bug (BACKLOG.md): withRetry's
// Promise.race abandons a slow query from the JS side but never cancels it, so
// an abandoned query kept running and holding one of these 3 connections
// indefinitely -- the more retries fired, the fewer connections were ever
// freed. Set above the largest real withRetry `timeoutMs` in the app (15000,
// Home/Swim/Analytics) so no legitimate query is ever cut short by this; a
// query that outlives it is by definition already abandoned by its caller.
const queryClient =
  globalForDb.rtdQueryClient ??
  postgres(connectionString, {
    prepare: false,
    max: 3,
    idle_timeout: 10,
    connect_timeout: 8,
    connection: { statement_timeout: 20000, idle_in_transaction_session_timeout: 20000 },
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.rtdQueryClient = queryClient;
}

export const db = drizzle(queryClient, { schema });
