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
  postgres(connectionString, { prepare: false, idle_timeout: 20, connect_timeout: 8 });

if (process.env.NODE_ENV !== "production") {
  globalForDb.rtdQueryClient = queryClient;
}

export const db = drizzle(queryClient, { schema });
