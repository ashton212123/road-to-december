import { config } from "dotenv";

// Side-effect module: must be the first import in any CLI entrypoint that
// reaches ./index, which reads DATABASE_URL at module-evaluation time.
// Next.js reads .env.local natively; dotenv defaults to .env only, so load
// both with .env.local taking precedence. Values already in the real
// environment (e.g. on Vercel) always win — dotenv does not override them.
config({ path: [".env.local", ".env"] });
