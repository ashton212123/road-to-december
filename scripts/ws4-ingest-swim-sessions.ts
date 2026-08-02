/**
 * WS4 §4 -- one-off ingestion of four real swim sessions through The
 * Analyst (src/lib/swim/analyst.ts). Originally an INSERT; WS4 §4b turned
 * it into an idempotent in-place UPDATE of rows 8-11 once the parser
 * changed (fixed temperature/seed, required "sets" field, 3-run
 * self-consistency gate) -- re-running it re-scores the same four rows
 * rather than inserting duplicates. date and setsText are never touched by
 * the UPDATE: setsText must stay byte-for-byte verbatim forever, and the
 * year flags on July 22/23 (dateYearConfirmed) were a one-time decision.
 *
 * Run with: npx tsx scripts/ws4-ingest-swim-sessions.ts
 */
import "../src/lib/db/load-env";
import { eq } from "drizzle-orm";
import { db } from "../src/lib/db/index";
import { swimSessions } from "../src/lib/db/schema";
import { analyzeSwimSession, type AnalystResult } from "../src/lib/swim/analyst";
import { checkDistance } from "../src/lib/swim/distanceChecksum";
import { evaluateConsistency, type ConsistencyConfidence } from "../src/lib/swim/selfConsistency";

type RawSession = {
  id: number;
  label: string;
  date: string;
  dateYearConfirmed: boolean;
  statedTotalDistanceM: number | null;
  rawText: string;
};

