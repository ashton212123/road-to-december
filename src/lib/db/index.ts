import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
}

const globalForDb = globalThis as unknown as { rtdQueryClient?: ReturnType<typeof postgres> };

const queryClient =
  globalForDb.rtdQueryClient ??
  postgres(connectionString, {
    prepare: false,
    // Each serverless function instance gets its own client -- without a cap
    // this defaults to up to 10 connections per instance, and Vercel can run
    // many instances concurrently against Supabase's pooler (port 6543),
    // which has its own connection limit shared across all of them. 5 is
    // enough headroom for one request's parallel Promise.all queries
    // (several pages fire 5-10 queries concurrently) without one instance
    // being able to hog a large share of the pooler's slots.
    max: 5,
    idle_timeout: 20,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.rtdQueryClient = queryClient;
}

export const db = drizzle(queryClient, { schema });
