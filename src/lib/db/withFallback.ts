/** Resolves to `fallback` if `promise` hasn't settled within `timeoutMs`.
 * Use for any query that runs alongside several others in a Promise.all
 * against this project's deliberately tiny 3-connection pool (lib/db/index.ts)
 * -- under sustained concurrent load, postgres-js can starve one arbitrary
 * caller indefinitely rather than just queuing it behind the others like
 * the rest (confirmed live: it was a different query each retry, never the
 * same one twice). A caller missing one dataset can degrade gracefully; a
 * request that never responds cannot. */
export function withFallback<T>(promise: Promise<T>, fallback: T, timeoutMs = 10_000): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), timeoutMs);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      }
    );
  });
}
