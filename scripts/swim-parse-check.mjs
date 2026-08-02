/**
 * WS4 §4b Task 4 -- permanent regression fixture, independent of the
 * ingestion script. Runs The Analyst 3x per session.
 *
 * HARD GATE (pass/fail): all 3 runs must produce the exact same
 * parsedDistanceM for every session. With temperature 0 and a fixed seed
 * (analyst.ts), this should now hold -- this script is the proof that Task 1
 * actually took effect. Any disagreement fails the script.
 *
 * SOFT CHECK (reported only, never enforced): the delta between the agreed
 * parse and Ashton's own hand-verified total for each session. This is a
 * finding to report -- this script must never adjust raw text, tweak a
 * parsed number, or special-case a session to make the soft check pass.
 *
 * Run with: npx tsx scripts/swim-parse-check.mjs
 */
import "../src/lib/db/load-env";
import { analyzeSwimSession } from "../src/lib/swim/analyst";
import { evaluateConsistency } from "../src/lib/swim/selfConsistency";

// Raw text reproduced verbatim from scripts/ws4-ingest-swim-sessions.ts --
// frozen here independently so this fixture stays stable even if that
// script changes. expectedM is Ashton's own hand-verified cross-check, not
// this parser's output.
const SESSIONS = [
  {
    label: "July 23",
    expectedM: 4650,
    rawText: `* july 23 Warm-up
*   400 IM w/ pull buoy
*   25 scull + 25 IM
*   Pre-Main Set
*   8 × 100 (2 sets) w/ pull buoy
*   Odds: IM @ 1:55
*   Evens: Freestyle @ 1:45
*   Main Set
*   6 × 200 Freestyle Paddle + Pull Buoy @ 2:45
*   Maintained ~2:25 for the first 5 reps
*   Last rep: 2:20
*   16 × 50 S1 (Breaststroke) w/ finger paddles + pull buoy @:55
*   Speed Set
*   4×50 × 3 sets
*   Set 1: Best Time +10
*   Set 2: PB +5
*   Set 3: PB +3
Total Distance: 4,800 m`,
  },
  {
    label: "July 28",
    expectedM: 4400,
    rawText: `Swim Log — July 28, 2026

Total Distance: 4,400 m

Workout

* ✅ 4×50 Free w/ fins (25 right arm, 25 left arm) — 200 m
* ✅ 4×50 IM drill w/ fins — 200 m
* ✅ 3×16×50 w/ fins on :50
    * Fly — 800 m
    * Back — 800 m
    * Breast — 800 m
* ✅ 4×8×50 S1 Breast
    * Round 1 on 1:00
    * Round 2 on :55
    * Round 3 on :50
    * Round 4 on :45
    * Total — 1,600 m`,
  },
  {
    label: "July 16",
    expectedM: 4725,
    rawText: `july 16 2026 sat

4x100 frim 3 sets
no gears
paddle
paddle fins

3 rounds of
1x50 fly
2x50 back
1x100 breast
1x50 free
1 min rest
1x400 im descend by round
5:25
5:13
5:04

100 ez

12x100 free pads and pullbuoy

100 fast im
1:03

25 fast fly
12.60`,
  },
  {
    label: "July 22",
    expectedM: 4600,
    rawText: `july 22

200 free

4x200 im w fins
 2 sets
3:15 on
3:00 on
1st set drills
2nd set swim

16x100 s1 (breast)
on 1:40
i maintained around 1:25

4x100 3 sets
first set 25 uw 75 free swim
2nd set 90% effort
3rd set max effort`,
  },
];

// Groq's on-demand tier caps this model at 12000 tokens/min; each call here
// (large system prompt + structured JSON response) burns roughly a third of
// that budget, so firing calls back-to-back exhausts it within a handful of
// requests and every call after that gets silently swallowed to null by
// callGroqChat (it never surfaces the 429). This delay keeps steady-state
// throughput under the budget -- confirmed against the account's actual
// x-ratelimit-limit-tokens/remaining-tokens headers, not guessed.
const CALL_SPACING_MS = 20_000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  let hardGateFailed = false;
  const rows = [];
  let firstCall = true;

  for (const session of SESSIONS) {
    console.log(`\n=== ${session.label} ===`);
    const totals = [];
    for (let i = 0; i < 3; i++) {
      if (!firstCall) await sleep(CALL_SPACING_MS);
      firstCall = false;
      const result = await analyzeSwimSession(session.rawText);
      if (!result) {
        console.error(`  run ${i + 1}: FAILED -- The Analyst returned no result`);
        totals.push(null);
        continue;
      }
      console.log(`  run ${i + 1}: ${result.parsedDistanceM}m`);
      totals.push(result.parsedDistanceM);
    }

    if (totals.some((t) => t === null)) {
      console.error(`  HARD GATE FAILED: at least one run returned no result`);
      hardGateFailed = true;
      rows.push({ label: session.label, totals, expectedM: session.expectedM, agreedTotal: null });
      continue;
    }

    const verdict = evaluateConsistency(totals);
    if (verdict.confidence !== "high") {
      console.error(`  HARD GATE FAILED: runs disagree -- [${totals.join(", ")}]`);
      hardGateFailed = true;
    } else {
      console.log(`  HARD GATE PASSED: all 3 runs agree at ${verdict.agreedTotal}m`);
    }

    rows.push({ label: session.label, totals, expectedM: session.expectedM, agreedTotal: verdict.agreedTotal });
  }

  console.log("\n=== SOFT CHECK: parsed vs Ashton's hand-verified expected (reported, NOT enforced) ===");
  console.log("label      | run1   | run2   | run3   | agreed | expected | delta");
  for (const r of rows) {
    const [a, b, c] = r.totals;
    const delta = r.agreedTotal !== null ? r.agreedTotal - r.expectedM : null;
    console.log(
      `${r.label.padEnd(10)} | ${String(a).padEnd(6)} | ${String(b).padEnd(6)} | ${String(c).padEnd(6)} | ${String(r.agreedTotal).padEnd(6)} | ${String(r.expectedM).padEnd(8)} | ${delta === null ? "n/a" : delta}`
    );
  }

  if (hardGateFailed) {
    console.error("\nFAIL: one or more sessions did not have 3 agreeing runs.");
    process.exit(1);
  }
  console.log("\nPASS: all sessions had 3 agreeing runs.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
