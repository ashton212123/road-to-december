import { NextResponse } from "next/server";
import { getHomeHabitsData } from "@/lib/habits/queries";
import { todayManilaISO, addDaysISO } from "@/lib/time";

// TEMP WS6 §2 Task 1: calls getHomeHabitsData completely alone, with no
// other query competing for the 3-connection pool, to isolate whether the
// query/DB path itself is the problem or whether it's purely a symptom of
// contention from Home's other 18 queries. Session-gated by proxy.ts like
// every other route. Remove after diagnosis.
export const dynamic = "force-dynamic";

export async function GET() {
  const today = todayManilaISO();
  const started = Date.now();
  try {
    const result = await getHomeHabitsData(today, addDaysISO(today, -29));
    return NextResponse.json({ ok: true, ms: Date.now() - started, count: result.habits.length, first: result.habits[0] ?? null });
  } catch (e) {
    return NextResponse.json({ ok: false, ms: Date.now() - started, error: String(e) }, { status: 500 });
  }
}
