/** WS6 §2 Task 1: a query abandoned by withFallback (lib/db/withFallback.ts)
 * that later gets killed by Postgres's own statement_timeout was crashing
 * the whole serverless process -- confirmed live: "Node.js process exited
 * with exit status: 128" right after "canceling statement due to statement
 * timeout" (Postgres code 57014), on a request that had already sent its
 * 200 response. The unhandledRejection listener alone wasn't enough: the
 * actual crash channel is a raw Socket "error" event deep in postgres-js's
 * connection-cancellation handling (stack ends in Socket.emit ->
 * TCP.onStreamRead), which Node treats as an uncaughtException, not a
 * rejection.
 *
 * Only 57014 (statement_timeout) is swallowed here -- that's the one error
 * we know is a benign abandoned-query cleanup, already accounted for by the
 * fallback value the original caller moved on with. Anything else still
 * crashes the process: Node's own guidance is that uncaughtException may
 * leave the process in a state nothing should keep running on. */
function isAbandonedStatementTimeout(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: unknown }).code === "57014";
}

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  process.on("unhandledRejection", (reason) => {
    if (isAbandonedStatementTimeout(reason)) {
      console.error("[unhandledRejection] abandoned query statement_timeout, ignoring:", reason);
      return;
    }
    console.error("[unhandledRejection]", reason);
  });

  process.on("uncaughtException", (err) => {
    if (isAbandonedStatementTimeout(err)) {
      console.error("[uncaughtException] abandoned query statement_timeout, ignoring:", err);
      return;
    }
    console.error("[uncaughtException]", err);
    process.exit(1);
  });
}
