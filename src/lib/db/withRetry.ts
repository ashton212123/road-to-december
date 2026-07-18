// The DB connection has shown intermittent, total hangs (Vercel serverless
// <-> Supabase Postgres connection flakiness that neither provider's own
// dashboards fully explain). Most of these failures are transient -- a retry
// a few hundred ms later succeeds. This turns "page hangs forever" into
// "page takes an extra second" by bounding each attempt and retrying.
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { attempts?: number; timeoutMs?: number; backoffMs?: number } = {}
): Promise<T> {
  const attempts = opts.attempts ?? 3;
  const timeoutMs = opts.timeoutMs ?? 8000;
  const backoffMs = opts.backoffMs ?? 400;

  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`DB call timed out after ${timeoutMs}ms`)), timeoutMs)
        ),
      ]);
    } catch (err) {
      lastError = err;
      if (attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, backoffMs * (attempt + 1)));
      }
    }
  }
  throw lastError;
}