// Raw text reproduced verbatim from the athlete's notes -- every character,
// bullet, checkmark, and line break exactly as given. Do not reformat.
// ids match the rows originally inserted by this script's first run
// (read back and reported to the athlete before WS4 §4b existed).
const SESSIONS: RawSession[] = [
  {
    id: 8,
    label: "July 23",
    date: "2026-07-23",
    dateYearConfirmed: false,
    statedTotalDistanceM: 4800,
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
    id: 9,
    label: "July 28",
    date: "2026-07-28",
    dateYearConfirmed: true,
    statedTotalDistanceM: 4400,
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
    id: 10,
    label: "July 16",
    date: "2026-07-16",
    dateYearConfirmed: true,
    statedTotalDistanceM: null,
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
    id: 11,
    label: "July 22",
    date: "2026-07-22",
    dateYearConfirmed: false,
    statedTotalDistanceM: null,
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

function buildAiAnalysis(
  session: RawSession,
  sessionTitle: string,
  sessionAnalysis: string,
  ambiguities: { location: string; issue: string; readings: string[] }[],
  checksum: ReturnType<typeof checkDistance>,
  consistency: { totals: number[]; confidence: ConsistencyConfidence; agreedTotal: number }
): string {
  const parts = [`## ${sessionTitle}`, "", sessionAnalysis];

  if (!session.dateYearConfirmed) {
    parts.push(
      "",
      `⚠ DATE: the athlete's raw log never states a year for this session. Stored as ${session.date} (matching the other logged sessions and today's date) but this year is UNCONFIRMED -- not something the athlete actually stated.`
    );
  }

  if (checksum.mismatch) {
    parts.push(
      "",
      `⚠ DISTANCE MISMATCH: athlete stated ${checksum.statedM}m; The Analyst parsed ${checksum.parsedM}m (Δ ${checksum.deltaM}m, ${checksum.deltaPct?.toFixed(1)}%). Both figures are stored as given -- the parse was not adjusted to match the stated total, and the stated total was not overwritten.`
    );
  }

  if (ambiguities.length > 0) {
    parts.push("", "⚠ PARSING AMBIGUITIES:");
    for (const a of ambiguities) {
      parts.push(`- ${a.location}: ${a.issue}${a.readings.length > 0 ? ` (other readings considered: ${a.readings.join("; ")})` : ""}`);
    }
  }

  parts.push(
    "",
    `⚠ SELF-CONSISTENCY (WS4 §4b): 3 runs -> [${consistency.totals.join(", ")}]m, confidence: ${consistency.confidence}${consistency.confidence === "medium" ? " (majority 2 of 3 agreed)" : " (all 3 agreed)"}, agreed total used: ${consistency.agreedTotal}m.`
  );

  return parts.join("\n");
}

// Groq's on-demand tier caps this model at 12000 tokens/min; each call here
// (large system prompt + structured JSON response) burns roughly a third of
// that budget, so back-to-back calls exhaust it within a handful of requests
// and every call after that gets silently swallowed to null by
// callGroqChat (it never surfaces the 429). This delay keeps steady-state
// throughput under the budget -- confirmed against the account's actual
// x-ratelimit-limit-tokens/remaining-tokens headers, not guessed.
const CALL_SPACING_MS = 20_000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
let firstCall = true;
async function pacedAnalyze(rawText: string) {
  if (!firstCall) await sleep(CALL_SPACING_MS);
  firstCall = false;
  return analyzeSwimSession(rawText);
}

async function main() {
  const updatedIds: number[] = [];
  const skippedLabels: string[] = [];

  for (const session of SESSIONS) {
    console.log(`\n=== ${session.label} (id=${session.id}) ===`);

    // Sanity check: refuse to overwrite a row whose setsText doesn't match
    // what this script expects to be updating -- never blind-write by id.
    const [existing] = await db.select().from(swimSessions).where(eq(swimSessions.id, session.id));
    if (!existing) {
      console.error(`  ABORT: no row with id=${session.id} -- refusing to insert a new one under §4b (UPDATE only).`);
      skippedLabels.push(session.label);
      continue;
    }
    if (existing.setsText !== session.rawText) {
      console.error(`  ABORT: row ${session.id}'s stored setsText does not match this script's rawText for "${session.label}" -- refusing to update the wrong row.`);
      skippedLabels.push(session.label);
      continue;
    }

    const runs: (AnalystResult | null)[] = [];
    for (let i = 0; i < 3; i++) {
      const result = await pacedAnalyze(session.rawText);
      runs.push(result);
      console.log(`  run ${i + 1}: ${result ? `${result.parsedDistanceM}m` : "FAILED (no result)"}`);
    }

    if (runs.some((r) => r === null)) {
      console.error(`  SKIPPED: at least one of 3 runs returned no result for ${session.label}.`);
      skippedLabels.push(session.label);
      continue;
    }

    const totals = runs.map((r) => r!.parsedDistanceM) as [number, number, number];
    const verdict = evaluateConsistency(totals);
    if (verdict.confidence === null || verdict.agreedTotal === null) {
      console.error(`  SKIPPED (per WS4 §4b Task 3): all 3 runs disagree -- [${totals.join(", ")}]m. Row left unchanged.`);
      skippedLabels.push(session.label);
      continue;
    }

    const chosen = runs.find((r) => r!.parsedDistanceM === verdict.agreedTotal)!;
    console.log(`  confidence=${verdict.confidence} agreedTotal=${verdict.agreedTotal}m`);

    const checksum = checkDistance(session.statedTotalDistanceM, chosen.parsedDistanceM);
    console.log(`  stated=${checksum.statedM ?? "null"} parsed=${checksum.parsedM} mismatch=${checksum.mismatch}`);
    if (chosen.ambiguities.length > 0) {
      console.log(`  ambiguities: ${chosen.ambiguities.length}`);
      for (const a of chosen.ambiguities) console.log(`    - ${a.location}: ${a.issue}`);
    }

    const aiAnalysis = buildAiAnalysis(session, chosen.sessionTitle, chosen.sessionAnalysis, chosen.ambiguities, checksum, {
      totals,
      confidence: verdict.confidence,
      agreedTotal: verdict.agreedTotal,
    });
    const trainingLoad = chosen.overview.trainingLoad;

    await db
      .update(swimSessions)
      .set({
        loadRating: trainingLoad,
        parsedDistanceM: chosen.parsedDistanceM,
        statedTotalDistanceM: session.statedTotalDistanceM,
        zoneDistanceM: chosen.intensityDistributionM,
        strokeDistanceM: chosen.overview.strokeBreakdownM,
        equipmentDistanceM: chosen.overview.equipmentBreakdownM,
        qualityDistanceM: chosen.overview.qualityDistanceM,
        durationMin: chosen.overview.estimatedDurationMin,
        sessionRpe: String(trainingLoad),
        aiAnalysis,
      })
      .where(eq(swimSessions.id, session.id));

    console.log(`  updated id=${session.id}`);
    updatedIds.push(session.id);
  }

  console.log("\n=== READ BACK (all 4 rows, updated or not) ===");
  for (const session of SESSIONS) {
    const [row] = await db.select().from(swimSessions).where(eq(swimSessions.id, session.id));
    if (!row) {
      console.log(`id=${session.id}: MISSING`);
      continue;
    }
    const setsTextOk = row.setsText === session.rawText;
    console.log(`\n--- id=${session.id} (${session.label}) -- setsText byte-verbatim: ${setsTextOk ? "OK" : "MISMATCH"} ---`);
    console.log(JSON.stringify(row, null, 2));
  }

  if (skippedLabels.length > 0) {
    console.error(`\nSKIPPED (not updated, left as previously stored): ${skippedLabels.join(", ")}`);
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
