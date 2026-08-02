/** WS6 §2 Task 1: a query abandoned by withFallback (lib/db/withFallback.ts)
 * that later rejects -- e.g. Postgres's own statement_timeout finally
 * killing a connection stuck behind pool contention -- was surfacing as an
 * unhandled rejection and crashing the whole serverless process (confirmed
 * live: "Node.js process exited with exit status: 128" right after a
 * "canceling statement due to statement timeout" error, on a request that
 * had already sent its 200 response). withFallback's own .then(_, onReject)
 * should catch its wrapped promise's rejection, so this is a defensive
 * backstop for whatever internal promise postgres-js/drizzle create that
 * isn't the one withFallback awaits -- log and move on instead of taking
 * the container down for every other in-flight request. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  process.on("unhandledRejection", (reason) => {
    console.error("[unhandledRejection]", reason);
  });
}
