/**
 * Loop smoke harness: boots the production build locally, mints a session
 * cookie with the app's own signing logic, and asserts every screen renders
 * real content with no error boundary. Run AFTER `npm run build`:
 *
 *   npm run smoke
 *
 * The session secret is read from .env.local and never printed. Exit 0 = all
 * screens pass; exit 1 = failures (listed on stdout as JSON).
 */
import { spawn, execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SignJWT } from "jose";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 3111;
// SMOKE_BASE_URL=https://... checks a deployed origin instead of booting the
// local build (same assertions, same never-printed session cookie).
const REMOTE = process.env.SMOKE_BASE_URL ?? null;
const BASE = REMOTE ?? `http://localhost:${PORT}`;

// [route, sentinel-that-must-appear] — sentinel null = just 200 + no error boundary.
const CHECKS = [
  ["/home", "Days to NCAA"],
  ["/train", null],
  ["/fuel", "Protein"],
  ["/fuel?view=plan", "g/kg"],
  ["/analytics?period=week&offset=0", "Improvement matrix"],
  ["/analytics?period=month&offset=0", "Improvement matrix"],
  ["/swim", "Weekly swim volume"],
  ["/swim/sessions", "All sessions"],
  ["/learn", "30 Days of Python"],
  ["/learn/python", "Day 1"],
  ["/analytics?tab=train&period=week&offset=0", null],
  ["/analytics?tab=fuel&period=month&offset=0", null],
  ["/analytics?tab=recovery&period=week&offset=0", null],
  ["/more", null],
  ["/more/recovery", null],
  ["/more/settings", "Training status"],
  ["/more/coach-ai", "How's my nutrition looking today?"],
  ["/life/crm", "Kanban"],
  ["/school", null],
  ["/business", null],
  ["/offline", null],
];
const ERROR_MARKERS = ["Something went wrong", "Couldn't load this screen", "Application error"];

function readEnvLocal(key) {
  const text = readFileSync(path.join(ROOT, ".env.local"), "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && m[1] === key) return m[2].replace(/^["']|["']$/g, "");
  }
  throw new Error(`${key} not found in .env.local`);
}

async function mintCookie() {
  const secret = new TextEncoder().encode(readEnvLocal("AUTH_SESSION_SECRET"));
  const token = await new SignJWT({ sub: "athlete" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("600s") // short-lived: smoke runs take seconds
    .sign(secret);
  return `rtd_session=${token}`;
}

async function waitForServer(timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(`${BASE}/login`, { redirect: "manual" });
      if (r.status < 500) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("next start never became ready");
}

async function main() {
  const cookie = await mintCookie();
  let server = null;
  if (!REMOTE) {
    const nextBin = path.join(ROOT, "node_modules", "next", "dist", "bin", "next");
    server = spawn(process.execPath, [nextBin, "start", "-p", String(PORT)], {
      cwd: ROOT,
      stdio: "ignore",
    });
  }

  const results = [];
  try {
    if (!REMOTE) await waitForServer();

    // Auth must still be ON: no cookie → redirect to /login.
    const unauthed = await fetch(`${BASE}/home`, { redirect: "manual" });
    results.push({
      route: "/home (no cookie)",
      ok: unauthed.status >= 300 && unauthed.status < 400,
      detail: `status ${unauthed.status} (expect 3xx redirect to /login)`,
    });

    for (const [route, sentinel] of CHECKS) {
      const started = Date.now();
      try {
        const res = await fetch(BASE + route, {
          headers: { cookie },
          redirect: "manual",
          signal: AbortSignal.timeout(30000),
        });
        const body = await res.text();
        const errorHit = ERROR_MARKERS.find((m) => body.includes(m));
        const sentinelOk = sentinel === null || body.includes(sentinel);
        results.push({
          route,
          ok: res.status === 200 && !errorHit && sentinelOk,
          ms: Date.now() - started,
          detail:
            res.status !== 200
              ? `status ${res.status}`
              : errorHit
                ? `error boundary: "${errorHit}"`
                : sentinelOk
                  ? "ok"
                  : `missing sentinel "${sentinel}"`,
        });
      } catch (e) {
        results.push({ route, ok: false, ms: Date.now() - started, detail: String(e) });
      }
    }

    // Burst phase (must run while the server is still up): reproduce a real
    // navigation storm (Train page prefetching all phase links at once) --
    // the pattern that intermittently blew the Supabase connection budget.
    const BURST = [
      "/train/p1", "/train/p2", "/train/p3", "/train/p4", "/train/p5", "/train/p6",
      "/home", "/analytics?period=week&offset=0", "/analytics?period=month&offset=0", "/fuel",
    ];
    const burstStarted = Date.now();
    const burst = await Promise.all(
      BURST.map(async (route) => {
        try {
          const res = await fetch(BASE + route, {
            headers: { cookie },
            redirect: "manual",
            signal: AbortSignal.timeout(30000),
          });
          const body = await res.text();
          const errorHit = ERROR_MARKERS.find((m) => body.includes(m));
          return { route, ok: res.status === 200 && !errorHit, detail: errorHit ? `error boundary` : `status ${res.status}` };
        } catch (e) {
          return { route, ok: false, detail: String(e) };
        }
      })
    );
    const burstFailures = burst.filter((r) => !r.ok);
    results.push({
      route: `[burst x${BURST.length} concurrent]`,
      ok: burstFailures.length === 0,
      ms: Date.now() - burstStarted,
      detail: burstFailures.length === 0 ? "ok" : JSON.stringify(burstFailures),
    });
  } finally {
    if (server) {
      try {
        execSync(`taskkill /PID ${server.pid} /T /F`, { stdio: "ignore" });
      } catch {
        /* already dead */
      }
    }
  }

  const failures = results.filter((r) => !r.ok);
  console.log(JSON.stringify({ pass: failures.length === 0, results }, null, 2));
  process.exit(failures.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(String(e));
  process.exit(1);
});
