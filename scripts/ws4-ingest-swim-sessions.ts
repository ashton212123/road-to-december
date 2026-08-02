/**
 * WS4 §4 -- one-off ingestion of four real swim sessions through The
 * Analyst (src/lib/swim/analyst.ts). Kept as a permanent, auditable record
 * of exactly what raw text and logic produced these four rows -- not meant
 * to be re-run (a second run would insert duplicate rows; there's no
 * upsert/dedupe key here on purpose, since these are one-time real data).
 *
 * Run with: npx tsx scripts/ws4-ingest-swim-sessions.ts
 */
import "../src/lib/db/load-env";
import { eq } from "drizzle-orm";
import { db } from "../src/lib/db/index";
import { swimSessions } from "../src/lib/db/schema";
import { analyzeSwimSession } from "../src/lib/swim/analyst";
import { checkDistance } from "../src/lib/swim/distanceChecksum";

type RawSession = {
  label: string;
  date: string;
  dateYearConfirmed: boolean;
  statedTotalDistanceM: number | null;
  rawText: string;
};

// Raw text reproduced verbatim from the athlete's notes -- every character,
// bullet, checkmark, and line break exactly as given. Do not reformat.
const SESSIONS: RawSession[] = [
  {
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
  checksum: ReturnType<typeof checkDistance>
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

  return parts.join("\n");
}

async function main() {
  const insertedIds: number[] = [];

  for (const session of SESSIONS) {
    console.log(`\n=== ${session.label} ===`);
    const result = await analyzeSwimSession(session.rawText);
    if (!result) {
      console.error(`FAILED: The Analyst returned no result for ${session.label}`);
      continue;
    }

    const checksum = checkDistance(session.statedTotalDistanceM, result.parsedDistanceM);
    console.log(`stated=${checksum.statedM ?? "null"} parsed=${checksum.parsedM} mismatch=${checksum.mismatch}`);
    if (result.ambiguities.length > 0) {
      console.log(`ambiguities: ${result.ambiguities.length}`);
      for (const a of result.ambiguities) console.log(`  - ${a.location}: ${a.issue}`);
    }

    const aiAnalysis = buildAiAnalysis(session, result.sessionTitle, result.sessionAnalysis, result.ambiguities, checksum);
    const trainingLoad = result.overview.trainingLoad;

    const [row] = await db
      .insert(swimSessions)
      .values({
        date: session.date,
        loadRating: trainingLoad,
        setsText: session.rawText,
        parsedDistanceM: result.parsedDistanceM,
        statedTotalDistanceM: session.statedTotalDistanceM,
        zoneDistanceM: result.intensityDistributionM,
        strokeDistanceM: result.overview.strokeBreakdownM,
        equipmentDistanceM: result.overview.equipmentBreakdownM,
        qualityDistanceM: result.overview.qualityDistanceM,
        durationMin: result.overview.estimatedDurationMin,
        sessionRpe: String(trainingLoad),
        aiAnalysis,
      })
      .returning({ id: swimSessions.id });

    console.log(`inserted id=${row.id}`);
    insertedIds.push(row.id);
  }

  console.log("\n=== READ BACK ===");
  for (const id of insertedIds) {
    const [row] = await db.select().from(swimSessions).where(eq(swimSessions.id, id));
    console.log(JSON.stringify(row, null, 2));
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
