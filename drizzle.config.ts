import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

// Next.js reads .env.local natively; dotenv defaults to .env only. Load both,
// .env.local first, so CLI scripts see the same values the app does.
config({ path: [".env.local", ".env"] });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
}

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  strict: true,
  verbose: true,
});
